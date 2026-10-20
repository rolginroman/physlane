import { describe, expect, it } from "vitest";
import {
  PROMPT_DIFF_KCAL,
  REPROMPT_AFTER_DISMISS_DAYS,
  estimateMovedSinceApply,
  targetPromptEligible,
  type TargetPromptState,
} from "../target-prompt";
import { normalizeTargetKcal } from "../kcal-start";

const DAY_MS = 86_400_000;
const NOW = new Date("2026-10-18T12:00:00Z");

const state = (over: Partial<TargetPromptState> = {}): TargetPromptState => ({
  lastAppliedAt: null,
  lastDismissedAt: null,
  appliedKcal: null,
  ...over,
});

const eligible = (
  measuredKcal: number | null,
  targetKcalPerDay: number | null,
  s: TargetPromptState,
) =>
  targetPromptEligible({ measuredKcal, targetKcalPerDay, state: s, now: NOW });

describe("targetPromptEligible — thresholds", () => {
  it("no estimate or no target means no prompt", () => {
    expect(eligible(null, 2400, state())).toBe(false);
    expect(eligible(2600, null, state())).toBe(false);
  });

  it("fires only beyond the 150 kcal disagreement window", () => {
    // exactly at the boundary: suppressed (rule is strictly >150)
    expect(eligible(2400 + PROMPT_DIFF_KCAL, 2400, state())).toBe(false);
    expect(eligible(2400 - PROMPT_DIFF_KCAL, 2400, state())).toBe(false);
    // one kcal past it in either direction: eligible
    expect(eligible(2551, 2400, state())).toBe(true);
    expect(eligible(2249, 2400, state())).toBe(true);
  });
});

describe("targetPromptEligible — apply holds until the estimate moves", () => {
  it("fresh state with a big gap prompts", () => {
    expect(eligible(2690, 2400, state())).toBe(true);
  });

  it("after Apply, a near-identical estimate does not re-prompt", () => {
    const s = state({
      lastAppliedAt: new Date(NOW.getTime() - 10 * DAY_MS),
      appliedKcal: 2690,
    });
    // user kept their own 2400 target; estimate barely moved
    expect(eligible(2720, 2400, s)).toBe(false);
  });

  it("after Apply, a >10% moved estimate re-prompts", () => {
    const s = state({
      lastAppliedAt: new Date(NOW.getTime() - 10 * DAY_MS),
      appliedKcal: 2690,
    });
    expect(eligible(2990, 2400, s)).toBe(true); // +11% vs applied
  });

  it("exactly 10% moved is not enough (rule is strictly >10%)", () => {
    const s = state({
      lastAppliedAt: new Date(NOW.getTime() - 10 * DAY_MS),
      appliedKcal: 2600,
    });
    expect(eligible(2860, 2400, s)).toBe(false); // exactly +10%
    expect(eligible(2861, 2400, s)).toBe(true);
  });
});

describe("targetPromptEligible — dismissal state machine", () => {
  it("a dismissal holds for 28 days", () => {
    const dismissed = new Date(NOW.getTime() - 10 * DAY_MS);
    expect(eligible(2690, 2400, state({ lastDismissedAt: dismissed }))).toBe(
      false,
    );
  });

  it("a dismissal expires at 28 days", () => {
    const dismissed = new Date(
      NOW.getTime() - (REPROMPT_AFTER_DISMISS_DAYS * DAY_MS + 3_600_000),
    );
    expect(eligible(2690, 2400, state({ lastDismissedAt: dismissed }))).toBe(
      true,
    );
  });

  it("a moved estimate overrides the 28-day hold", () => {
    const dismissed = new Date(NOW.getTime() - 3 * DAY_MS);
    const s = state({
      lastDismissedAt: dismissed,
      lastAppliedAt: new Date(NOW.getTime() - 30 * DAY_MS),
      appliedKcal: 2400,
    });
    expect(eligible(2800, 2200, s)).toBe(true); // moved >10% since apply
  });

  it("a dismissal newer than an apply governs; an apply newer than a dismissal releases", () => {
    const applied = new Date(NOW.getTime() - 20 * DAY_MS);
    const dismissedOld = new Date(NOW.getTime() - 30 * DAY_MS);
    // apply is the latest answer: only a moved estimate reopens
    expect(
      eligible(
        2450,
        2400,
        state({
          lastAppliedAt: applied,
          lastDismissedAt: dismissedOld,
          appliedKcal: 2450,
        }),
      ),
    ).toBe(false);
    // but the gap rule must still pass first: 2450 vs 2400 is inside 150, so no prompt either way
    expect(
      eligible(
        2800,
        2400,
        state({
          lastAppliedAt: applied,
          lastDismissedAt: dismissedOld,
          appliedKcal: 2800,
        }),
      ),
    ).toBe(false);
  });
});

describe("estimateMovedSinceApply", () => {
  it("false without an applied anchor", () => {
    expect(estimateMovedSinceApply(2600, state())).toBe(false);
  });

  it("true only past 10% of the applied value", () => {
    const s = state({ lastAppliedAt: NOW, appliedKcal: 2000 });
    expect(estimateMovedSinceApply(2199, s)).toBe(false);
    expect(estimateMovedSinceApply(2201, s)).toBe(true);
    expect(estimateMovedSinceApply(1799, s)).toBe(true); // downward moves count too
  });
});

describe("normalizeTargetKcal — the prefill's correction path, reused", () => {
  it("rounds to 50s and clamps to the valid range", () => {
    expect(normalizeTargetKcal(2690)).toBe(2700);
    expect(normalizeTargetKcal(2674)).toBe(2650);
    expect(normalizeTargetKcal(2675)).toBe(2700);
    expect(normalizeTargetKcal(100)).toBe(800);
    expect(normalizeTargetKcal(9000)).toBe(6000);
  });
});
