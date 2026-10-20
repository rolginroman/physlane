/**
 * Pure lean-mass-risk detection (F13). Reuses the leanMassRisk heuristic from
 * ./units: weight loss beyond 0.7 kg/wk while the waist shrinks slower than
 * 0.15 cm/wk suggests lean mass, not only fat, is going.
 *
 * BR1: no I/O. Entries must be ascending by takenAt (measurement fns already
 * return them that way).
 */
import { leanMassRisk } from "./units";

export type RateSample = {
  takenAt: string; // ISO
  weightKg: number | null;
  waistCm: number | null;
};

export type WeeklyRates = {
  weightKgPerWeek: number | null;
  waistCmPerWeek: number | null;
};

export type LeanMassStatus = {
  atRisk: boolean;
  rates: WeeklyRates;
};

const WEEK_MS = 7 * 86_400_000;
const DAY_MS = 86_400_000;

/** Latest value minus the newest value at least 7 days older, normalised to per week. */
function rateFor<T extends RateSample>(
  entries: T[],
  pick: (e: T) => number | null,
): number | null {
  const withVal = entries.filter((e) => pick(e) != null);
  if (withVal.length < 2) return null;
  const latest = withVal[withVal.length - 1] as T;
  const latestMs = Date.parse(latest.takenAt);
  const cutoff = latestMs - WEEK_MS;
  for (let i = withVal.length - 2; i >= 0; i--) {
    const ref = withVal[i];
    if (ref === undefined) continue;
    const refMs = Date.parse(ref.takenAt);
    if (refMs <= cutoff) {
      const spanDays = (latestMs - refMs) / DAY_MS;
      return (
        (((pick(latest) as number) - (pick(ref as T) as number)) / spanDays) * 7
      );
    }
  }
  return null;
}

export function weeklyRates(entries: RateSample[]): WeeklyRates {
  return {
    weightKgPerWeek: rateFor(entries, (e) => e.weightKg),
    waistCmPerWeek: rateFor(entries, (e) => e.waistCm),
  };
}

/** True only when both rates are known and the heuristic fires. */
export function leanMassStatus(entries: RateSample[]): LeanMassStatus {
  const rates = weeklyRates(entries);
  const atRisk =
    rates.weightKgPerWeek != null &&
    rates.waistCmPerWeek != null &&
    leanMassRisk(rates.weightKgPerWeek, rates.waistCmPerWeek);
  return { atRisk, rates };
}
