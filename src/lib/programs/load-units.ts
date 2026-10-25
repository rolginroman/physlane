import { kgToLb, lbToKg, type UnitSystem } from "#/lib/units";

/** Stored kg value for a fresh kg load: 40 kg, or 90 lb for imperial authors. */
export function defaultKgLoad(units: UnitSystem): number {
  return units === "metric" ? 40 : lbToKg(90);
}

export function loadUnitLabel(units: UnitSystem): "kg" | "lb" {
  return units === "metric" ? "kg" : "lb";
}

/**
 * Canonical kg to the text shown in a load field. Shows 2 decimals of kg or
 * 1 of lb, finer than the 0.25 kg / 0.5 lb plate steps, so a typed value
 * survives kg -> lb -> kg unchanged.
 */
export function loadToInput(
  kg: number | null | undefined,
  units: UnitSystem,
): string {
  if (kg == null || !Number.isFinite(kg)) return "";
  const shown = units === "metric" ? kg : kgToLb(kg);
  return String(Number.parseFloat(shown.toFixed(units === "metric" ? 2 : 1)));
}

/**
 * Field text to canonical kg. Blank is null (field cleared); text that is not
 * a number is NaN so validation can name it. The kg value is not rounded.
 */
export function loadFromInput(text: string, units: UnitSystem): number | null {
  const trimmed = text.trim().replace(",", ".");
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n)) return Number.NaN;
  return units === "metric" ? n : lbToKg(n);
}
