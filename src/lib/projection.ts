/**
 * Pure weight projection + pace verdict (F11) — zero I/O, no db/server
 * imports (rule BR1).
 *
 * Same energy density the TDEE estimator uses: 7700 kcal per kg of body
 * weight, so a sustained gap of 1100 kcal/day moves weight about 1 kg per
 * week. The projection extrapolates the CURRENT balance forward:
 *
 *   impliedRateKgPerWeek = (avgIntakeKcal − tdeeKcal) / 1100
 *   projectedWeight      = currentWeightKg + impliedRate × weeks
 *
 * The verdict compares a rate (observed trend preferred, implied as
 * fallback) with the cycle's signed target rate (negative = cut) inside a
 * tolerance band. "Too fast" always means moving in the goal direction
 * faster than planned; "too slow" the opposite.
 */

import type { Phase } from "./adherence";

export const KCAL_PER_DAY_PER_KG_PER_WEEK = 1100; // 7700 kcal/kg ÷ 7 days
export const PROJECTION_WEEKS = 4;
export const PACE_TOLERANCE_KG_PER_WEEK = 0.1;

export type WeightProjection = {
  impliedRateKgPerWeek: number;
  projectedDeltaKg: number;
  projectedWeightKg: number;
};

export function projectWeight(input: {
  currentWeightKg: number;
  avgIntakeKcal: number;
  tdeeKcal: number;
  /** Horizon in weeks; defaults to the F11 contract (4 weeks). */
  weeks?: number;
}): WeightProjection | null {
  const { currentWeightKg, avgIntakeKcal, tdeeKcal } = input;
  if (
    !Number.isFinite(currentWeightKg) ||
    !Number.isFinite(avgIntakeKcal) ||
    !Number.isFinite(tdeeKcal)
  ) {
    return null;
  }
  const weeks =
    input.weeks != null && Number.isFinite(input.weeks)
      ? input.weeks
      : PROJECTION_WEEKS;
  const impliedRateKgPerWeek =
    (avgIntakeKcal - tdeeKcal) / KCAL_PER_DAY_PER_KG_PER_WEEK;
  const projectedDeltaKg = impliedRateKgPerWeek * weeks;
  return {
    impliedRateKgPerWeek,
    projectedDeltaKg,
    projectedWeightKg: currentWeightKg + projectedDeltaKg,
  };
}

export type PaceVerdictKind = "on-pace" | "too-fast" | "too-slow";

export type PaceVerdict = {
  kind: PaceVerdictKind;
  actualRateKgPerWeek: number;
  targetRateKgPerWeek: number;
};

export function paceVerdict(input: {
  actualRateKgPerWeek: number;
  targetRateKgPerWeek: number;
  toleranceKgPerWeek?: number;
}): PaceVerdict {
  const tol = input.toleranceKgPerWeek ?? PACE_TOLERANCE_KG_PER_WEEK;
  const { actualRateKgPerWeek: actual, targetRateKgPerWeek: target } = input;
  // Direction of the goal: cut targets are negative. Maintain (target 0) is
  // scored like a bulk, so gaining reads "too fast" and losing "too slow".
  const dir = target < 0 ? -1 : 1;
  const excess = (actual - target) * dir;
  const kind: PaceVerdictKind =
    excess > tol ? "too-fast" : excess < -tol ? "too-slow" : "on-pace";
  return { kind, actualRateKgPerWeek: actual, targetRateKgPerWeek: target };
}

export type VerdictCopy = { headline: string; body: string | null };

const MINUS = "−"; // U+2212, matches the dashboard's signed numbers

const fmtRate = (kgPerWeek: number): string => {
  const sign = kgPerWeek > 0 ? "+" : kgPerWeek < 0 ? MINUS : "";
  return `${sign}${Math.abs(kgPerWeek).toFixed(2)} kg/wk`;
};

/**
 * Phase-aware verdict copy. Cut frames speed as muscle risk, bulk as
 * fat-gain risk, maintain as drift. No em dashes, no exclamation marks.
 */
export function verdictCopy(
  verdict: PaceVerdict,
  phase: Phase | null,
): VerdictCopy {
  const rate = fmtRate(verdict.actualRateKgPerWeek);
  const target = fmtRate(verdict.targetRateKgPerWeek);

  if (verdict.kind === "on-pace") {
    return {
      headline: `Trend ${rate} vs ${target} target: on pace.`,
      body: null,
    };
  }
  if (phase === "maintain" || phase === null) {
    const up = verdict.actualRateKgPerWeek > 0;
    return {
      headline: `Trend ${rate} against a hold-steady target: drifting ${up ? "up" : "down"}.`,
      body: up
        ? "Weight is drifting up. Trim intake if it holds."
        : "Weight is drifting down. Add intake if it holds.",
    };
  }
  if (phase === "cut") {
    return verdict.kind === "too-fast"
      ? {
          headline: `Trend ${rate} vs ${target} target: cutting too fast.`,
          body: "Muscle-loss risk climbs with speed. Ease intake up toward the target rate.",
        }
      : {
          headline: `Trend ${rate} vs ${target} target: cutting too slow.`,
          body: "Trend runs behind the target. Check adherence before trimming calories.",
        };
  }
  return verdict.kind === "too-fast"
    ? {
        headline: `Trend ${rate} vs ${target} target: gaining too fast.`,
        body: "Surplus past the plan tends to land as fat. Ease intake back toward the target.",
      }
    : {
        headline: `Trend ${rate} vs ${target} target: gaining too slow.`,
        body: "Trend runs behind the target. Add calories if the trend holds.",
      };
}
