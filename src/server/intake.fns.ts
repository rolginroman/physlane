import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { useDb } from "#/db/client";
import * as schema from "#/db/schema";
import { requireUser } from "./auth.fns";
import { computeTdee } from "#/lib/tdee";
import { shapeTdeeStatus } from "#/lib/band";
import {
  loadActiveCycle,
  loadIntakeContext,
  type ActiveCycleRow,
  type IntakeContext,
} from "./intake.core";
import { appError } from "#/lib/app-error";
import { isValidIntakeDate, validateIntake } from "#/lib/intake-logic";
import { intakeStreak, type Phase } from "#/lib/adherence";
import { detectReportingDrift, driftWindows } from "#/lib/drift";
import { weeklyRates } from "#/lib/lean-mass";
import {
  paceVerdict,
  projectWeight,
  PROJECTION_WEEKS,
  type PaceVerdict,
} from "#/lib/projection";

const GetOrCreateIntakeInputSchema = z.object({
  date: z.string(),
});

const UpsertIntakeInputSchema = z.object({
  date: z.string(),
  kcal: z.number(),
  proteinG: z.number().nullable().optional(),
});

const IntakeRangeInputSchema = z.object({
  from: z.string(),
  to: z.string(),
});

const FREE_HISTORY_DAYS = 90;
const PROJECTION_INTAKE_DAYS = 7; // "current intake" = avg of the last 7 logged days

export type DailyIntakeDTO = {
  date: string; // canonical 'YYYY-MM-DD'
  kcal: number | null;
  proteinG: number | null;
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

export type TdeeStatusResult = import("#/lib/band").TdeeStatusPayload;
export type TargetPromptPayload = import("#/lib/band").TargetPromptPayload;

const toDTO = (r: schema.DailyIntake): DailyIntakeDTO => ({
  date: r.date,
  kcal: r.kcal,
  proteinG: r.proteinG,
});

/** Canonical UTC 'YYYY-MM-DD' for a Date/epoch-ms. */
const toDate = (d: Date): string => d.toISOString().slice(0, 10);

/** Existing row for the date, or a transient default — nothing is inserted here. */
export const getOrCreateIntake = createServerFn({ method: "GET" })
  .validator((d) => GetOrCreateIntakeInputSchema.parse(d))
  .handler(async ({ data }) => {
    const me = await requireUser();
    if (!isValidIntakeDate(data.date)) throw appError("INVALID_DATE");
    const [row] = await useDb()
      .select()
      .from(schema.dailyIntake)
      .where(
        and(
          eq(schema.dailyIntake.userId, me.id),
          eq(schema.dailyIntake.date, data.date),
        ),
      )
      .limit(1);
    return row ? toDTO(row) : { date: data.date, kcal: null, proteinG: null };
  });

/** Insert-or-update the user's row for a date (I5: one row per user-date, idempotent). */
export const upsertIntake = createServerFn({ method: "POST" })
  .validator((d) => UpsertIntakeInputSchema.parse(d))
  .handler(async ({ data }) => {
    const me = await requireUser();
    const v = validateIntake(data);
    const now = new Date();
    await useDb()
      .insert(schema.dailyIntake)
      .values({
        id: crypto.randomUUID(),
        userId: me.id,
        date: v.date,
        kcal: v.kcal,
        proteinG: v.proteinG,
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [schema.dailyIntake.userId, schema.dailyIntake.date],
        set: { kcal: v.kcal, proteinG: v.proteinG, updatedAt: now },
      });
    return { ok: true };
  });

/** Intake history ascending. Free plan: `from` clamped to 90 days back (F12). */
export const intakeRange = createServerFn({ method: "GET" })
  .validator((d) => IntakeRangeInputSchema.parse(d))
  .handler(async ({ data }) => {
    const me = await requireUser();
    if (!isValidIntakeDate(data.from) || !isValidIntakeDate(data.to))
      throw appError("INVALID_DATE");
    // Canonical dates sort lexicographically, so clamping is max(from, now-90d).
    const freeFloor = toDate(
      new Date(Date.now() - FREE_HISTORY_DAYS * 86_400_000),
    );
    const from =
      me.plan === "pro" || data.from > freeFloor ? data.from : freeFloor;
    const rows = await useDb()
      .select()
      .from(schema.dailyIntake)
      .where(
        and(
          eq(schema.dailyIntake.userId, me.id),
          gte(schema.dailyIntake.date, from),
          lte(schema.dailyIntake.date, data.to),
        ),
      )
      .orderBy(asc(schema.dailyIntake.date));
    return rows.map(toDTO);
  });

/**
 * TDEE pipeline state: intake kcal joined with same-day measurement weights.
 * Free users get status + pair count + the confidence band but never the
 * estimate numbers; the gate itself lives in the pure shaper (src/lib/band.ts).
 */
export const tdeeStatus = createServerFn({ method: "GET" }).handler(
  async () => {
    const me = await requireUser();
    const ctx = await loadIntakeContext(me.id);
    const result = computeTdee(ctx.entries);
    const activeCycle = await loadActiveCycle(me.id);

    // Drift detector consumes the same paired series, anchored at the newest
    // logged day; burn must be ready or there is nothing to diverge from.
    const lastDay = ctx.entries.at(-1)?.date;
    const drift =
      result.status === "ready" && lastDay != null
        ? detectReportingDrift(
            result.weeklyEstimates,
            driftWindows(ctx.entries, lastDay) ?? [],
          )
        : null;

    const projection =
      me.plan === "pro" && result.status === "ready"
        ? buildProjection(ctx, result.kcal, activeCycle)
        : null;

    return shapeTdeeStatus(result, {
      plan: me.plan,
      projection,
      drift,
      prompt: {
        targetKcalPerDay: activeCycle?.kcalTargetPerDay ?? null,
        state: {
          lastAppliedAt: me.targetPromptLastAppliedAt,
          lastDismissedAt: me.targetPromptLastDismissedAt,
          appliedKcal: me.targetPromptAppliedKcal,
        },
        now: new Date(),
      },
    });
  },
);

/**
 * F11 (Pro): 4-week weight projection at current intake plus the
 * observed-trend-vs-target verdict. Composes the rows tdeeStatus already
 * fetched; the active cycle is passed in.
 */
function buildProjection(
  ctx: IntakeContext,
  tdeeKcal: number,
  activeCycle: ActiveCycleRow,
): ProjectionDTO | null {
  const { intakeRows, measurementRows } = ctx;

  // "Current intake": average of the last 7 logged days.
  const loggedKcal = intakeRows
    .filter((r) => r.kcal != null)
    .slice(-PROJECTION_INTAKE_DAYS)
    .map((r) => r.kcal as number);
  const avgIntakeKcal =
    loggedKcal.length > 0
      ? Math.round(loggedKcal.reduce((s, k) => s + k, 0) / loggedKcal.length)
      : null;

  // Latest weight in the series (rows are ascending).
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
  // Verdict the observed trend when measurable, else the intake-implied rate.
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

/**
 * Consecutive-day intake logging streak (F17), ending today. An unlogged
 * today does not break it: the grace lives in the pure fn, not here.
 */
export const getIntakeStreak = createServerFn({ method: "GET" }).handler(
  async () => {
    const me = await requireUser();
    const rows = await useDb()
      .select({ date: schema.dailyIntake.date })
      .from(schema.dailyIntake)
      .where(eq(schema.dailyIntake.userId, me.id));
    return {
      streak: intakeStreak(
        rows.map((r) => r.date),
        toDate(new Date()),
      ),
    };
  },
);
