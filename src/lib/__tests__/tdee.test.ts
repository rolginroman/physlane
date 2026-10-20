import { describe, expect, it } from "vitest";
import { computeTdee, type TdeeEntry } from "../tdee";

const DAY_MS = 86_400_000;

/** n days after start, as canonical 'YYYY-MM-DD'. */
const day = (start: string, n: number): string =>
  new Date(Date.parse(`${start}T00:00:00Z`) + n * DAY_MS)
    .toISOString()
    .slice(0, 10);

const series = (
  start: string,
  days: number,
  kcal: (d: number) => number,
  weight: (d: number) => number | null,
): TdeeEntry[] =>
  Array.from({ length: days }, (_, d) => ({
    date: day(start, d),
    kcal: kcal(d),
    weightKg: weight(d),
  }));

describe("computeTdee — synthetic anchors (±5%)", () => {
  it("maintenance: flat weight at constant 2800 kcal → 2800", () => {
    const entries = series(
      "2026-01-01",
      28,
      () => 2800,
      () => 80,
    );
    const result = computeTdee(entries);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.kcal).toBeGreaterThanOrEqual(2800 * 0.95);
    expect(result.kcal).toBeLessThanOrEqual(2800 * 1.05);
    expect(result.kcal).toBe(2800);
    expect(result.spreadKcal).toBe(0);
    expect(result.pairs).toBe(28);
  });

  it("gaining 0.5 kg/wk at 3000 kcal → ≈2450", () => {
    const entries = series(
      "2026-01-01",
      28,
      () => 3000,
      (d) => 80 + (0.5 * d) / 7,
    );
    const result = computeTdee(entries);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.kcal).toBeGreaterThanOrEqual(2450 * 0.95);
    expect(result.kcal).toBeLessThanOrEqual(2450 * 1.05);
    expect(result.kcal).toBe(2450);
  });

  it("losing 0.25 kg/wk at 2000 kcal → ≈2275", () => {
    const entries = series(
      "2026-01-01",
      28,
      () => 2000,
      (d) => 90 - (0.25 * d) / 7,
    );
    const result = computeTdee(entries);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    // 2000 + 0.25*1100 = 2275
    expect(result.kcal).toBeGreaterThanOrEqual(2275 * 0.95);
    expect(result.kcal).toBeLessThanOrEqual(2275 * 1.05);
  });
});

describe("computeTdee — collecting state", () => {
  it("returns collecting below 14 complete pairs", () => {
    const result = computeTdee(
      series(
        "2026-01-01",
        13,
        () => 2500,
        () => 80,
      ),
    );
    expect(result).toEqual({
      status: "collecting",
      pairs: 13,
      needed: 14,
      outliersRejected: 0,
    });
  });

  it("empty input → collecting with 0 pairs", () => {
    expect(computeTdee([])).toEqual({
      status: "collecting",
      pairs: 0,
      needed: 14,
      outliersRejected: 0,
    });
  });

  it("days without weight are not complete pairs", () => {
    // 20 logged days but only 10 with weight → 10 pairs.
    const entries = series(
      "2026-01-01",
      20,
      () => 2500,
      (d) => (d % 2 === 0 ? 80 : null),
    );
    expect(computeTdee(entries)).toEqual({
      status: "collecting",
      pairs: 10,
      needed: 14,
      outliersRejected: 0,
    });
  });

  it("exactly 14 complete pairs is enough", () => {
    const result = computeTdee(
      series(
        "2026-01-01",
        14,
        () => 2500,
        () => 80,
      ),
    );
    expect(result.status).toBe("ready");
  });
});

describe("computeTdee — spread & estimates", () => {
  it("ready result exposes a numeric spread and weekly estimates", () => {
    const entries = series(
      "2026-01-01",
      28,
      (d) => 2500 + (d % 7) * 40,
      () => 80,
    );
    const result = computeTdee(entries);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.spreadKcal).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(result.spreadKcal)).toBe(true);
    expect(result.weeklyEstimates.length).toBeGreaterThan(0);
    expect(result.weeklyEstimates[0]?.weekStart).toBe("2026-01-01");
    expect(Number.isFinite(result.weeklyEstimates[0]?.kcal)).toBe(true);
  });

  it("varying weekly intake yields a non-zero spread", () => {
    // Weeks alternate 2000 / 3000 kcal while weight stays flat.
    const entries = series(
      "2026-01-01",
      35,
      (d) => (Math.floor(d / 7) % 2 === 0 ? 2000 : 3000),
      () => 80,
    );
    const result = computeTdee(entries);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.spreadKcal).toBeGreaterThan(0);
  });
});

