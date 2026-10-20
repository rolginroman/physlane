/**
 * Pure US Navy circumference body-fat estimate (G1.4). Inputs are centimetres
 * (canonical storage); output is `{ bfPercent }` rounded to 0.1, or null when
 * anything needed is missing or the estimate is not plausible.
 *
 * Unit convention: the published Hodgdon–Beckett (1984) coefficients below
 * (1.0324 / 0.19077 / 0.15456 male, 1.29579 / 0.35004 / 0.22100 female) were
 * fitted on CENTIMETRE measurements — calculators that accept inches convert
 * to cm first (× 2.54). Feeding inches straight into these coefficients
 * underestimates by ~6 points (the documented male anchor 180cm / neck 38 /
 * waist 85 gives ~16.1% in cm but only ~9.7% in inches), so this module
 * evaluates the formulas in cm and the test suite pins the cm/inch
 * equivalence. BR1: no I/O.
 */

export type Sex = "male" | "female";

export type NavyBodyFatInput = {
  sex: Sex | null | undefined;
  heightCm: number | null | undefined;
  neckCm: number | null | undefined;
  waistCm: number | null | undefined;
  /** required for female estimates; ignored for male */
  hipsCm?: number | null | undefined;
};

export type NavyBodyFatResult = { bfPercent: number };

const MIN_BF = 2;
const MAX_BF = 80;

/** Finite number or null. */
const fin = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

/** Siri (1956): body-fat percent from body density. */
function fromDensity(density: number): NavyBodyFatResult | null {
  if (!Number.isFinite(density) || density <= 0) return null;
  const bf = 495 / density - 450;
  if (!Number.isFinite(bf) || bf < MIN_BF || bf > MAX_BF) return null;
  return { bfPercent: Math.round(bf * 10) / 10 };
}

export function navyBodyFat(input: NavyBodyFatInput): NavyBodyFatResult | null {
  const heightCm = fin(input.heightCm);
  const neckCm = fin(input.neckCm);
  const waistCm = fin(input.waistCm);
  if (heightCm == null || heightCm <= 0) return null;
  if (neckCm == null || neckCm <= 0) return null;
  if (waistCm == null || waistCm <= 0) return null;

  if (input.sex === "male") {
    if (waistCm <= neckCm) return null; // log10 argument must be positive
    const density =
      1.0324 -
      0.19077 * Math.log10(waistCm - neckCm) +
      0.15456 * Math.log10(heightCm);
    return fromDensity(density);
  }

  if (input.sex === "female") {
    const hipsCm = fin(input.hipsCm);
    if (hipsCm == null || hipsCm <= 0) return null;
    if (waistCm + hipsCm <= neckCm) return null;
    const density =
      1.29579 -
      0.35004 * Math.log10(waistCm + hipsCm - neckCm) +
      0.221 * Math.log10(heightCm);
    return fromDensity(density);
  }

  return null; // unknown / missing sex
}
