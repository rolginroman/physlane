import { and, asc, desc, eq, gte, isNull, lte } from "drizzle-orm";
import { useDb } from "#/db/client";
import * as schema from "#/db/schema";
import { computeTdee } from "#/lib/tdee";
import type { TdeeStatusPayload } from "#/lib/band";
import { isValidIntakeDate, validateIntake } from "#/lib/intake-logic";
import { intakeStreak } from "#/lib/adherence";
import { appError } from "#/lib/app-error";
import { assembleTdeeStatusPayload } from "./intake.tdee-assembly";
import type { SessionUser } from "./auth.core";
import type { TdeeEntry } from "#/lib/tdee";
import type {
  ActiveCycleRow,
  DailyIntakeDTO,
  IntakeContext,
  IntakeInput,
} from "./intake.types";

export type {
  ActiveCycleRow,
  DailyIntakeDTO,
  IntakeContext,
  IntakeInput,
  ProjectionDTO,
} from "./intake.types";
export {
  buildIntakeProjection,
  PROJECTION_INTAKE_DAYS,
} from "./intake.tdee-assembly";

/** F12: free-plan intake history window (days). */
export const FREE_HISTORY_DAYS = 90;

/** Canonical UTC 'YYYY-MM-DD' for a Date/epoch-ms. */
const toDate = (d: Date): string => d.toISOString().slice(0, 10);

const toIntakeDTO = (r: schema.DailyIntake): DailyIntakeDTO => ({
  date: r.date,
  kcal: r.kcal,
  proteinG: r.proteinG,
});

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
 * Insert-or-update the user's intake row for a date (I5: one row per
 * user-date, idempotent). When `proteinG` is omitted the stored value is
 * preserved instead of nulled.
 */
export async function upsertIntakeForUser(
  user: SessionUser,
  input: IntakeInput,
): Promise<DailyIntakeDTO> {
  const v = validateIntake(
    input.proteinG === undefined
      ? { date: input.date, kcal: input.kcal }
      : input,
  );
  const now = new Date();
  const proteinOnInsert = input.proteinG === undefined ? null : v.proteinG;
  const updateSet: { kcal: number; updatedAt: Date; proteinG?: number | null } =
    {
      kcal: v.kcal,
      updatedAt: now,
    };
  if (input.proteinG !== undefined) {
    updateSet.proteinG = v.proteinG;
  }

  const [row] = await useDb()
    .insert(schema.dailyIntake)
    .values({
      id: crypto.randomUUID(),
      userId: user.id,
      date: v.date,
      kcal: v.kcal,
      proteinG: proteinOnInsert,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [schema.dailyIntake.userId, schema.dailyIntake.date],
      set: updateSet,
    })
    .returning();
  if (!row) {
    return { date: v.date, kcal: v.kcal, proteinG: proteinOnInsert };
  }
  return toIntakeDTO(row);
}

/** Intake history ascending. Free plan: `from` clamped to 90 days back (F12). */
export async function intakeRangeForUser(
  user: SessionUser,
  opts: { from?: string; to?: string },
): Promise<DailyIntakeDTO[]> {
  const fromRaw = opts.from ?? "";
  const toRaw = opts.to ?? "";
  if (!isValidIntakeDate(fromRaw) || !isValidIntakeDate(toRaw))
    throw appError("INVALID_DATE");
  const from = freeHistoryFloor({ plan: user.plan, from: fromRaw });
  const rows = await useDb()
    .select()
    .from(schema.dailyIntake)
    .where(
      and(
        eq(schema.dailyIntake.userId, user.id),
        gte(schema.dailyIntake.date, from),
        lte(schema.dailyIntake.date, toRaw),
      ),
    )
    .orderBy(asc(schema.dailyIntake.date));
  return rows.map(toIntakeDTO);
}

/**
 * TDEE pipeline state for one user: the same assembly the UI fns use, shared
 * with MCP `get_status`. Pro gating lives in the pure shaper (src/lib/band.ts).
 */
export async function buildTdeeStatusForUser(
  user: SessionUser,
): Promise<TdeeStatusPayload> {
  const ctx = await loadIntakeContext(user.id);
  const result = computeTdee(ctx.entries);
  const activeCycle = await loadActiveCycle(user.id);
  return assembleTdeeStatusPayload(user, ctx, result, activeCycle);
}

/** Consecutive-day intake logging streak (F17), ending today. */
export async function intakeStreakForUser(user: SessionUser): Promise<number> {
  const rows = await useDb()
    .select({ date: schema.dailyIntake.date })
    .from(schema.dailyIntake)
    .where(eq(schema.dailyIntake.userId, user.id));
  return intakeStreak(
    rows.map((r) => r.date),
    toDate(new Date()),
  );
}
