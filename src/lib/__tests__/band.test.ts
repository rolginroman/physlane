import { describe, expect, it } from "vitest";
import { daysToTight, estimateBand, shapeTdeeStatus } from "../band";
import type { TdeeResult } from "../tdee";
import type { TargetPromptState } from "../target-prompt";

const freshState: TargetPromptState = {
  lastAppliedAt: null,
  lastDismissedAt: null,
  appliedKcal: null,
};

const readyResult = (
  over: Partial<Extract<TdeeResult, { status: "ready" }>> = {},
): Extract<TdeeResult, { status: "ready" }> => ({
  status: "ready",
  kcal: 2600,
  spreadKcal: 120,
  weeklyEstimates: [{ weekStart: "2026-01-01", kcal: 2600 }],
  pairs: 14,
  outliersRejected: 0,
  ...over,
});

describe("estimateBand — clamps", () => {
  it("wide ±400 at <=3 pairs, confidence 0", () => {
    for (const pairs of [0, 1, 2, 3]) {
      expect(estimateBand(pairs).bandKcal).toBe(400);
      expect(estimateBand(pairs).confidence).toBe(0);
    }
  });

  it("tight ±80 at >=14 pairs, confidence 1", () => {
    for (const pairs of [14, 20, 100]) {
      expect(estimateBand(pairs).bandKcal).toBe(80);
      expect(estimateBand(pairs).confidence).toBe(1);
    }
  });

  it("never returns a band or confidence outside bounds", () => {
    for (const pairs of [-5, 0, 3.7, 7, 13.9, 14, 50]) {
      const { bandKcal, confidence } = estimateBand(pairs);
      expect(bandKcal).toBeGreaterThanOrEqual(80);
      expect(bandKcal).toBeLessThanOrEqual(400);
      expect(confidence).toBeGreaterThanOrEqual(0);
      expect(confidence).toBeLessThanOrEqual(1);
    }
  });
});

describe("estimateBand — monotonic narrowing with pair count", () => {
  it("band never widens as pairs grow (no spread)", () => {
    let prev = Infinity;
    for (let pairs = 0; pairs <= 25; pairs++) {
      const { bandKcal } = estimateBand(pairs);
      expect(bandKcal).toBeLessThanOrEqual(prev);
      prev = bandKcal;
    }
  });

  it("confidence never falls as pairs grow", () => {
    let prev = -1;
    for (let pairs = 0; pairs <= 25; pairs++) {
      const { confidence } = estimateBand(pairs);
      expect(confidence).toBeGreaterThanOrEqual(prev);
      prev = confidence;
    }
  });

  it("still monotonic with a fixed spread (data widens, never narrows the schedule)", () => {
    let prev = Infinity;
    for (let pairs = 0; pairs <= 25; pairs++) {
      const { bandKcal } = estimateBand(pairs, 250);
      expect(bandKcal).toBeLessThanOrEqual(prev);
      prev = bandKcal;
    }
  });
});

describe("estimateBand — spread-informed", () => {
  it("a wider measured spread outranks the schedule", () => {
    expect(estimateBand(14, 300).bandKcal).toBe(300);
    // confidence honestly drops when the data is noisier than the schedule
    expect(estimateBand(14, 300).confidence).toBeCloseTo((400 - 300) / 320, 2);
  });

  it("spread never widens past the wide clamp", () => {
    expect(estimateBand(14, 999).bandKcal).toBe(400);
    expect(estimateBand(3, 999).confidence).toBe(0);
  });

  it("a calmer spread never narrows below the schedule", () => {
    expect(estimateBand(3, 40).bandKcal).toBe(400);
    expect(estimateBand(8, 40).bandKcal).toBe(estimateBand(8).bandKcal);
  });
});

describe("daysToTight", () => {
  it("counts down to 14 pairs", () => {
    expect(daysToTight(9)).toBe(5);
    expect(daysToTight(14)).toBe(0);
    expect(daysToTight(30)).toBe(0);
  });
});

