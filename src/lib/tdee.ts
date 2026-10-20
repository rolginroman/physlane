/**
 * Pure TDEE estimator — zero I/O, no db/server imports (rule BR1).
 *
 * Method: slide 7-day windows over "complete pairs" (days with both kcal and
 * weight). A window is valid when its boundary entries sit 7 calendar days
 * apart, so the boundary weight delta is directly kg/week:
 *
 *   expenditure_kcal_day = avgKcal − ΔweightKg_per_week × 1100
 *                                              (7700 kcal/kg ÷ 7 days)
 *
 * Sparse data (v2): boundary entries may sit 7–10 calendar days apart when a
 * exact-week partner is missing; the weight delta is normalized per-week by
 * the actual span and kcal is averaged over the logged days in the window.
 * Missed days no longer reset the estimate.
 *
 * Outliers (v2): single-day salt/water spikes are rejected before pairing. A
 * point is a spike when BOTH adjacent day-rates deviate >2.5σ (robust MAD σ)
 * with opposite signs and at least one exceeds the absolute floor — a genuine
 * level shift has same-sign deltas and is never rejected. Rejected weights are
 * interpolated from their neighbors so pairs and windows stay intact.
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
  | {
      status: "collecting";
      pairs: number;
      needed: 14;
      outliersRejected: number;
    }
  | {
      status: "ready";
      kcal: number;
      spreadKcal: number;
      weeklyEstimates: WeeklyEstimate[];
      pairs: number;
      outliersRejected: number;
    };

const MIN_PAIRS = 14;
const WINDOW_SPAN_DAYS = 7; // minimum boundary separation
const WINDOW_MAX_SPAN_DAYS = 10; // maximum boundary separation (sparse tolerance)
const KCAL_PER_KG_PER_WEEK = 1100; // 7700 kcal/kg ÷ 7 days
const EWMA_ALPHA = 0.25;
const SPREAD_WINDOW = 3;
const OUTLIER_SIGMA = 2.5;
const OUTLIER_MIN_KG_PER_DAY = 0.35; // ~2.45 kg/wk: no honest daily rate is this big
const OUTLIER_MIN_SIGMA = 0.05; // kg/day floor so flat series still catch spikes
const DAY_MS = 86_400_000;

const utcMs = (date: string): number => Date.parse(`${date}T00:00:00Z`);

/** Whole-day difference b − a for canonical date strings. */
const dayDiff = (a: string, b: string): number =>
  Math.round((utcMs(b) - utcMs(a)) / DAY_MS);

const median = (xs: number[]): number => {
  const s = [...xs].sort((x, y) => x - y);
  const mid = s.length >> 1;
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

type Pair = { date: string; kcal: number; weightKg: number };

/**
 * Interpolates single-day salt/water spikes. A point is rejected only when
 * both adjacent day-rates are extreme (>2.5 robust σ from the median rate)
 * with OPPOSITE signs — the spike signature. Returns the count rejected.
 */
export function rejectOutlierWeights(pairs: Pair[]): {
  pairs: Pair[];
  rejected: number;
} {
  if (pairs.length < 3) return { pairs, rejected: 0 };
  const rates: number[] = [];
  for (let i = 1; i < pairs.length; i++) {
    const gap = dayDiff(pairs[i - 1].date, pairs[i].date);
    if (gap > 0) rates.push((pairs[i].weightKg - pairs[i - 1].weightKg) / gap);
  }
  if (rates.length < 3) return { pairs, rejected: 0 };
  const med = median(rates);
  const mad = median(rates.map((r) => Math.abs(r - med)));
  // A mostly-flat series makes MAD zero; floor σ so a lone spike is still
  // detectable (its deviation dwarfs the floor) while quiet noise is not.
  const sigma = Math.max(1.4826 * mad, OUTLIER_MIN_SIGMA);
  if (!(sigma > 0)) return { pairs, rejected: 0 };

  const out = pairs.map((p) => ({ ...p }));
  let rejected = 0;
  for (let i = 1; i < out.length - 1; i++) {
    const gapIn = dayDiff(out[i - 1].date, out[i].date);
    const gapOut = dayDiff(out[i].date, out[i + 1].date);
    if (gapIn <= 0 || gapOut <= 0) continue;
    const rIn = (out[i].weightKg - out[i - 1].weightKg) / gapIn;
    const rOut = (out[i + 1].weightKg - out[i].weightKg) / gapOut;
    const spikeIn = Math.abs(rIn - med) > OUTLIER_SIGMA * sigma;
    const spikeOut = Math.abs(rOut - med) > OUTLIER_SIGMA * sigma;
    const opposite = rIn * rOut < 0;
    const floorHit =
      Math.max(Math.abs(rIn), Math.abs(rOut)) > OUTLIER_MIN_KG_PER_DAY;
    if (spikeIn && spikeOut && opposite && floorHit) {
      const span = dayDiff(out[i - 1].date, out[i + 1].date);
      const t = dayDiff(out[i - 1].date, out[i].date) / span;
      out[i].weightKg =
        out[i - 1].weightKg + (out[i + 1].weightKg - out[i - 1].weightKg) * t;
      rejected++;
      i++; // the next delta now starts from the interpolated value
    }
  }
  return { pairs: out, rejected };
}

export function computeTdee(entries: TdeeEntry[]): TdeeResult {
  let pairs: Pair[] = [];
  for (const e of entries) {
    if (e.weightKg === null || !Number.isFinite(e.weightKg)) continue;
    if (!Number.isFinite(e.kcal)) continue;
    pairs.push({ date: e.date, kcal: e.kcal, weightKg: e.weightKg });
  }

  const smoothedPairs = rejectOutlierWeights(pairs);
  pairs = smoothedPairs.pairs;
  const outliersRejected = smoothedPairs.rejected;

  if (pairs.length < MIN_PAIRS) {
    return {
      status: "collecting",
      pairs: pairs.length,
      needed: MIN_PAIRS,
      outliersRejected,
    };
  }

  const weekly: WeeklyEstimate[] = [];
  let j = 1;
  for (let i = 0; i < pairs.length; i++) {
    if (j <= i) j = i + 1;
    while (
      j < pairs.length &&
      dayDiff(pairs[i].date, pairs[j].date) < WINDOW_SPAN_DAYS
    )
      j++;
    if (j >= pairs.length) break;
    const span = dayDiff(pairs[i].date, pairs[j].date);
    if (span > WINDOW_MAX_SPAN_DAYS) continue; // gap too wide to trust
    let kcalSum = 0;
    let n = 0;
    for (let k = i; k <= j; k++) {
      kcalSum += pairs[k].kcal;
      n++;
    }
    const avgKcal = kcalSum / n;
    const deltaKgPerWeek =
      ((pairs[j].weightKg - pairs[i].weightKg) / span) * WINDOW_SPAN_DAYS;
    weekly.push({
      weekStart: pairs[i].date,
      kcal: avgKcal - deltaKgPerWeek * KCAL_PER_KG_PER_WEEK,
    });
  }

  // Enough pairs but no boundary pair within 7–10 days — nothing to estimate.
  if (weekly.length === 0) {
    return {
      status: "collecting",
      pairs: pairs.length,
      needed: MIN_PAIRS,
      outliersRejected,
    };
  }

  let smoothed: number | null = null;
  for (const w of weekly) {
    smoothed =
      smoothed === null
        ? w.kcal
        : EWMA_ALPHA * w.kcal + (1 - EWMA_ALPHA) * smoothed;
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
    outliersRejected,
  };
}
