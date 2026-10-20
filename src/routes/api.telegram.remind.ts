import { createFileRoute } from "@tanstack/react-router";
import { and, asc, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { useDb } from "#/db/client";
import * as schema from "#/db/schema";
import { intakeStreak } from "#/lib/adherence";
import {
  localDate,
  renderReminderText,
  shouldRemind,
  timingSafeEqual,
} from "#/lib/remind";
import {
  buildDigestStats,
  renderDigest,
  shouldSendDigest,
} from "#/server/digest.core";

/**
 * Cron-driven daily Telegram reminders (G2.5) + weekly digest (G2.3). GET or
 * POST, guarded by the `x-cron-secret` header compared timing-safely against
 * CRON_SECRET.
 *
 * Both secrets are optional so deploys work before they exist: without
 * TELEGRAM_BOT_TOKEN or CRON_SECRET the run is a no-op {sent:0, reason:
 * 'unconfigured'} — there is nothing to protect or send yet. A single user's
 * send failure never fails the batch.
 *
 * Digest rule (user directive): one message a week, informative, no channel
 * growth framing. On the digest day the digest replaces the daily reminder,
 * so a run never sends two messages to the same chat. Cap: 100 per kind.
 */
export const Route = createFileRoute("/api/telegram/remind")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) =>
        handleRemindRun(request),
      POST: async ({ request }: { request: Request }) =>
        handleRemindRun(request),
    },
  },
});

const MAX_USERS_PER_RUN = 100;
const MAX_DIGESTS_PER_RUN = 100;

async function handleRemindRun(request: Request): Promise<Response> {
  const secret = env.CRON_SECRET;
  const botToken = env.TELEGRAM_BOT_TOKEN;
  if (!secret || !botToken) {
    return Response.json({ sent: 0, reason: "unconfigured" });
  }
  const provided = request.headers.get("x-cron-secret") ?? "";
  if (!timingSafeEqual(provided, secret)) {
    return new Response("unauthorized", { status: 401 });
  }

  const now = new Date();
  try {
    const { reminders, digests } = await runReminderBatch(now, botToken);
    return Response.json({ sent: reminders + digests, digests });
  } catch (err) {
    // Never 500 the whole cron run on one bad batch — log and report zero.
    console.error("telegram remind batch error", err);
    return Response.json({ sent: 0 });
  }
}

