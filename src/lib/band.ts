/**
 * TDEE confidence band — pure width math (G1.1).
 *
 * Rule: no kcal value inside this module, widths only. The band schedule is
 * linear in complete-pair count between two clamps: wide ±400 kcal at <=3
 * pairs, tight ±80 kcal at >=14 pairs. When the estimator's measured spread
 * is wider than the schedule, the spread wins (data outranks the schedule)
 * but never widens past the wide clamp. Confidence is how far the band has
 * narrowed from wide to tight: 0 at the wide clamp, 1 at the tight clamp.
 */

import type { TdeeResult, WeeklyEstimate } from "./tdee";
import type { TargetPromptState } from "./target-prompt";
import { targetPromptEligible } from "./target-prompt";
import type { DriftSignal } from "./drift";
import type { ProjectionDTO } from "#/server/intake.fns";

export type ConfidenceBand = {
  /** 0..1, how tight the band has narrowed. Never negative, never >1. */
  confidence: number;
  /** ± width in kcal, rounded to 10s. Clamped to [80, 400]. */
  bandKcal: number;
};

const WIDE_KCAL = 400;
const TIGHT_KCAL = 80;
const WIDE_PAIRS = 3;
const TIGHT_PAIRS = 14;

export function estimateBand(
  pairs: number,
  spreadKcal?: number | null,
): ConfidenceBand {
  const n = Number.isFinite(pairs) ? Math.max(0, Math.floor(pairs)) : 0;
  const t = Math.min(
    1,
    Math.max(0, (n - WIDE_PAIRS) / (TIGHT_PAIRS - WIDE_PAIRS)),
  );
  let band = WIDE_KCAL + t * (TIGHT_KCAL - WIDE_KCAL);
  // Spread-informed: a wider measured dispersion outranks the schedule, but
  // a calmer one never narrows below what the sample size promises.
  if (spreadKcal != null && Number.isFinite(spreadKcal)) {
    band = Math.max(band, Math.min(WIDE_KCAL, spreadKcal));
  }
  const bandKcal = Math.round(band / 10) * 10;
  const confidence = Math.min(
    1,
    Math.max(0, (WIDE_KCAL - bandKcal) / (WIDE_KCAL - TIGHT_KCAL)),
  );
  return { confidence, bandKcal };
}

/** Days of logging left until the band reaches the tight clamp. */
export function daysToTight(pairs: number): number {
  const n = Number.isFinite(pairs) ? Math.max(0, Math.floor(pairs)) : 0;
  return Math.max(0, TIGHT_PAIRS - n);
}

/**
 * Payload shaper for the tdeeStatus server fn (G1.2). One pure fn builds BOTH
 * plan payloads so the gate is structural, not copy-pasted: the free payload
 * keeps kcal/spread/weeklyEstimates/projection null and the prompt's measured
 * kcal null, while gaining confidence + bandKcal + prompt eligibility.
 */
export type TargetPromptPayload = {
  eligible: boolean;
  /** The measured burn the prompt would apply. Pro only, always null for free. */
  measuredKcal: number | null;
};

export type TdeeStatusPayload =
  | {
      status: "collecting";
      pairs: number;
      needed: 14;
      confidence: number;
      bandKcal: number;
    }
  | {
      status: "ready";
      gated: boolean;
      kcal: number | null;
      spreadKcal: number | null;
      confidence: number;
      bandKcal: number;
      pairs: number;
      weeklyEstimates: WeeklyEstimate[] | null;
      projection: ProjectionDTO | null;
      targetPrompt: TargetPromptPayload;
      /** Pro only: the reporting-drift signal with its kcal magnitude. Always null for free. */
      drift: DriftSignal;
      /** Both plans: whether the drift banner should show. Free copy carries no numbers. */
      driftFired: boolean;
    };

export function shapeTdeeStatus(
  result: TdeeResult,
  opts: {
    plan: "free" | "pro";
    projection: ProjectionDTO | null;
    prompt: {
      targetKcalPerDay: number | null;
      state: TargetPromptState;
      now: Date;
    };
    /** Reporting-drift signal computed server-side from the user's own series. */
    drift?: DriftSignal;
  },
): TdeeStatusPayload {
  if (result.status === "collecting") {
    const band = estimateBand(result.pairs);
    return { ...result, confidence: band.confidence, bandKcal: band.bandKcal };
  }

  const band = estimateBand(result.pairs, result.spreadKcal);
  const eligible = targetPromptEligible({
    measuredKcal: result.kcal,
    targetKcalPerDay: opts.prompt.targetKcalPerDay,
    state: opts.prompt.state,
    now: opts.prompt.now,
  });
  const drift = opts.drift ?? null;

  if (opts.plan === "pro") {
    return {
      status: "ready",
      gated: false,
      kcal: result.kcal,
      spreadKcal: result.spreadKcal,
      confidence: band.confidence,
      bandKcal: band.bandKcal,
      pairs: result.pairs,
      weeklyEstimates: result.weeklyEstimates,
      projection: opts.projection,
      targetPrompt: { eligible, measuredKcal: result.kcal },
      drift,
      driftFired: drift !== null,
    };
  }
  return {
    status: "ready",
    gated: true,
    kcal: null,
    spreadKcal: null,
    confidence: band.confidence,
    bandKcal: band.bandKcal,
    pairs: result.pairs,
    weeklyEstimates: null,
    projection: null,
    targetPrompt: { eligible, measuredKcal: null },
    drift: null,
    driftFired: drift !== null,
  };
}
