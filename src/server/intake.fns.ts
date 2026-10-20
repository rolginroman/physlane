import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { useDb } from "#/db/client";
import * as schema from "#/db/schema";
import { requireUser } from "./auth.fns";
import { computeTdee } from "#/lib/tdee";
import { shapeTdeeStatus } from "#/lib/band";
import {
  buildIntakeProjection,
  freeHistoryFloor,
  loadActiveCycle,
  loadIntakeContext,
} from "./intake.core";
import { appError } from "#/lib/app-error";
import { isValidIntakeDate, validateIntake } from "#/lib/intake-logic";
import { intakeStreak } from "#/lib/adherence";
import { detectReportingDrift, driftWindows } from "#/lib/drift";
const GetOrCreateIntakeInputSchema = z.object({
  date: z.string(),
});

const UpsertIntakeInputSchema = z.object({
  date: z.string(),
  kcal: z.number(),
  proteinG: z.number().nullable().optional(),
});

const IntakeRangeInputSchema = z.object({
  from: z.string(),
  to: z.string(),
});

export type { ProjectionDTO } from "./intake.core";

export type DailyIntakeDTO = {
  date: string; // canonical 'YYYY-MM-DD'
  kcal: number | null;
  proteinG: number | null;
};

export type TdeeStatusResult = import("#/lib/band").TdeeStatusPayload;
export type TargetPromptPayload = import("#/lib/band").TargetPromptPayload;

const toDTO = (r: schema.DailyIntake): DailyIntakeDTO => ({
  date: r.date,
  kcal: r.kcal,
  proteinG: r.proteinG,
});

/** Canonical UTC 'YYYY-MM-DD' for a Date/epoch-ms. */
const toDate = (d: Date): string => d.toISOString().slice(0, 10);

/** Existing row for the date, or a transient default — nothing is inserted here. */
export const getOrCreateIntake = createServerFn({ method: "GET" })
  .validator((d) => GetOrCreateIntakeInputSchema.parse(d))
  .handler(async ({ data }) => {
    const me = await requireUser();
    if (!isValidIntakeDate(data.date)) throw appError("INVALID_DATE");
    const [row] = await useDb()
      .select()
      .from(schema.dailyIntake)
      .where(
        and(
          eq(schema.dailyIntake.userId, me.id),
          eq(schema.dailyIntake.date, data.date),
        ),
      )
      .limit(1);
    return row ? toDTO(row) : { date: data.date, kcal: null, proteinG: null };
  });

/** Insert-or-update the user's row for a date (I5: one row per user-date, idempotent). */
export const upsertIntake = createServerFn({ method: "POST" })
  .validator((d) => UpsertIntakeInputSchema.parse(d))
  .handler(async ({ data }) => {
    const me = await requireUser();
    const v = validateIntake(data);
    const now = new Date();
    await useDb()
      .insert(schema.dailyIntake)
      .values({
        id: crypto.randomUUID(),
        userId: me.id,
        date: v.date,
        kcal: v.kcal,
        proteinG: v.proteinG,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [schema.dailyIntake.userId, schema.dailyIntake.date],
        set: { kcal: v.kcal, proteinG: v.proteinG, updatedAt: now },
      });
    return { ok: true };
  });

/** Intake history ascending. Free plan: `from` clamped to 90 days back (F12). */
export const intakeRange = createServerFn({ method: "GET" })
  .validator((d) => IntakeRangeInputSchema.parse(d))
  .handler(async ({ data }) => {
    const me = await requireUser();
    if (!isValidIntakeDate(data.from) || !isValidIntakeDate(data.to))
      throw appError("INVALID_DATE");
    const from = freeHistoryFloor({ plan: me.plan, from: data.from });
    const rows = await useDb()
      .select()
      .from(schema.dailyIntake)
      .where(
        and(
          eq(schema.dailyIntake.userId, me.id),
          gte(schema.dailyIntake.date, from),
          lte(schema.dailyIntake.date, data.to),
        ),
      )
      .orderBy(asc(schema.dailyIntake.date));
    return rows.map(toDTO);
  });

/**
 * TDEE pipeline state: intake kcal joined with same-day measurement weights.
 * Free users get status + pair count + the confidence band but never the
 * estimate numbers; the gate itself lives in the pure shaper (src/lib/band.ts).
 */
export const tdeeStatus = createServerFn({ method: "GET" }).handler(
  async () => {
    const me = await requireUser();
    const ctx = await loadIntakeContext(me.id);
    const result = computeTdee(ctx.entries);
    const activeCycle = await loadActiveCycle(me.id);

    // Drift detector consumes the same paired series, anchored at the newest
    // logged day; burn must be ready or there is nothing to diverge from.
    const lastDay = ctx.entries.at(-1)?.date;
    const drift =
      result.status === "ready" && lastDay != null
        ? detectReportingDrift(
            result.weeklyEstimates,
            driftWindows(ctx.entries, lastDay) ?? [],
          )
        : null;

    const projection =
      me.plan === "pro" && result.status === "ready"
        ? buildIntakeProjection({
            intakeRows: ctx.intakeRows,
            measurementRows: ctx.measurementRows,
            tdeeKcal: result.kcal,
            activeCycle,
          })
        : null;

    return shapeTdeeStatus(result, {
      plan: me.plan,
      projection,
      drift,
      prompt: {
        targetKcalPerDay: activeCycle?.kcalTargetPerDay ?? null,
        state: {
          lastAppliedAt: me.targetPromptLastAppliedAt,
          lastDismissedAt: me.targetPromptLastDismissedAt,
          appliedKcal: me.targetPromptAppliedKcal,
        },
        now: new Date(),
      },
    });
  },
);

/**
 * Consecutive-day intake logging streak (F17), ending today. An unlogged
 * today does not break it: the grace lives in the pure fn, not here.
 */
export const getIntakeStreak = createServerFn({ method: "GET" }).handler(
  async () => {
    const me = await requireUser();
    const rows = await useDb()
      .select({ date: schema.dailyIntake.date })
      .from(schema.dailyIntake)
      .where(eq(schema.dailyIntake.userId, me.id));
    return {
      streak: intakeStreak(
        rows.map((r) => r.date),
        toDate(new Date()),
      ),
    };
  },
);
