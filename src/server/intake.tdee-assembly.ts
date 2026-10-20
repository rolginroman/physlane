import { shapeTdeeStatus, type TdeeStatusPayload } from "#/lib/band";
import { detectReportingDrift, driftWindows } from "#/lib/drift";
import { weeklyRates } from "#/lib/lean-mass";
import { paceVerdict, projectWeight, PROJECTION_WEEKS } from "#/lib/projection";
import type { TdeeResult } from "#/lib/tdee";
import type { SessionUser } from "./auth.core";
import type {
  ActiveCycleRow,
  IntakeContext,
  ProjectionDTO,
} from "./intake.types";

/** "Current intake" window for F11 projection (avg of last N logged days). */
export const PROJECTION_INTAKE_DAYS = 7;

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

/** Pure TDEE status assembly — routes through shapeTdeeStatus (Pro gate lives there). */
export function assembleTdeeStatusPayload(
  user: SessionUser,
  ctx: IntakeContext,
  result: TdeeResult,
  activeCycle: ActiveCycleRow,
  now: Date = new Date(),
): TdeeStatusPayload {
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
    user.plan === "pro" && result.status === "ready"
      ? buildIntakeProjection({
          intakeRows: ctx.intakeRows,
          measurementRows: ctx.measurementRows,
          tdeeKcal: result.kcal,
          activeCycle,
        })
      : null;

  return shapeTdeeStatus(result, {
    plan: user.plan,
    projection,
    drift,
    prompt: {
      targetKcalPerDay: activeCycle?.kcalTargetPerDay ?? null,
      state: {
        lastAppliedAt: user.targetPromptLastAppliedAt,
        lastDismissedAt: user.targetPromptLastDismissedAt,
        appliedKcal: user.targetPromptAppliedKcal,
      },
      now,
    },
  });
}
