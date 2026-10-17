/**
 * Pure TDEE estimator — zero I/O, no db/server imports (rule BR1).
 *
 * Method: slide 7-day windows over "complete pairs" (days with both kcal and
 * weight). A window is valid when its boundary entries sit exactly 7 calendar
 * days apart, so the boundary weight delta is directly kg/week:
 *
 *   expenditure_kcal_day = avgKcal − ΔweightKg_per_week × 1100
 *                                              (7700 kcal/kg ÷ 7 days)
 *
 * Successive weekly estimates are smoothed with EWMA (α = 0.25). The reported
 * spread is the max−min half-range of the last 3 raw weekly estimates.
 */

export type TdeeEntry = {
	date: string; // canonical 'YYYY-MM-DD'
	kcal: number;
	weightKg: number | null;
};

export type WeeklyEstimate = {
	weekStart: string;
	kcal: number;
};

export type TdeeResult =
	| { status: "collecting"; pairs: number; needed: 14 }
	| {
			status: "ready";
			kcal: number;
			spreadKcal: number;
			weeklyEstimates: WeeklyEstimate[];
			pairs: number;
	  };

const MIN_PAIRS = 14;
const WINDOW_SPAN_DAYS = 7; // boundary weights must be exactly 7 days apart
const KCAL_PER_KG_PER_WEEK = 1100; // 7700 kcal/kg ÷ 7 days
const EWMA_ALPHA = 0.25;
const SPREAD_WINDOW = 3;
const DAY_MS = 86_400_000;

const utcMs = (date: string): number => Date.parse(`${date}T00:00:00Z`);

/** Whole-day difference b − a for canonical date strings. */
const dayDiff = (a: string, b: string): number => Math.round((utcMs(b) - utcMs(a)) / DAY_MS);

export function computeTdee(entries: TdeeEntry[]): TdeeResult {
	const pairs: Array<{ date: string; kcal: number; weightKg: number }> = [];
	for (const e of entries) {
		if (e.weightKg === null || !Number.isFinite(e.weightKg)) continue;
		if (!Number.isFinite(e.kcal)) continue;
		pairs.push({ date: e.date, kcal: e.kcal, weightKg: e.weightKg });
	}
	if (pairs.length < MIN_PAIRS) {
		return { status: "collecting", pairs: pairs.length, needed: MIN_PAIRS };
	}

	const weekly: WeeklyEstimate[] = [];
	for (let i = 0; i + WINDOW_SPAN_DAYS < pairs.length; i++) {
		const first = pairs[i];
		const last = pairs[i + WINDOW_SPAN_DAYS];
		if (dayDiff(first.date, last.date) !== WINDOW_SPAN_DAYS) continue; // incomplete boundary data
		let kcalSum = 0;
		for (let j = i; j <= i + WINDOW_SPAN_DAYS; j++) kcalSum += pairs[j].kcal;
		const avgKcal = kcalSum / (WINDOW_SPAN_DAYS + 1);
		const deltaKgPerWeek = last.weightKg - first.weightKg;
		weekly.push({ weekStart: first.date, kcal: avgKcal - deltaKgPerWeek * KCAL_PER_KG_PER_WEEK });
	}

	// Enough pairs but never two exactly a week apart — nothing to estimate yet.
	if (weekly.length === 0) {
		return { status: "collecting", pairs: pairs.length, needed: MIN_PAIRS };
	}

	let smoothed: number | null = null;
	for (const w of weekly) {
		smoothed = smoothed === null ? w.kcal : EWMA_ALPHA * w.kcal + (1 - EWMA_ALPHA) * smoothed;
	}

	const tail = weekly.slice(-SPREAD_WINDOW);
	let min = Infinity;
	let max = -Infinity;
	for (const w of tail) {
		if (w.kcal < min) min = w.kcal;
		if (w.kcal > max) max = w.kcal;
	}

	return {
		status: "ready",
		kcal: Math.round(smoothed as number),
		spreadKcal: Math.round((max - min) / 2),
		weeklyEstimates: weekly,
		pairs: pairs.length,
	};
}
