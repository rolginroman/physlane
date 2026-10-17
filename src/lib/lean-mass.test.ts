import { describe, expect, it } from "vitest";
import { leanMassStatus, weeklyRates, type RateSample } from "./lean-mass";

const DAY = 86_400_000;

/** Sample at day offset from a fixed epoch. */
const at = (n: number, weightKg: number | null, waistCm: number | null): RateSample => ({
	takenAt: new Date(Date.parse("2026-01-01T00:00:00Z") + n * DAY).toISOString(),
	weightKg,
	waistCm,
});

describe("weeklyRates", () => {
	it("normalises a 14-day span to per-week", () => {
		const rates = weeklyRates([at(0, 82, 90), at(14, 80, 89)]);
		expect(rates.weightKgPerWeek).toBeCloseTo(-1, 5);
		expect(rates.waistCmPerWeek).toBeCloseTo(-0.5, 5);
	});

	it("7-day span needs no scaling", () => {
		const rates = weeklyRates([at(0, 82, 90), at(7, 81.3, 89.9)]);
		expect(rates.weightKgPerWeek).toBeCloseTo(-0.7, 5);
		expect(rates.waistCmPerWeek).toBeCloseTo(-0.1, 5);
	});

	it("uses the newest sample and the latest ref at least 7 days older", () => {
		const rates = weeklyRates([at(0, 90, 100), at(7, 85, 95), at(8, 84, 94.5), at(20, 83, 94)]);
		// ref for the day-20 sample is day-8 (day 13 would be ideal but day-8 is newest ≤ 13)
		expect(rates.weightKgPerWeek).toBeCloseTo(((83 - 84) / 12) * 7, 5);
	});

	it("skips samples newer than 7 days when looking for a reference", () => {
		const rates = weeklyRates([at(0, 82, 90), at(6, 81, 89), at(12, 80, 88.5)]);
		// latest is day 12; day 6 is less than 7 days back, so the ref is day 0
		expect(rates.weightKgPerWeek).toBeCloseTo(((80 - 82) / 12) * 7, 5);
	});

	it("fewer than two samples of a metric yields null", () => {
		expect(weeklyRates([at(0, 82, null)]).weightKgPerWeek).toBeNull();
		expect(weeklyRates([at(0, 82, null)]).waistCmPerWeek).toBeNull();
		expect(weeklyRates([])).toEqual({ weightKgPerWeek: null, waistCmPerWeek: null });
	});

	it("no reference at least 7 days back yields null", () => {
		expect(weeklyRates([at(0, 82, 90), at(3, 81, 89)]).weightKgPerWeek).toBeNull();
	});
});

describe("leanMassStatus truth table (F13)", () => {
	it("rapid loss with a near-flat waist is at risk", () => {
		// -0.9 kg/wk, waist -0.05 cm/wk
		const status = leanMassStatus([at(0, 82, 90), at(14, 80, 89.9)]);
		expect(status.atRisk).toBe(true);
		expect(status.rates.weightKgPerWeek).toBeCloseTo(-1, 5);
	});

	it("slower loss is not at risk", () => {
		const status = leanMassStatus([at(0, 82, 90), at(14, 81, 89.9)]);
		expect(status.atRisk).toBe(false);
	});

	it("rapid loss WITH a shrinking waist is not at risk", () => {
		const status = leanMassStatus([at(0, 82, 90), at(14, 80, 88)]);
		expect(status.atRisk).toBe(false);
	});

	it("gaining is never at risk", () => {
		const status = leanMassStatus([at(0, 80, 90), at(14, 82, 90.1)]);
		expect(status.atRisk).toBe(false);
	});

	it("missing waist rate means no verdict", () => {
		const status = leanMassStatus([at(0, 82, null), at(14, 80, null)]);
		expect(status.atRisk).toBe(false);
		expect(status.rates.waistCmPerWeek).toBeNull();
	});
});
