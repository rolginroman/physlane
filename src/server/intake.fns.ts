import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { useDb, schema } from "#/db";
import { requireUser } from "./auth.fns";
import { computeTdee, type TdeeEntry, type WeeklyEstimate } from "#/lib/tdee";
import { isValidIntakeDate, validateIntake } from "#/lib/intake-logic";

const FREE_HISTORY_DAYS = 90;

export type DailyIntakeDTO = {
	date: string; // canonical 'YYYY-MM-DD'
	kcal: number | null;
	proteinG: number | null;
};

export type TdeeStatusResult =
	| { status: "collecting"; pairs: number; needed: 14 }
	| {
			status: "ready";
			gated: boolean;
			kcal: number | null;
			spreadKcal: number | null;
			pairs: number;
			weeklyEstimates: WeeklyEstimate[] | null;
	  };

const toDTO = (r: schema.DailyIntake): DailyIntakeDTO => ({
	date: r.date,
	kcal: r.kcal,
	proteinG: r.proteinG,
});

/** Canonical UTC 'YYYY-MM-DD' for a Date/epoch-ms. */
const toDate = (d: Date): string => d.toISOString().slice(0, 10);

/** Existing row for the date, or a transient default — nothing is inserted here. */
export const getOrCreateIntake = createServerFn({ method: "GET" })
	.validator((d: { date: string }) => d)
	.handler(async ({ data }) => {
		const me = await requireUser();
		if (!isValidIntakeDate(data.date)) throw new Error("INVALID_DATE");
		const [row] = await useDb()
			.select()
			.from(schema.dailyIntake)
			.where(and(eq(schema.dailyIntake.userId, me.id), eq(schema.dailyIntake.date, data.date)))
			.limit(1);
		return row ? toDTO(row) : { date: data.date, kcal: null, proteinG: null };
	});

/** Insert-or-update the user's row for a date (I5: one row per user-date, idempotent). */
export const upsertIntake = createServerFn({ method: "POST" })
	.validator((d: { date: string; kcal: number; proteinG?: number | null }) => d)
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
	.validator((d: { from: string; to: string }) => d)
	.handler(async ({ data }) => {
		const me = await requireUser();
		if (!isValidIntakeDate(data.from) || !isValidIntakeDate(data.to)) throw new Error("INVALID_DATE");
		// Canonical dates sort lexicographically, so clamping is max(from, now-90d).
		const freeFloor = toDate(new Date(Date.now() - FREE_HISTORY_DAYS * 86_400_000));
		const from = me.plan === "pro" || data.from > freeFloor ? data.from : freeFloor;
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
 * Free users get status + pair count but never the estimate numbers (gated).
 */
export const tdeeStatus = createServerFn({ method: "GET" }).handler(async () => {
	const me = await requireUser();
	const db = useDb();

	const intakeRows = await db
		.select({ date: schema.dailyIntake.date, kcal: schema.dailyIntake.kcal })
		.from(schema.dailyIntake)
		.where(eq(schema.dailyIntake.userId, me.id));

	// Ascending so the last same-day measurement (latest) wins per date.
	const measurementRows = await db
		.select({ takenAt: schema.measurements.takenAt, weightKg: schema.measurements.weightKg })
		.from(schema.measurements)
		.where(eq(schema.measurements.userId, me.id))
		.orderBy(asc(schema.measurements.takenAt));

	const byDate = new Map<string, TdeeEntry>();
	for (const r of intakeRows) {
		byDate.set(r.date, { date: r.date, kcal: r.kcal, weightKg: null });
	}
	for (const m of measurementRows) {
		if (m.weightKg === null) continue;
		const day = toDate(m.takenAt);
		const entry = byDate.get(day);
		if (entry) entry.weightKg = m.weightKg; // same-day measurement = that date's weight
	}

	const entries = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
	const result = computeTdee(entries);
	if (result.status === "collecting") return result;

	if (me.plan === "pro") {
		return { ...result, gated: false };
	}
	return {
		status: "ready" as const,
		gated: true,
		kcal: null,
		spreadKcal: null,
		pairs: result.pairs,
		weeklyEstimates: null,
	};
});
