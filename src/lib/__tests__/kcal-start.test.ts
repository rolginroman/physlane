import { describe, expect, it } from "vitest";
import {
  estimateStartingKcal,
  maintenanceKcal,
  rateToDailyKcal,
} from "../kcal-start";

describe("maintenanceKcal", () => {
  it("scales body weight by sex-specific maintenance factors", () => {
    expect(maintenanceKcal(80, "male")).toBe(2640);
    expect(maintenanceKcal(80, "female")).toBe(2480);
    expect(maintenanceKcal(80, null)).toBe(2560);
  });
});

describe("rateToDailyKcal", () => {
  it("converts weekly kg to daily kcal (0.5 kg/wk = 550/day)", () => {
    expect(rateToDailyKcal(-0.5)).toBe(550);
    expect(rateToDailyKcal(0.25)).toBe(275);
  });
});

describe("estimateStartingKcal", () => {
  it("cut: 84 kg male, 0.5 kg/wk -> 2772 - 550 -> 2200", () => {
    expect(
      estimateStartingKcal({
        weightKg: 84,
        sex: "male",
        phase: "cut",
        targetRateKgPerWeek: -0.5,
      }),
    ).toBe(2200);
  });

  it("bulk: 70 kg unknown sex, 0.25 kg/wk -> 2240 + 275 -> 2500", () => {
    expect(
      estimateStartingKcal({
        weightKg: 70,
        sex: null,
        phase: "bulk",
        targetRateKgPerWeek: 0.25,
      }),
    ).toBe(2500);
  });

  it("maintain ignores rate", () => {
    expect(
      estimateStartingKcal({
        weightKg: 80,
        sex: "male",
        phase: "maintain",
        targetRateKgPerWeek: -0.5,
      }),
    ).toBe(2650);
  });

  it("rounds to nearest 50 (75 kg female -> 2325 -> 2350)", () => {
    expect(
      estimateStartingKcal({
        weightKg: 75,
        sex: "female",
        phase: "maintain",
        targetRateKgPerWeek: null,
      }),
    ).toBe(2350);
  });

  it("clamps to 800 floor and 6000 ceiling", () => {
    expect(
      estimateStartingKcal({
        weightKg: 40,
        sex: "female",
        phase: "cut",
        targetRateKgPerWeek: -1,
      }),
    ).toBe(800);
    expect(
      estimateStartingKcal({
        weightKg: 160,
        sex: "male",
        phase: "bulk",
        targetRateKgPerWeek: 1,
      }),
    ).toBe(6000);
  });

  it("returns null without usable weight", () => {
    expect(
      estimateStartingKcal({
        weightKg: null,
        sex: null,
        phase: "cut",
        targetRateKgPerWeek: -0.5,
      }),
    ).toBeNull();
    expect(
      estimateStartingKcal({
        weightKg: Number.NaN,
        sex: "male",
        phase: "cut",
        targetRateKgPerWeek: -0.5,
      }),
    ).toBeNull();
  });

  it("treats a missing rate as maintenance", () => {
    expect(
      estimateStartingKcal({
        weightKg: 100,
        sex: null,
        phase: "cut",
        targetRateKgPerWeek: null,
      }),
    ).toBe(3200);
  });
});
