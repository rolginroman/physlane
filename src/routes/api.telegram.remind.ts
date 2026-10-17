import { createFileRoute } from "@tanstack/react-router";
import { and, asc, eq, inArray, isNotNull } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { useDb, schema } from "#/db";
import { intakeStreak } from "#/lib/adherence";
import { localDate, renderReminderText, shouldRemind, timingSafeEqual } from "#/lib/remind";

/**
 * Cron-driven daily Telegram reminders (G2.5). GET or POST, guarded by the
 * `x-cron-secret` header compared timing-safely against CRON_SECRET.
 *
 * Both secrets are optional so deploys work before they exist: without
 * TELEGRAM_BOT_TOKEN or CRON_SECRET the run is a no-op {sent:0, reason:
 * 'unconfigured'} — there is nothing to protect or send yet. A single user's
 * send failure never fails the batch.
 */
export const Route = createFileRoute("/api/telegram/remind")({
	server: {
		handlers: {
			GET: async ({ request }: { request: Request }) => handleRemindRun(request),
			POST: async ({ request }: { request: Request }) => handleRemindRun(request),
		},
	},
});

const MAX_USERS_PER_RUN = 100;

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
		const sent = await runReminderBatch(now, botToken);
		return Response.json({ sent });
	} catch (err) {
		// Never 500 the whole cron run on one bad batch — log and report zero.
		console.error("telegram remind batch error", err);
		return Response.json({ sent: 0 });
	}
}

async function runReminderBatch(now: Date, botToken: string): Promise<number> {
	const db = useDb();
	const users = await db
		.select({
			id: schema.user.id,
			name: schema.user.name,
			unitSystem: schema.user.unitSystem,
			telegramId: schema.user.telegramId,
			reminderTime: schema.user.reminderTime,
			reminderTz: schema.user.reminderTz,
			telegramNotifiedAt: schema.user.telegramNotifiedAt,
		})
		.from(schema.user)
		.where(and(isNotNull(schema.user.reminderTime), isNotNull(schema.user.telegramId)))
		.limit(MAX_USERS_PER_RUN);
	if (users.length === 0) return 0;

	// Batch the per-user lookups: intake dates (logged-today + streak) and the
	// weight series (latest weigh-in per user, ascending so the last wins).
	const ids = users.map((u) => u.id);
	const [intakeRows, weightRows] = await Promise.all([
		db
			.select({ userId: schema.dailyIntake.userId, date: schema.dailyIntake.date })
			.from(schema.dailyIntake)
			.where(inArray(schema.dailyIntake.userId, ids)),
		db
			.select({ userId: schema.measurements.userId, weightKg: schema.measurements.weightKg })
			.from(schema.measurements)
			.where(and(inArray(schema.measurements.userId, ids), isNotNull(schema.measurements.weightKg)))
			.orderBy(asc(schema.measurements.takenAt)),
	]);

	const datesByUser = new Map<string, string[]>();
	for (const r of intakeRows) {
		const list = datesByUser.get(r.userId) ?? [];
		list.push(r.date);
		datesByUser.set(r.userId, list);
	}
	const latestWeightByUser = new Map<string, number>();
	for (const r of weightRows) latestWeightByUser.set(r.userId, r.weightKg as number);

	let sent = 0;
	for (const u of users) {
		if (!u.telegramId || !u.reminderTime) continue;
		const tz = u.reminderTz ?? "UTC";
		const todayLocal = localDate(now.getTime(), tz) ?? now.toISOString().slice(0, 10);
		const dates = datesByUser.get(u.id) ?? [];
		const alreadyLoggedToday = dates.includes(todayLocal);
		const streak = intakeStreak(dates, todayLocal);
		if (!shouldRemind(now.getTime(), u.reminderTime, u.telegramNotifiedAt, alreadyLoggedToday, tz)) {
			continue;
		}

		const text = renderReminderText(u.name, streak, u.unitSystem, latestWeightByUser.get(u.id) ?? null);
		try {
			const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ chat_id: u.telegramId, text }),
			});
			if (!res.ok) {
				console.error("telegram sendMessage rejected", u.id, res.status);
				continue;
			}
			await db
				.update(schema.user)
				.set({ telegramNotifiedAt: now, updatedAt: now })
				.where(eq(schema.user.id, u.id));
			sent++;
		} catch (err) {
			console.error("telegram remind send failed", u.id, err); // continue with the batch
		}
	}
	return sent;
}
