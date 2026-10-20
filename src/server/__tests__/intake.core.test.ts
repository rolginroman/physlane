import { describe, expect, it } from "vitest";
import { buildIntakeProjection, freeHistoryFloor } from "../intake.core";

const baseCycle = {
  phase: "cut" as const,
  targetRateKgPerWeek: -0.5,
  kcalTargetPerDay: 2200,
};

describe("freeHistoryFloor", () => {
  const pinnedNow = new Date("2026-10-20T12:00:00.000Z");

  it("clamps free plan when from is older than the floor", () => {
    expect(
      freeHistoryFloor({
        plan: "free",
        from: "2020-01-01",
        now: pinnedNow,
      }),
    ).toBe("2026-07-22");
  });

  it("keeps from unchanged for pro plan", () => {
    expect(
      freeHistoryFloor({
        plan: "pro",
        from: "2020-01-01",
        now: pinnedNow,
      }),
    ).toBe("2020-01-01");
  });

  it("keeps recent from for free plan when above the floor", () => {
    expect(
      freeHistoryFloor({
        plan: "free",
        from: "2026-10-01",
        now: pinnedNow,
      }),
    ).toBe("2026-10-01");
  });

  it("computes the floor from pinned now", () => {
    const floorOnly = freeHistoryFloor({
      plan: "free",
      from: "1900-01-01",
      now: pinnedNow,
    });
    expect(floorOnly).toBe("2026-07-22");
  });
});

describe("buildIntakeProjection", () => {
  it("uses the latest non-null weight in ascending measurement rows", () => {
    const projection = buildIntakeProjection({
      intakeRows: [{ date: "2026-10-01", kcal: 2000 }],
      measurementRows: [
        { takenAt: new Date("2026-09-20T08:00:00Z"), weightKg: 82 },
        { takenAt: new Date("2026-09-25T08:00:00Z"), weightKg: null },
        { takenAt: new Date("2026-10-01T08:00:00Z"), weightKg: 79.5 },
      ],
      tdeeKcal: 2500,
      activeCycle: baseCycle,
    });
    expect(projection?.currentWeightKg).toBe(79.5);
    expect(projection?.avgIntakeKcal).toBe(2000);
  });

  it("returns null when no logged intake days exist for the avg window", () => {
    const projection = buildIntakeProjection({
      intakeRows: [
        { date: "2026-10-01", kcal: null },
        { date: "2026-10-02", kcal: null },
      ],
      measurementRows: [
        { takenAt: new Date("2026-10-01T08:00:00Z"), weightKg: 80 },
      ],
      tdeeKcal: 2500,
      activeCycle: baseCycle,
    });
    expect(projection).toBeNull();
  });

  it("returns null when projectWeight rejects non-finite TDEE", () => {
    const projection = buildIntakeProjection({
      intakeRows: [{ date: "2026-10-01", kcal: 2000 }],
      measurementRows: [
        { takenAt: new Date("2026-10-01T08:00:00Z"), weightKg: 80 },
      ],
      tdeeKcal: Number.NaN,
      activeCycle: baseCycle,
    });
    expect(projection).toBeNull();
  });
});
