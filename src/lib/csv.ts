/**
 * Pure CSV builders (RFC 4180). Canonical units: kg + cm + ISO dates.
 * No I/O — server fns in #/server/export.fns fetch rows and call these.
 */

export type MeasurementCsvRow = {
  takenAtIso: string;
  weightKg: number | null;
  neckCm: number | null;
  chestCm: number | null;
  waistCm: number | null;
  hipsCm: number | null;
  armLeftCm: number | null;
  armRightCm: number | null;
  thighLeftCm: number | null;
  thighRightCm: number | null;
  calfCm: number | null;
  notes: string | null;
};

export type IntakeCsvRow = {
  date: string; // canonical 'YYYY-MM-DD'
  kcal: number;
};

export const MEASUREMENTS_CSV_HEADER =
  "taken_at_iso,weight_kg,neck_cm,chest_cm,waist_cm,hips_cm,arm_left_cm,arm_right_cm,thigh_left_cm,thigh_right_cm,calf_cm,notes";

/**
 * RFC 4180 field: wrap in double quotes when it contains a comma, quote,
 * CR or LF; embedded quotes are doubled. Plain fields pass through.
 */
export function csvField(value: string): string {
  if (value === "") return "";
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Number cell: null/undefined → empty cell, finite numbers via String(). */
const numCell = (v: number | null | undefined): string =>
  v == null ? "" : String(v);

/** One row per measurement, canonical kg/cm values, notes RFC-4180-quoted. */
export function buildMeasurementsCsv(
  rows: readonly MeasurementCsvRow[],
): string {
  const lines = [MEASUREMENTS_CSV_HEADER];
  for (const r of rows) {
    lines.push(
      [
        csvField(r.takenAtIso),
        numCell(r.weightKg),
        numCell(r.neckCm),
        numCell(r.chestCm),
        numCell(r.waistCm),
        numCell(r.hipsCm),
        numCell(r.armLeftCm),
        numCell(r.armRightCm),
        numCell(r.thighLeftCm),
        numCell(r.thighRightCm),
        numCell(r.calfCm),
        csvField(r.notes ?? ""),
      ].join(","),
    );
  }
  return lines.join("\n");
}

/** One row per logged day. */
export function buildIntakeCsv(rows: readonly IntakeCsvRow[]): string {
  const lines = ["date_iso,kcal"];
  for (const r of rows) lines.push(`${csvField(r.date)},${numCell(r.kcal)}`);
  return lines.join("\n");
}
