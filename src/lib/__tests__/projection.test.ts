import { describe, expect, it } from "vitest";
import {
  paceVerdict,
  projectWeight,
  verdictCopy,
  type PaceVerdictKind,
} from "../projection";
import type { Phase } from "../adherence";

describe("projectWeight — energy balance", () => {
  it("maintenance: intake equals burn → flat projection", () => {
    const p = projectWeight({
      currentWeightKg: 80,
      avgIntakeKcal: 2800,
      tdeeKcal: 2800,
    });
    expect(p).not.toBeNull();
    if (!p) return;
    expect(p.impliedRateKgPerWeek).toBe(0);
    expect(p.projectedDeltaKg).toBe(0);
    expect(p.projectedWeightKg).toBe(80);
  });

  it("500 kcal/day deficit → −0.4545 kg/wk, ≈−1.82 kg over the 4-week horizon", () => {
    const p = projectWeight({
      currentWeightKg: 80,
      avgIntakeKcal: 2300,
      tdeeKcal: 2800,
    });
    expect(p).not.toBeNull();
    if (!p) return;
    expect(p.impliedRateKgPerWeek).toBeCloseTo(-500 / 1100, 6);
    expect(p.projectedDeltaKg).toBeCloseTo((-500 / 1100) * 4, 6);
    expect(p.projectedWeightKg).toBeCloseTo(80 - (500 / 1100) * 4, 6);
  });

  it("500 kcal/day surplus → +0.4545 kg/wk", () => {
    const p = projectWeight({
      currentWeightKg: 90,
      avgIntakeKcal: 3300,
      tdeeKcal: 2800,
    });
    expect(p).not.toBeNull();
    if (!p) return;
    expect(p.impliedRateKgPerWeek).toBeCloseTo(500 / 1100, 6);
    expect(p.projectedWeightKg).toBeCloseTo(90 + (500 / 1100) * 4, 6);
  });

  it("weeks override scales the horizon; default is the 4-week F11 contract", () => {
    const one = projectWeight({
      currentWeightKg: 80,
      avgIntakeKcal: 2300,
      tdeeKcal: 2800,
      weeks: 1,
    });
    expect(one).not.toBeNull();
    if (one) expect(one.projectedDeltaKg).toBeCloseTo(-500 / 1100, 6);
  });

  it("non-finite inputs → null instead of a bogus projection", () => {
    expect(
      projectWeight({
        currentWeightKg: NaN,
        avgIntakeKcal: 2300,
        tdeeKcal: 2800,
      }),
    ).toBeNull();
    expect(
      projectWeight({
        currentWeightKg: 80,
        avgIntakeKcal: Infinity,
        tdeeKcal: 2800,
      }),
    ).toBeNull();
    expect(
      projectWeight({
        currentWeightKg: 80,
        avgIntakeKcal: 2300,
        tdeeKcal: NaN,
      }),
    ).toBeNull();
  });
});

describe("paceVerdict — signed rate vs target (±0.1 kg/wk default band)", () => {
  it("cut target −0.5: faster loss is too fast, slower loss too slow", () => {
    expect(
      paceVerdict({ actualRateKgPerWeek: -0.82, targetRateKgPerWeek: -0.5 })
        .kind,
    ).toBe("too-fast");
    expect(
      paceVerdict({ actualRateKgPerWeek: -0.2, targetRateKgPerWeek: -0.5 })
        .kind,
    ).toBe("too-slow");
    expect(
      paceVerdict({ actualRateKgPerWeek: -0.55, targetRateKgPerWeek: -0.5 })
        .kind,
    ).toBe("on-pace");
  });

  it("cut boundary: exactly target − tolerance stays on pace", () => {
    expect(
      paceVerdict({ actualRateKgPerWeek: -0.6, targetRateKgPerWeek: -0.5 })
        .kind,
    ).toBe("on-pace");
    expect(
      paceVerdict({
        actualRateKgPerWeek: -0.6 - 1e-9,
        targetRateKgPerWeek: -0.5,
      }).kind,
    ).toBe("too-fast");
  });

  it("bulk target +0.25: gaining past the band is too fast, under it too slow", () => {
    expect(
      paceVerdict({ actualRateKgPerWeek: 0.5, targetRateKgPerWeek: 0.25 }).kind,
    ).toBe("too-fast");
    expect(
      paceVerdict({ actualRateKgPerWeek: 0.05, targetRateKgPerWeek: 0.25 })
        .kind,
    ).toBe("too-slow");
    expect(
      paceVerdict({ actualRateKgPerWeek: 0.3, targetRateKgPerWeek: 0.25 }).kind,
    ).toBe("on-pace");
  });

  it("cut direction: gaining weight on a cut reads too slow", () => {
    expect(
      paceVerdict({ actualRateKgPerWeek: 0.2, targetRateKgPerWeek: -0.5 }).kind,
    ).toBe("too-slow");
  });

  it("maintain target 0: drift outside the band is flagged", () => {
    expect(
      paceVerdict({ actualRateKgPerWeek: 0.3, targetRateKgPerWeek: 0 }).kind,
    ).toBe("too-fast");
    expect(
      paceVerdict({ actualRateKgPerWeek: -0.3, targetRateKgPerWeek: 0 }).kind,
    ).toBe("too-slow");
    expect(
      paceVerdict({ actualRateKgPerWeek: 0.05, targetRateKgPerWeek: 0 }).kind,
    ).toBe("on-pace");
  });

  it("custom tolerance tightens the band", () => {
    const v = paceVerdict({
      actualRateKgPerWeek: -0.56,
      targetRateKgPerWeek: -0.5,
      toleranceKgPerWeek: 0.05,
    });
    expect(v.kind).toBe("too-fast");
  });

  it("echoes both rates for downstream copy", () => {
    const v = paceVerdict({
      actualRateKgPerWeek: -0.82,
      targetRateKgPerWeek: -0.5,
    });
    expect(v).toEqual({
      kind: "too-fast",
      actualRateKgPerWeek: -0.82,
      targetRateKgPerWeek: -0.5,
    });
  });
});

