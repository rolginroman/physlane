import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { useDb } from "#/db/client";
import * as schema from "#/db/schema";
import type { Phase } from "#/lib/adherence";
import { weeklyRates } from "#/lib/lean-mass";
import {
  paceVerdict,
  projectWeight,
  PROJECTION_WEEKS,
  type PaceVerdict,
} from "#/lib/projection";
import type { TdeeEntry } from "#/lib/tdee";
import type { SessionUser } from "./auth.core";

/** "Current intake" window for F11 projection (avg of last N logged days). */
export const PROJECTION_INTAKE_DAYS = 7;

/** F12: free-plan intake history window (days). */
export const FREE_HISTORY_DAYS = 90;

/** F11 projection + verdict payload (Pro DTO field). */
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

/**
 * Plain (non-RPC) intake reads shared by server fns (core.ts pattern: never
 * call one createServerFn from another; compose these instead).
 */

export type IntakeContext = {
  /** Intake kcal joined with same-day measurement weights, ascending. */
  entries: TdeeEntry[];
  intakeRows: Array<{ date: string; kcal: number | null }>;
  measurementRows: Array<{ takenAt: Date; weightKg: number | null }>;
};

/** Canonical UTC 'YYYY-MM-DD' for a Date/epoch-ms. */
const toDate = (d: Date): string => d.toISOString().slice(0, 10);

/** Clamps range `from` for free users to the last {@link FREE_HISTORY_DAYS} days. */
export function freeHistoryFloor(args: {
  plan: SessionUser["plan"];
  from: string;
  now?: Date;
}): string {
  const now = args.now ?? new Date();
  // Canonical dates sort lexicographically, so clamping is max(from, now-90d).
  const freeFloor = toDate(
    new Date(now.getTime() - FREE_HISTORY_DAYS * 86_400_000),
  );
  return args.plan === "pro" || args.from > freeFloor ? args.from : freeFloor;
}

/**
 * Everything the TDEE pipeline needs in three indexed queries: intake rows,
 * measurement rows, and their same-day join as estimator entries.
 */
export async function loadIntakeContext(
  userId: string,
): Promise<IntakeContext> {
  const db = useDb();
  const intakeRows = await db
    .select({ date: schema.dailyIntake.date, kcal: schema.dailyIntake.kcal })
    .from(schema.dailyIntake)
    .where(eq(schema.dailyIntake.userId, userId));

  // Ascending so the last same-day measurement (latest) wins per date.
  const measurementRows = await db
    .select({
      takenAt: schema.measurements.takenAt,
      weightKg: schema.measurements.weightKg,
    })
    .from(schema.measurements)
    .where(eq(schema.measurements.userId, userId))
    .orderBy(asc(schema.measurements.takenAt));

  const byDate = new Map<string, TdeeEntry>();
  for (const r of intakeRows) {
    byDate.set(r.date, { date: r.date, kcal: r.kcal, weightKg: null });
  }
  for (const m of measurementRows) {
    if (m.weightKg === null) continue;
    const entry = byDate.get(toDate(m.takenAt));
    if (entry) entry.weightKg = m.weightKg; // same-day measurement = that date's weight
  }

  const entries = [...byDate.values()].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : 0,
  );
  return { entries, intakeRows, measurementRows };
}

export type ActiveCycleRow = {
  phase: "cut" | "bulk" | "maintain";
  targetRateKgPerWeek: number | null;
  kcalTargetPerDay: number | null;
} | null;

/** The user's open cycle (endDate null), latest startDate first. */
export async function loadActiveCycle(userId: string): Promise<ActiveCycleRow> {
  const db = useDb();
  const [row] = await db
    .select({
      phase: schema.cycles.phase,
      targetRateKgPerWeek: schema.cycles.targetRateKgPerWeek,
      kcalTargetPerDay: schema.cycles.kcalTargetPerDay,
    })
    .from(schema.cycles)
    .where(and(eq(schema.cycles.userId, userId), isNull(schema.cycles.endDate)))
    .orderBy(desc(schema.cycles.startDate))
    .limit(1);
  return row ?? null;
}

/**
 * F11 weight projection at current intake plus pace verdict. Pure composition
 * over intake/measurement series already loaded for TDEE.
 */
export function buildIntakeProjection(input: {
  intakeRows: Array<{ date: string; kcal: number | null }>;
  measurementRows: Array<{ takenAt: Date; weightKg: number | null }>;
  tdeeKcal: number;
  activeCycle: ActiveCycleRow;
  projectionIntakeDays?: number;
}): ProjectionDTO | null {
  const windowDays = input.projectionIntakeDays ?? PROJECTION_INTAKE_DAYS;
  const { intakeRows, measurementRows, tdeeKcal, activeCycle } = input;

  const loggedKcal = intakeRows
    .filter((r): r is { date: string; kcal: number } => r.kcal != null)
    .slice(-windowDays)
    .map((r) => r.kcal);
  const avgIntakeKcal =
    loggedKcal.length > 0
      ? Math.round(loggedKcal.reduce((s, k) => s + k, 0) / loggedKcal.length)
      : null;

  let currentWeightKg: number | null = null;
  for (const m of measurementRows) {
    if (m.weightKg !== null) currentWeightKg = m.weightKg;
  }

  const observedRateKgPerWeek = weeklyRates(
    measurementRows.map((m) => ({
      takenAt: m.takenAt.toISOString(),
      weightKg: m.weightKg,
      waistCm: null,
    })),
  ).weightKgPerWeek;

  if (avgIntakeKcal === null || currentWeightKg === null) return null;
  const proj = projectWeight({
    currentWeightKg,
    avgIntakeKcal,
    tdeeKcal,
    weeks: PROJECTION_WEEKS,
  });
  if (proj === null) return null;

  const targetRateKgPerWeek = activeCycle?.targetRateKgPerWeek ?? null;
  const verdictRateKgPerWeek =
    observedRateKgPerWeek ?? proj.impliedRateKgPerWeek;
  const verdict =
    targetRateKgPerWeek != null
      ? paceVerdict({
          actualRateKgPerWeek: verdictRateKgPerWeek,
          targetRateKgPerWeek,
        })
      : null;

  return {
    currentWeightKg,
    avgIntakeKcal,
    impliedRateKgPerWeek: proj.impliedRateKgPerWeek,
    projectedDeltaKg4w: proj.projectedDeltaKg,
    projectedWeightKg4w: proj.projectedWeightKg,
    observedRateKgPerWeek,
    targetRateKgPerWeek,
    phase: activeCycle?.phase ?? null,
    verdict,
  };
}
