/**
 * Pure intake input validation (rule BR1: no I/O). Shared by the server
 * function layer so the rules can be unit-tested without a database.
 */

export type IntakeInput = {
  date: string;
  kcal: number;
  proteinG: number | null;
};

export const KCAL_MIN = 0;
export const KCAL_MAX = 20_000;
export const PROTEIN_MIN = 0;
export const PROTEIN_MAX = 600;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Canonical 'YYYY-MM-DD' that is also a real calendar date (UTC). */
export function isValidIntakeDate(date: string): boolean {
  if (!DATE_RE.test(date)) return false;
  const ms = Date.parse(`${date}T00:00:00Z`);
  if (!Number.isFinite(ms)) return false;
  return new Date(ms).toISOString().slice(0, 10) === date;
}

/**
 * Validate + normalise an intake upsert. Throws Error on any invalid field:
 * kcal integer 0..20000, proteinG integer 0..600 or null, canonical date.
 */
export function validateIntake(input: {
  date: unknown;
  kcal: unknown;
  proteinG?: unknown;
}): IntakeInput {
  if (typeof input.date !== "string" || !isValidIntakeDate(input.date)) {
    throw new Error("INVALID_DATE");
  }
  if (
    typeof input.kcal !== "number" ||
    !Number.isInteger(input.kcal) ||
    input.kcal < KCAL_MIN ||
    input.kcal > KCAL_MAX
  ) {
    throw new Error("INVALID_KCAL");
  }
  if (input.proteinG !== null && input.proteinG !== undefined) {
    if (
      typeof input.proteinG !== "number" ||
      !Number.isInteger(input.proteinG) ||
      input.proteinG < PROTEIN_MIN ||
      input.proteinG > PROTEIN_MAX
    ) {
      throw new Error("INVALID_PROTEIN");
    }
  }
  return {
    date: input.date,
    kcal: input.kcal,
    proteinG: input.proteinG ?? null,
  };
}
