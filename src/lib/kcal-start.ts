/**
 * Day-one starting kcal estimate. The whole point of physlane is that burn gets
 * MEASURED from your logs (see tdee.ts), but onboarding happens before any data
 * exists. This fills that gap with an honest population heuristic and says so:
 *
 *   maintenance ≈ weightKg × 32  (33 male / 31 female, mixed activity)
 *   daily delta  = |rate kg/wk| × 7700 / 7  (Wishnofsky's constant, see /guide)
 *   cut: maintenance − delta · bulk: + delta · maintain: maintenance
 *
 * Rounded to 50s, clamped to the app's valid target range. Never presented as
 * anything more than a starting line; the measured TDEE replaces it.
 */

export type Sex = "male" | "female";

/** Energy density of body tissue, kcal per kg (3,500 kcal per lb). */
export const KCAL_PER_KG = 7700;

/** Population maintenance shortcut, kcal per kg of body weight. */
export function kcalPerKg(sex: Sex | null): number {
  return sex === "female" ? 31 : sex === "male" ? 33 : 32;
}

export function maintenanceKcal(weightKg: number, sex: Sex | null): number {
  return weightKg * kcalPerKg(sex);
}

/** Daily kcal a given weekly rate implies, unsigned. */
export function rateToDailyKcal(rateKgPerWeek: number): number {
  return (Math.abs(rateKgPerWeek) * KCAL_PER_KG) / 7;
}

export interface StartingKcalInput {
  weightKg: number | null;
  sex: Sex | null;
  phase: "cut" | "bulk" | "maintain";
  targetRateKgPerWeek: number | null;
}

/** Round to 50s and clamp to the app's valid target range. Shared by the day-one prefill and the day-14 measured correction. */
export function normalizeTargetKcal(kcal: number): number {
  const rounded = Math.round(kcal / 50) * 50;
  return Math.min(6000, Math.max(800, rounded));
}

/** Day-one target suggestion, or null when there is nothing to compute from. */
export function estimateStartingKcal(input: StartingKcalInput): number | null {
  const { weightKg, sex, phase, targetRateKgPerWeek } = input;
  if (weightKg == null || !Number.isFinite(weightKg) || weightKg <= 0)
    return null;

  let estimate = maintenanceKcal(weightKg, sex);
  if (
    phase !== "maintain" &&
    targetRateKgPerWeek != null &&
    Number.isFinite(targetRateKgPerWeek)
  ) {
    const delta = rateToDailyKcal(targetRateKgPerWeek);
    estimate = phase === "cut" ? estimate - delta : estimate + delta;
  }
  return normalizeTargetKcal(estimate);
}