describe("computeTdee v2 — sparse windows (7–10 day spans)", () => {
  it("entries every 8 days still reach ready (was collecting in v1)", () => {
    const entries: TdeeEntry[] = Array.from({ length: 16 }, (_, d) => ({
      date: day("2026-01-01", d * 8),
      kcal: 2500,
      weightKg: 80,
    }));
    const result = computeTdee(entries);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.kcal).toBe(2500); // flat weight, constant intake
  });

  it("entries every 12 days exceed the tolerance → collecting", () => {
    const entries: TdeeEntry[] = Array.from({ length: 16 }, (_, d) => ({
      date: day("2026-01-01", d * 12),
      kcal: 2500,
      weightKg: 80,
    }));
    expect(computeTdee(entries)).toEqual({
      status: "collecting",
      pairs: 16,
      needed: 14,
      outliersRejected: 0,
    });
  });

  it("scattered missed days in a daily series keep windows alive", () => {
    // 24 days with days 5, 12, 18 missing entirely (no kcal, no weight).
    const entries = series(
      "2026-01-01",
      24,
      () => 2600,
      () => 80,
    ).filter((_, d) => d !== 5 && d !== 12 && d !== 18);
    const result = computeTdee(entries);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.pairs).toBe(21);
    expect(result.kcal).toBe(2600);
  });

  it("span is normalized per-week: gaining 0.5 kg/wk every 8 days → ≈2450 at 3000", () => {
    const entries: TdeeEntry[] = Array.from({ length: 16 }, (_, d) => ({
      date: day("2026-01-01", d * 8),
      kcal: 3000,
      weightKg: 80 + (0.5 * d * 8) / 7,
    }));
    const result = computeTdee(entries);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.kcal).toBeGreaterThanOrEqual(2450 * 0.95);
    expect(result.kcal).toBeLessThanOrEqual(2450 * 1.05);
  });
});

describe("computeTdee v2 — outlier rejection", () => {
  it("a +2.5 kg salt spike is interpolated away: estimate stays ≈2600", () => {
    const entries = series(
      "2026-01-01",
      21,
      () => 2600,
      (d) => (d === 10 ? 82.5 : 80),
    );
    const result = computeTdee(entries);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.outliersRejected).toBe(1);
    expect(result.pairs).toBe(21); // pair kept, weight interpolated
    expect(result.kcal).toBeGreaterThanOrEqual(2600 * 0.95);
    expect(result.kcal).toBeLessThanOrEqual(2600 * 1.05);
  });

  it("a −2 kg whoosh drop is interpolated away symmetrically", () => {
    const entries = series(
      "2026-01-01",
      21,
      () => 2600,
      (d) => (d === 9 ? 78 : 80),
    );
    const result = computeTdee(entries);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.outliersRejected).toBe(1);
    expect(result.kcal).toBe(2600);
  });

  it("steady steep loss is a trend, not a spike: never rejected", () => {
    // 0.3 kg/day sustained (2.1 kg/wk) — deltas identical, no opposite-sign signature.
    const entries = series(
      "2026-01-01",
      21,
      () => 2000,
      (d) => 90 - 0.3 * d,
    );
    const result = computeTdee(entries);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.outliersRejected).toBe(0);
    expect(result.pairs).toBe(21);
    // 2000 + 2.1 kg/wk × 1100 = 4310
    expect(result.kcal).toBeGreaterThanOrEqual(4310 * 0.95);
    expect(result.kcal).toBeLessThanOrEqual(4310 * 1.05);
  });

  it("quiet noisy series rejects nothing", () => {
    const entries = series(
      "2026-01-01",
      21,
      () => 2600,
      (d) => 80 + (d % 2 === 0 ? 0.1 : -0.1),
    );
    const result = computeTdee(entries);
    expect(result.status).toBe("ready");
    if (result.status !== "ready") return;
    expect(result.outliersRejected).toBe(0);
  });
});
