import { createServerFn } from "@tanstack/react-start";
import { and, asc, desc, eq, gte, isNull, lte } from "drizzle-orm";
import { useDb, schema } from "#/db";
import { requireUser } from "./auth.fns";
import { computeTdee, type TdeeEntry, type WeeklyEstimate } from "#/lib/tdee";
import { isValidIntakeDate, validateIntake } from "#/lib/intake-logic";
import { intakeStreak, type Phase } from "#/lib/adherence";
import { weeklyRates } from "#/lib/lean-mass";
import { paceVerdict, projectWeight, PROJECTION_WEEKS, type PaceVerdict } from "#/lib/projection";

const FREE_HISTORY_DAYS = 90;
const PROJECTION_INTAKE_DAYS = 7; // "current intake" = avg of the last 7 logged days

export type DailyIntakeDTO = {
	date: string; // canonical 'YYYY-MM-DD'
	kcal: number | null;
	proteinG: number | null;
};

/** F11 projection + verdict (Pro only). All math lives in #/lib/projection. */
export type ProjectionDTO = {
	currentWeightKg: number;
	avgIntakeKcal: number;
	impliedRateKgPerWeek: number;
	projectedDeltaKg4w: number;
	projectedWeightKg4w: number;
	observedRateKgPerWeek: number | null;
	targetRateKgPerWeek: number | null;
	phase: Phase | null;
	verdict: PaceVerdict | null;
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
			projection: ProjectionDTO | null;
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
		return { ...result, gated: false, projection: await buildProjection(db, me.id, intakeRows, measurementRows, result.kcal) };
	}
	return {
		status: "ready" as const,
		gated: true,
		kcal: null,
		spreadKcal: null,
		pairs: result.pairs,
		weeklyEstimates: null,
		projection: null,
	};
});

/**
 * F11 (Pro): 4-week weight projection at current intake plus the
 * observed-trend-vs-target verdict. Needs the estimate's kcal plus the rows
 * tdeeStatus already fetched; only the active cycle is a fresh query.
 */
async function buildProjection(
	db: ReturnType<typeof useDb>,
	userId: string,
	intakeRows: Array<{ date: string; kcal: number | null }>,
	measurementRows: Array<{ takenAt: Date; weightKg: number | null }>,
	tdeeKcal: number,
): Promise<ProjectionDTO | null> {
	const [activeCycle] = await db
		.select({ phase: schema.cycles.phase, targetRateKgPerWeek: schema.cycles.targetRateKgPerWeek })
		.from(schema.cycles)
		.where(and(eq(schema.cycles.userId, userId), isNull(schema.cycles.endDate)))
		.orderBy(desc(schema.cycles.startDate))
		.limit(1);

	// "Current intake": average of the last 7 logged days.
	const loggedKcal = intakeRows
		.filter((r) => r.kcal != null)
		.slice(-PROJECTION_INTAKE_DAYS)
		.map((r) => r.kcal as number);
	const avgIntakeKcal =
		loggedKcal.length > 0
			? Math.round(loggedKcal.reduce((s, k) => s + k, 0) / loggedKcal.length)
			: null;

	// Latest weight in the series (rows are ascending).
	let currentWeightKg: number | null = null;
	for (const m of measurementRows) {
		if (m.weightKg !== null) currentWeightKg = m.weightKg;
	}

	const observedRateKgPerWeek = weeklyRates(
		measurementRows.map((m) => ({ takenAt: m.takenAt.toISOString(), weightKg: m.weightKg, waistCm: null })),
	).weightKgPerWeek;

	if (avgIntakeKcal === null || currentWeightKg === null) return null;
	const proj = projectWeight({
		currentWeightKg,
		avgIntakeKcal,
		tdeeKcal,
		weeks: PROJECTION_WEEKS,
	});
	if (proj === null) return null;

	const targetRateKgPerWeek = activeCycle?.targetRateKgPerWeek ?? null;
	// Verdict the observed trend when measurable, else the intake-implied rate.
	const verdictRateKgPerWeek = observedRateKgPerWeek ?? proj.impliedRateKgPerWeek;
	const verdict =
		targetRateKgPerWeek != null
			? paceVerdict({ actualRateKgPerWeek: verdictRateKgPerWeek, targetRateKgPerWeek })
			: null;

	return {
		currentWeightKg,
		avgIntakeKcal,
		impliedRateKgPerWeek: proj.impliedRateKgPerWeek,
		projectedDeltaKg4w: proj.projectedDeltaKg,
		projectedWeightKg4w: proj.projectedWeightKg,
		observedRateKgPerWeek,
		targetRateKgPerWeek,
		phase: activeCycle?.phase ?? null,
		verdict,
	};
}

/**
 * Consecutive-day intake logging streak (F17), ending today. An unlogged
 * today does not break it: the grace lives in the pure fn, not here.
 */
export const getIntakeStreak = createServerFn({ method: "GET" }).handler(async () => {
	const me = await requireUser();
	const rows = await useDb()
		.select({ date: schema.dailyIntake.date })
		.from(schema.dailyIntake)
		.where(eq(schema.dailyIntake.userId, me.id));
	return { streak: intakeStreak(rows.map((r) => r.date), toDate(new Date())) };
});
