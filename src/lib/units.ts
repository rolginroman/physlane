/** Unit conversion helpers. Canonical storage: kg + cm. */

export type UnitSystem = "metric" | "imperial";

const LB_PER_KG = 2.2046226218;
const CM_PER_IN = 2.54;

export const kgToLb = (kg: number) => kg * LB_PER_KG;
export const lbToKg = (lb: number) => lb / LB_PER_KG;
export const cmToIn = (cm: number) => cm / CM_PER_IN;
export const inToCm = (inch: number) => inch * CM_PER_IN;

export function fmtWeight(
  kg: number | null | undefined,
  units: UnitSystem,
): string {
  if (kg == null) return "—";
  return units === "metric"
    ? `${kg.toFixed(1)} kg`
    : `${kgToLb(kg).toFixed(1)} lb`;
}

export function fmtLength(
  cm: number | null | undefined,
  units: UnitSystem,
): string {
  if (cm == null) return "—";
  return units === "metric"
    ? `${cm.toFixed(1)} cm`
    : `${cmToIn(cm).toFixed(1)} in`;
}

/** Girth display, e.g. '85.0 cm' / '33.5 in'. Same contract as fmtLength. */
export const formatGirth = fmtLength;

/** Signed girth delta for history rows, e.g. '+0.4 cm' / '−1.2 in'. */
export function formatGirthDelta(
  cm: number | null | undefined,
  units: UnitSystem,
): string {
  if (cm == null) return "";
  const v = units === "metric" ? cm : cmToIn(cm);
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${sign}${Math.abs(v).toFixed(1)} ${units === "metric" ? "cm" : "in"}`;
}

/** Signed weight delta for history rows, e.g. '+0.4 kg' / '−1.2 lb'. */
export function formatWeightDelta(
  kg: number | null | undefined,
  units: UnitSystem,
): string {
  if (kg == null) return "";
  const v = units === "metric" ? kg : kgToLb(kg);
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${sign}${Math.abs(v).toFixed(1)} ${units === "metric" ? "kg" : "lb"}`;
}

/** Signed weekly weight rate for cycle targets, e.g. '−0.5 kg/wk' / '−1.1 lb/wk'. Null → '—'. */
export function formatWeightRate(
  kgPerWeek: number | null | undefined,
  units: UnitSystem,
): string {
  if (kgPerWeek == null) return "—";
  const v = units === "metric" ? kgPerWeek : kgToLb(kgPerWeek);
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${sign}${Number.parseFloat(Math.abs(v).toFixed(2))} ${units === "metric" ? "kg" : "lb"}/wk`;
}

/** Weekly rate for an input field in the user's units, e.g. -0.5 kg/wk → '-0.5' / '-1.1'. */
export function rateToInput(kgPerWeek: number, units: UnitSystem): string {
  const v = units === "metric" ? kgPerWeek : kgToLb(kgPerWeek);
  return String(Number.parseFloat(v.toFixed(2)));
}

/** Parse a user-entered weekly rate back to kg/wk. Sign kept; empty/NaN → null. */
export function rateFromInput(v: string, units: UnitSystem): number | null {
  const n = Number.parseFloat(v);
  if (!Number.isFinite(n)) return null;
  return units === "metric" ? n : lbToKg(n);
}

/** Rate bound in the user's units, rounded down to one decimal so the shown bound is itself valid. */
export function rateLimitInput(
  maxKgPerWeek: number,
  units: UnitSystem,
): number {
  const v = units === "metric" ? maxKgPerWeek : kgToLb(maxKgPerWeek);
  return Math.floor(v * 10) / 10;
}

export function weightToInput(
  kg: number | null | undefined,
  units: UnitSystem,
): string {
  if (kg == null) return "";
  return units === "metric" ? kg.toFixed(1) : kgToLb(kg).toFixed(1);
}

export function lengthToInput(
  cm: number | null | undefined,
  units: UnitSystem,
): string {
  if (cm == null) return "";
  return units === "metric" ? cm.toFixed(1) : cmToIn(cm).toFixed(1);
}

/** Parse a user-entered weight back to kg. Empty/NaN → null. */
export function weightFromInput(v: string, units: UnitSystem): number | null {
  const n = Number.parseFloat(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return units === "metric" ? n : lbToKg(n);
}

export function lengthFromInput(v: string, units: UnitSystem): number | null {
  const n = Number.parseFloat(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return units === "metric" ? n : inToCm(n);
}

/** Waist-to-weight heuristic note: weight dropping much faster than waist ⇒ lean-mass risk. */
export function leanMassRisk(
  weightDeltaKgPerWeek: number,
  waistDeltaCmPerWeek: number,
): boolean {
  // Heuristic, not medical advice: >0.7 kg/wk loss with near-flat waist (<0.15 cm/wk)
  return weightDeltaKgPerWeek < -0.7 && waistDeltaCmPerWeek > -0.15;
}

export const MEASUREMENT_FIELDS = [
  "weightKg",
  "neckCm",
  "chestCm",
  "waistCm",
  "hipsCm",
  "armLeftCm",
  "armRightCm",
  "thighLeftCm",
  "thighRightCm",
  "calfCm",
] as const;

export type MeasurementField = (typeof MEASUREMENT_FIELDS)[number];

export const FIELD_LABELS: Record<MeasurementField, string> = {
  weightKg: "Weight",
  neckCm: "Neck",
  chestCm: "Chest",
  waistCm: "Waist",
  hipsCm: "Hips",
  armLeftCm: "Arm L",
  armRightCm: "Arm R",
  thighLeftCm: "Thigh L",
  thighRightCm: "Thigh R",
  calfCm: "Calf",
};