describe("shapeTdeeStatus — gate leak-check", () => {
  const prompt = {
    targetKcalPerDay: 2400,
    state: freshState,
    now: new Date("2026-10-18T00:00:00Z"),
  };

  it("free ready payload: every kcal figure stays null, band fields arrive", () => {
    const payload = shapeTdeeStatus(readyResult(), {
      plan: "free",
      projection: null,
      prompt,
    });
    expect(payload.status).toBe("ready");
    if (payload.status !== "ready") return;
    expect(payload.gated).toBe(true);
    expect(payload.kcal).toBeNull();
    expect(payload.spreadKcal).toBeNull();
    expect(payload.weeklyEstimates).toBeNull();
    expect(payload.projection).toBeNull();
    expect(payload.targetPrompt.measuredKcal).toBeNull();
    // serialization must not smuggle the estimate anywhere either
    const json = JSON.stringify(payload);
    expect(json).not.toContain("2600");
    expect(typeof payload.confidence).toBe("number");
    expect(typeof payload.bandKcal).toBe("number");
  });

  it("pro ready payload: kcal plus the same band fields", () => {
    const payload = shapeTdeeStatus(readyResult(), {
      plan: "pro",
      projection: null,
      prompt,
    });
    if (payload.status !== "ready") throw new Error("expected ready");
    expect(payload.gated).toBe(false);
    expect(payload.kcal).toBe(2600);
    expect(payload.targetPrompt.measuredKcal).toBe(2600);
    expect(typeof payload.confidence).toBe("number");
    expect(typeof payload.bandKcal).toBe("number");
  });

  it("collecting payload carries confidence + bandKcal on both plans", () => {
    for (const plan of ["free", "pro"] as const) {
      const payload = shapeTdeeStatus(
        { status: "collecting", pairs: 6, needed: 14, outliersRejected: 0 },
        { plan, projection: null, prompt },
      );
      expect(payload.status).toBe("collecting");
      expect(payload.confidence).toBeGreaterThan(0);
      expect(payload.bandKcal).toBeLessThan(400);
    }
  });

  it("prompt eligibility flows through to both plans without leaking kcal to free", () => {
    // 2600 measured vs 2400 target = 200 kcal apart, fresh state: eligible
    const free = shapeTdeeStatus(readyResult(), {
      plan: "free",
      projection: null,
      prompt,
    });
    const pro = shapeTdeeStatus(readyResult(), {
      plan: "pro",
      projection: null,
      prompt,
    });
    if (free.status !== "ready" || pro.status !== "ready")
      throw new Error("expected ready");
    expect(free.targetPrompt.eligible).toBe(true);
    expect(free.targetPrompt.measuredKcal).toBeNull();
    expect(pro.targetPrompt.eligible).toBe(true);
  });

  it("drift is gated: free gets the fired flag only, Pro gets the signal", () => {
    const signal = { direction: "under" as const, impliedKcalPerDay: 523 };
    const free = shapeTdeeStatus(readyResult(), {
      plan: "free",
      projection: null,
      prompt,
      drift: signal,
    });
    const pro = shapeTdeeStatus(readyResult(), {
      plan: "pro",
      projection: null,
      prompt,
      drift: signal,
    });
    if (free.status !== "ready" || pro.status !== "ready")
      throw new Error("expected ready");
    expect(free.driftFired).toBe(true);
    expect(free.drift).toBeNull();
    expect(JSON.stringify(free)).not.toContain("523");
    expect(pro.driftFired).toBe(true);
    expect(pro.drift?.direction).toBe("under");
    expect(pro.drift?.impliedKcalPerDay).toBe(523);
  });

  it("no drift input means fired false on both plans", () => {
    const free = shapeTdeeStatus(readyResult(), {
      plan: "free",
      projection: null,
      prompt,
    });
    const pro = shapeTdeeStatus(readyResult(), {
      plan: "pro",
      projection: null,
      prompt,
    });
    if (free.status !== "ready" || pro.status !== "ready")
      throw new Error("expected ready");
    expect(free.driftFired).toBe(false);
    expect(pro.driftFired).toBe(false);
    expect(pro.drift).toBeNull();
  });
});
