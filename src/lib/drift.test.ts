import { describe, expect, it } from "vitest";
import {
  detectReportingDrift,
  driftWindows,
  type DriftDay,
  type DriftWindow,
} from "./drift";

// Anchor series: 8 flat weekly estimates at 2600 (the honest history).
const weekly = Array.from({ length: 8 }, (_, i) => ({
  weekStart: `w${i}`,
  kcal: 2600,
}));

// Windows live in the recent two weeks, after the anchor period.
// Scale-implied deficit = −rate × 1100; log-implied deficit = 2600 − reported.
const win = (reported: number, rateKgPerWeek: number): DriftWindow => ({
  avgReportedKcal: reported,
  rateKgPerWeek,
});

describe("detectReportingDrift", () => {
  it("fires under when the scale says a bigger deficit than the logs, two weeks", () => {
    // implied 660 vs logged 100 → gap 560; implied 605 vs logged 120 → gap 485
    const signal = detectReportingDrift(weekly, [
      win(2500, -0.6),
      win(2480, -0.55),
    ]);
    expect(signal).not.toBeNull();
    expect(signal?.direction).toBe("under");
    expect(signal?.impliedKcalPerDay).toBe(Math.round((560 + 485) / 2)); // 523
  });

  it("stays quiet on an honest big cut: logs admit the deficit", () => {
    // implied 605 vs logged 600 → gap 5, far under threshold 390
    expect(
      detectReportingDrift(weekly, [win(2000, -0.55), win(2000, -0.55)]),
    ).toBeNull();
  });

  it("stays quiet when only one of two windows shows the signature", () => {
    expect(
      detectReportingDrift(weekly, [win(2500, -0.6), win(2590, 0)]),
    ).toBeNull();
  });

  it("fires over when the scale says a bigger surplus than the logs", () => {
    // implied surplus 770 vs logged surplus 150 → gap 620
    const signal = detectReportingDrift(weekly, [
      win(2750, 0.7),
      win(2750, 0.7),
    ]);
    expect(signal?.direction).toBe("over");
    expect(signal?.impliedKcalPerDay).toBe(620);
  });

  it("mixed directions across the two windows cancel", () => {
    expect(
      detectReportingDrift(weekly, [win(2500, -0.6), win(2750, 0.7)]),
    ).toBeNull();
  });

  it("needs at least two windows and a real anchor", () => {
    expect(detectReportingDrift(weekly, [win(2500, -0.6)])).toBeNull();
    expect(detectReportingDrift(weekly, [])).toBeNull();
    // Only 4 weekly estimates → 2 remain for the anchor: below the minimum of 3.
    expect(
      detectReportingDrift(weekly.slice(4), [win(2500, -0.6), win(2500, -0.6)]),
    ).toBeNull();
  });

  it("small mismatch below 15% of the anchor stays quiet", () => {
    // implied 220 vs logged 50 → gap 170 < 390
    expect(
      detectReportingDrift(weekly, [win(2550, -0.2), win(2550, -0.2)]),
    ).toBeNull();
  });
});

describe("driftWindows", () => {
  const DAY_MS = 86_400_000;
  const day = (start: string, n: number): string =>
    new Date(Date.parse(`${start}T00:00:00Z`) + n * DAY_MS)
      .toISOString()
      .slice(0, 10);
  const START = "2026-01-01";

  const days = (
    weight: (i: number) => number | null,
    kcal = 2500,
  ): DriftDay[] =>
    Array.from({ length: 14 }, (_, i) => ({
      date: day(START, i),
      kcal,
      weightKg: weight(i),
    }));

  it("builds two consecutive windows from a complete 14-day series", () => {
    const windows = driftWindows(
      days(() => 80),
      day(START, 13),
    );
    expect(windows).not.toBeNull();
    expect(windows).toHaveLength(2);
    expect(windows?.[0].avgReportedKcal).toBe(2500);
    expect(windows?.[0].rateKgPerWeek).toBeCloseTo(0, 6);
    expect(windows?.[1].rateKgPerWeek).toBeCloseTo(0, 6);
  });

  it("normalizes weight change per-week inside each half", () => {
    // First week flat, second week loses 0.1 kg/day (0.7 kg/wk).
    const windows = driftWindows(
      days((i) => (i < 7 ? 80 : 80 - 0.1 * (i - 7))),
      day(START, 13),
    );
    expect(windows?.[0].rateKgPerWeek).toBeCloseTo(0, 6);
    expect(windows?.[1].rateKgPerWeek).toBeCloseTo(-0.7, 6);
  });

  it("returns null when a half lacks two weights", () => {
    const noSecondHalfWeights = days((i) =>
      i < 7 ? 80 : i === 7 ? 79.9 : null,
    );
    expect(driftWindows(noSecondHalfWeights, day(START, 13))).toBeNull();
  });

  it("returns null when weights sit too close to span a rate", () => {
    const adjacent = days((i) => (i === 6 || i === 7 ? 80 : null));
    expect(driftWindows(adjacent, day(START, 13))).toBeNull();
  });
});