async function runReminderBatch(
  now: Date,
  botToken: string,
): Promise<{ reminders: number; digests: number }> {
  const db = useDb();
  const users = await db
    .select({
      id: schema.user.id,
      name: schema.user.name,
      plan: schema.user.plan,
      unitSystem: schema.user.unitSystem,
      telegramId: schema.user.telegramId,
      reminderTime: schema.user.reminderTime,
      reminderTz: schema.user.reminderTz,
      telegramNotifiedAt: schema.user.telegramNotifiedAt,
      createdAt: schema.user.createdAt,
      lastDigestAt: schema.user.lastDigestAt,
    })
    .from(schema.user)
    .where(
      and(
        isNotNull(schema.user.reminderTime),
        isNotNull(schema.user.telegramId),
      ),
    )
    .limit(MAX_USERS_PER_RUN);
  if (users.length === 0) return { reminders: 0, digests: 0 };

  // Batch the per-user lookups: intake rows (logged-today + streak + digest
  // averages), the dated weight series (latest weigh-in + digest delta,
  // ascending so the last wins), and active cycle targets for the verdict.
  const ids = users.map((u) => u.id);
  const [intakeRows, weightRows, cycleRows] = await Promise.all([
    db
      .select({
        userId: schema.dailyIntake.userId,
        date: schema.dailyIntake.date,
        kcal: schema.dailyIntake.kcal,
      })
      .from(schema.dailyIntake)
      .where(inArray(schema.dailyIntake.userId, ids)),
    db
      .select({
        userId: schema.measurements.userId,
        takenAt: schema.measurements.takenAt,
        weightKg: schema.measurements.weightKg,
      })
      .from(schema.measurements)
      .where(
        and(
          inArray(schema.measurements.userId, ids),
          isNotNull(schema.measurements.weightKg),
        ),
      )
      .orderBy(asc(schema.measurements.takenAt)),
    db
      .select({
        userId: schema.cycles.userId,
        kcalTargetPerDay: schema.cycles.kcalTargetPerDay,
        targetRateKgPerWeek: schema.cycles.targetRateKgPerWeek,
      })
      .from(schema.cycles)
      .where(
        and(inArray(schema.cycles.userId, ids), isNull(schema.cycles.endDate)),
      )
      .orderBy(desc(schema.cycles.startDate)),
  ]);

  const push = <K, V>(map: Map<K, V[]>, key: K, value: V) => {
    const list = map.get(key) ?? [];
    list.push(value);
    map.set(key, list);
  };
  const intakeByUser = new Map<
    string,
    Array<{ date: string; kcal: number | null }>
  >();
  for (const r of intakeRows)
    push(intakeByUser, r.userId, { date: r.date, kcal: r.kcal });
  const weightsByUser = new Map<
    string,
    Array<{ takenAt: Date; weightKg: number }>
  >();
  for (const r of weightRows)
    push(weightsByUser, r.userId, {
      takenAt: r.takenAt,
      weightKg: r.weightKg as number,
    });
  const cycleByUser = new Map<
    string,
    { kcalTargetPerDay: number | null; targetRateKgPerWeek: number | null }
  >();
  for (const r of cycleRows)
    if (!cycleByUser.has(r.userId)) cycleByUser.set(r.userId, r);

  let reminders = 0;
  let digests = 0;
  for (const u of users) {
    if (!u.telegramId || !u.reminderTime) continue;
    const tz = u.reminderTz ?? "UTC";
    const todayLocal =
      localDate(now.getTime(), tz) ?? now.toISOString().slice(0, 10);
    const intake = intakeByUser.get(u.id) ?? [];
    const alreadyLoggedToday = intake.some((r) => r.date === todayLocal);
    const streak = intakeStreak(
      intake.map((r) => r.date),
      todayLocal,
    );
    const series = weightsByUser.get(u.id) ?? [];
    const latestWeightKg =
      series.length > 0 ? series[series.length - 1].weightKg : null;

    // Weekly digest first (G2.3): anchor-weekday cadence, 168h dedupe via
    // lastDigestAt, fires inside the reminder's own 10-minute bucket. On
    // the digest day it replaces the daily reminder: one message, not two.
    if (
      digests < MAX_DIGESTS_PER_RUN &&
      shouldSendDigest({
        nowUtcMs: now.getTime(),
        lastDigestAt: u.lastDigestAt,
        anchorAt: u.createdAt,
        reminderTime: u.reminderTime,
        timeZone: tz,
      })
    ) {
      const cycle = cycleByUser.get(u.id);
      const stats = buildDigestStats({
        now,
        timeZone: tz,
        intake,
        weights: series,
        targetKcalPerDay: cycle?.kcalTargetPerDay ?? null,
        targetRateKgPerWeek: cycle?.targetRateKgPerWeek ?? null,
      });
      if (stats) {
        const text = renderDigest(stats, {
          plan: u.plan,
          unitSystem: u.unitSystem,
          name: u.name,
        });
        try {
          const res = await fetch(
            `https://api.telegram.org/bot${botToken}/sendMessage`,
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ chat_id: u.telegramId, text }),
            },
          );
          if (res.ok) {
            await db
              .update(schema.user)
              .set({ lastDigestAt: now, updatedAt: now })
              .where(eq(schema.user.id, u.id));
            digests++;
            continue; // digest replaces the daily reminder today
          }
          console.error(
            "telegram digest sendMessage rejected",
            u.id,
            res.status,
          );
        } catch (err) {
          console.error("telegram digest send failed", u.id, err); // continue to the reminder
        }
      } else {
        // Nothing to summarize this week: still stamp the cadence so an
        // empty week does not retry every bucket of the digest day.
        await db
          .update(schema.user)
          .set({ lastDigestAt: now, updatedAt: now })
          .where(eq(schema.user.id, u.id));
      }
    }

    if (
      !shouldRemind(
        now.getTime(),
        u.reminderTime,
        u.telegramNotifiedAt,
        alreadyLoggedToday,
        tz,
      )
    ) {
      continue;
    }

    const text = renderReminderText(
      u.name,
      streak,
      u.unitSystem,
      latestWeightKg,
    );
    try {
      const res = await fetch(
        `https://api.telegram.org/bot${botToken}/sendMessage`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ chat_id: u.telegramId, text }),
        },
      );
      if (!res.ok) {
        console.error("telegram sendMessage rejected", u.id, res.status);
        continue;
      }
      await db
        .update(schema.user)
        .set({ telegramNotifiedAt: now, updatedAt: now })
        .where(eq(schema.user.id, u.id));
      reminders++;
    } catch (err) {
      console.error("telegram remind send failed", u.id, err); // continue with the batch
    }
  }
  return { reminders, digests };
}