describe("verdictCopy — phase-aware, house tone", () => {
  const kinds: PaceVerdictKind[] = ["on-pace", "too-fast", "too-slow"];
  const phases: Phase[] = ["cut", "bulk", "maintain"];

  it("cut too-fast names the risk and the direction", () => {
    const c = verdictCopy(
      {
        kind: "too-fast",
        actualRateKgPerWeek: -0.82,
        targetRateKgPerWeek: -0.5,
      },
      "cut",
    );
    expect(c.headline).toContain("−0.82 kg/wk");
    expect(c.headline).toContain("cutting too fast");
    expect(c.body).toContain("Muscle-loss risk");
  });

  it("bulk too-fast flips to fat-gain framing", () => {
    const c = verdictCopy(
      {
        kind: "too-fast",
        actualRateKgPerWeek: 0.55,
        targetRateKgPerWeek: 0.25,
      },
      "bulk",
    );
    expect(c.headline).toContain("gaining too fast");
    expect(c.body).not.toBeNull();
  });

  it("on pace has no body line", () => {
    const c = verdictCopy(
      {
        kind: "on-pace",
        actualRateKgPerWeek: -0.48,
        targetRateKgPerWeek: -0.5,
      },
      "cut",
    );
    expect(c.headline).toContain("on pace");
    expect(c.body).toBeNull();
  });

  it("maintain speaks in drift, not pace", () => {
    const up = verdictCopy(
      { kind: "too-fast", actualRateKgPerWeek: 0.3, targetRateKgPerWeek: 0 },
      "maintain",
    );
    expect(up.headline).toContain("hold-steady");
    expect(up.headline).toContain("drifting up");
    const down = verdictCopy(
      { kind: "too-slow", actualRateKgPerWeek: -0.3, targetRateKgPerWeek: 0 },
      "maintain",
    );
    expect(down.headline).toContain("drifting down");
  });

  it("signed rates use the true minus sign, plus for gains", () => {
    expect(
      verdictCopy(
        {
          kind: "too-slow",
          actualRateKgPerWeek: -0.2,
          targetRateKgPerWeek: -0.5,
        },
        "cut",
      ).headline,
    ).toContain("−0.20 kg/wk");
    expect(
      verdictCopy(
        {
          kind: "too-slow",
          actualRateKgPerWeek: -0.2,
          targetRateKgPerWeek: -0.5,
        },
        "cut",
      ).headline,
    ).toContain("−0.50");
    expect(
      verdictCopy(
        {
          kind: "too-fast",
          actualRateKgPerWeek: 0.55,
          targetRateKgPerWeek: 0.25,
        },
        "bulk",
      ).headline,
    ).toContain("+0.55 kg/wk");
  });

  it("every kind × phase keeps the copy rules: no em dashes, no exclamation marks", () => {
    for (const kind of kinds) {
      for (const phase of phases) {
        const c = verdictCopy(
          { kind, actualRateKgPerWeek: 0.3, targetRateKgPerWeek: 0 },
          phase,
        );
        const all = `${c.headline} ${c.body ?? ""}`;
        expect(all).not.toMatch(/[—–]/);
        expect(all).not.toContain("!");
        expect(c.headline.length).toBeGreaterThan(0);
      }
    }
  });
});
