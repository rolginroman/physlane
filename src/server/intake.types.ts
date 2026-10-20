import type { TdeeEntry } from "#/lib/tdee";
import type { PaceVerdict } from "#/lib/projection";
import type { Phase } from "#/lib/adherence";

export type DailyIntakeDTO = {
  date: string; // canonical 'YYYY-MM-DD'
  kcal: number | null;
  proteinG: number | null;
};

export type IntakeInput = {
  date: string;
  kcal: number;
  proteinG?: number | null;
};

/** F11 projection + verdict (Pro only). All math lives in #/lib/projection. */
export type ProjectionDTO = {
  currentWeightKg: number;
  avgIntakeKcal: number;
  impliedRateKgPerWeek: number;
  projectedDeltaKg4w: number;
  projectedWeightKg4w: number;
  observedRateKgPerWeek: number | null;
  targetRateKgPerWeek: number | null;
  phase: Phase | null;
  verdict: PaceVerdict | null;
};

export type IntakeContext = {
  /** Intake kcal joined with same-day measurement weights, ascending. */
  entries: TdeeEntry[];
  intakeRows: Array<{ date: string; kcal: number | null }>;
  measurementRows: Array<{ takenAt: Date; weightKg: number | null }>;
};

export type ActiveCycleRow = {
  phase: "cut" | "bulk" | "maintain";
  targetRateKgPerWeek: number | null;
  kcalTargetPerDay: number | null;
} | null;
