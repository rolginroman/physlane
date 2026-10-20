import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { useDb, schema } from "#/db";
import type { TdeeEntry } from "#/lib/tdee";

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
