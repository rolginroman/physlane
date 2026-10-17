/** Unit conversion helpers. Canonical storage: kg + cm. */

export type UnitSystem = "metric" | "imperial";

const LB_PER_KG = 2.2046226218;
const CM_PER_IN = 2.54;

export const kgToLb = (kg: number) => kg * LB_PER_KG;
export const lbToKg = (lb: number) => lb / LB_PER_KG;
export const cmToIn = (cm: number) => cm / CM_PER_IN;
export const inToCm = (inch: number) => inch * CM_PER_IN;

export function fmtWeight(kg: number | null | undefined, units: UnitSystem): string {
	if (kg == null) return "—";
	return units === "metric" ? `${kg.toFixed(1)} kg` : `${kgToLb(kg).toFixed(1)} lb`;
}

export function fmtLength(cm: number | null | undefined, units: UnitSystem): string {
	if (cm == null) return "—";
	return units === "metric" ? `${cm.toFixed(1)} cm` : `${cmToIn(cm).toFixed(1)} in`;
}

/** Girth display, e.g. '85.0 cm' / '33.5 in'. Same contract as fmtLength. */
export const formatGirth = fmtLength;

/** Signed girth delta for history rows, e.g. '+0.4 cm' / '−1.2 in'. */
export function formatGirthDelta(cm: number | null | undefined, units: UnitSystem): string {
	if (cm == null) return "";
	const v = units === "metric" ? cm : cmToIn(cm);
	const sign = v > 0 ? "+" : v < 0 ? "−" : "";
	return `${sign}${Math.abs(v).toFixed(1)} ${units === "metric" ? "cm" : "in"}`;
}

/** Signed weight delta for history rows, e.g. '+0.4 kg' / '−1.2 lb'. */
export function formatWeightDelta(kg: number | null | undefined, units: UnitSystem): string {
	if (kg == null) return "";
	const v = units === "metric" ? kg : kgToLb(kg);
	const sign = v > 0 ? "+" : v < 0 ? "−" : "";
	return `${sign}${Math.abs(v).toFixed(1)} ${units === "metric" ? "kg" : "lb"}`;
}

export function weightToInput(kg: number | null | undefined, units: UnitSystem): string {
	if (kg == null) return "";
	return units === "metric" ? kg.toFixed(1) : kgToLb(kg).toFixed(1);
}

export function lengthToInput(cm: number | null | undefined, units: UnitSystem): string {
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
