import { describe, expect, it } from "vitest";
import {
	cmToIn,
	formatGirth,
	formatGirthDelta,
	formatWeightDelta,
	formatWeightRate,
	inToCm,
	kgToLb,
	lbToKg,
	lengthFromInput,
	rateFromInput,
	rateLimitInput,
	rateToInput,
	weightFromInput,
	leanMassRisk,
} from "./units";

describe("unit conversions — round trips", () => {
	it("kg ↔ lb round trips", () => {
		for (const kg of [0.1, 45.3592, 80, 112.4938, 150.5]) {
			expect(lbToKg(kgToLb(kg))).toBeCloseTo(kg, 9);
		}
		for (const lb of [1, 132.5, 176.37, 250.75]) {
			expect(kgToLb(lbToKg(lb))).toBeCloseTo(lb, 9);
		}
	});

	it("cm ↔ in round trips", () => {
		for (const cm of [1, 82.5, 100, 175.26, 201.3]) {
			expect(inToCm(cmToIn(cm))).toBeCloseTo(cm, 9);
		}
		for (const inch of [0.5, 32.48, 69, 79.25]) {
			expect(cmToIn(inToCm(inch))).toBeCloseTo(inch, 9);
		}
	});

	it("known conversions", () => {
		expect(kgToLb(1)).toBeCloseTo(2.2046226218, 9);
		expect(inToCm(1)).toBe(2.54);
		expect(lbToKg(2.2046226218)).toBeCloseTo(1, 9);
	});
});

describe("weightFromInput / lengthFromInput", () => {
	it("rejects 0, negative and NaN input", () => {
		for (const bad of ["0", "-5", "-0.1", "abc", "", "NaN", "Infinity"]) {
			expect(weightFromInput(bad, "metric")).toBeNull();
			expect(weightFromInput(bad, "imperial")).toBeNull();
			expect(lengthFromInput(bad, "metric")).toBeNull();
			expect(lengthFromInput(bad, "imperial")).toBeNull();
		}
	});

	it("metric passthrough, imperial converts", () => {
		expect(weightFromInput("80.5", "metric")).toBeCloseTo(80.5, 9);
		expect(weightFromInput("176.37", "imperial")).toBeCloseTo(80.0002, 3);
		expect(lengthFromInput("180", "metric")).toBeCloseTo(180, 9);
		expect(lengthFromInput("70.9", "imperial")).toBeCloseTo(180.086, 3);
	});
});

describe("formatGirth / formatGirthDelta / formatWeightDelta", () => {
	it("formatGirth renders one decimal with the right unit", () => {
		expect(formatGirth(85, "metric")).toBe("85.0 cm");
		expect(formatGirth(85.09, "metric")).toBe("85.1 cm");
		expect(formatGirth(85.09, "imperial")).toBe("33.5 in"); // 85.09 / 2.54 = 33.5
		expect(formatGirth(101.6, "imperial")).toBe("40.0 in");
	});

	it("formatGirth null/undefined renders a dash", () => {
		expect(formatGirth(null, "metric")).toBe("—");
		expect(formatGirth(undefined, "imperial")).toBe("—");
	});

	it("cm ↔ in parity: same girth formats to equivalent values", () => {
		const cm = 85.09;
		const inch = inToCm(cmToIn(cm)); // round-trip
		expect(formatGirth(cm, "metric")).toBe(`${cm.toFixed(1)} cm`);
		expect(formatGirth(inch, "imperial")).toBe(`${cmToIn(inch).toFixed(1)} in`);
	});

	it("girth deltas are signed with units, imperial converts", () => {
		expect(formatGirthDelta(0.4, "metric")).toBe("+0.4 cm");
		expect(formatGirthDelta(-1.27, "metric")).toBe("−1.3 cm");
		expect(formatGirthDelta(1.27, "imperial")).toBe("+0.5 in"); // 1.27 cm = 0.5 in
		expect(formatGirthDelta(0, "metric")).toBe("0.0 cm");
		expect(formatGirthDelta(null, "metric")).toBe("");
	});

	it("weight deltas are signed with units, imperial converts", () => {
		expect(formatWeightDelta(-0.45, "metric")).toBe("−0.5 kg");
		expect(formatWeightDelta(0.453592, "imperial")).toBe("+1.0 lb");
		expect(formatWeightDelta(null, "imperial")).toBe("");
	});

	it("formatWeightRate converts the weekly rate and trims trailing zeros", () => {
		expect(formatWeightRate(-0.5, "metric")).toBe("−0.5 kg/wk");
		expect(formatWeightRate(0.25, "metric")).toBe("+0.25 kg/wk");
		expect(formatWeightRate(-0.5, "imperial")).toBe("−1.1 lb/wk");
		expect(formatWeightRate(0, "imperial")).toBe("0 lb/wk");
		expect(formatWeightRate(null, "metric")).toBe("—");
	});
});

describe("rateToInput / rateFromInput / rateLimitInput", () => {
	it("prefills presets in the user's units", () => {
		expect(rateToInput(-0.5, "metric")).toBe("-0.5");
		expect(rateToInput(-0.5, "imperial")).toBe("-1.1");
		expect(rateToInput(0.25, "imperial")).toBe("0.55");
		expect(rateToInput(0, "imperial")).toBe("0");
	});

	it("parses signed rates back to kg/wk; NaN → null", () => {
		expect(rateFromInput("-0.5", "metric")).toBe(-0.5);
		expect(rateFromInput("0", "imperial")).toBe(0);
		expect(rateFromInput("-1", "imperial")).toBeCloseTo(-0.453592, 6);
		expect(rateFromInput("", "imperial")).toBeNull();
		expect(rateFromInput("abc", "metric")).toBeNull();
	});

	it("round trips within the 0.01 input rounding", () => {
		for (const kg of [-2, -0.5, -0.25, 0, 0.25, 1, 2]) {
			for (const units of ["metric", "imperial"] as const) {
				const back = rateFromInput(rateToInput(kg, units), units) as number;
				expect(Math.abs(back - kg)).toBeLessThanOrEqual(lbToKg(0.005) + 1e-12);
			}
		}
	});

	it("shown bound is valid: ±4.4 lb/wk stays within ±2 kg/wk, 4.5 does not", () => {
		expect(rateLimitInput(2, "metric")).toBe(2);
		expect(rateLimitInput(2, "imperial")).toBe(4.4);
		expect(Math.abs(rateFromInput("4.4", "imperial") as number)).toBeLessThanOrEqual(2);
		expect(Math.abs(rateFromInput("-4.4", "imperial") as number)).toBeLessThanOrEqual(2);
		expect(rateFromInput("4.5", "imperial") as number).toBeGreaterThan(2);
		expect(rateFromInput("-4.5", "imperial") as number).toBeLessThan(-2);
	});
});

describe("leanMassRisk truth table", () => {
	it("flags fast weight loss with near-flat waist", () => {
		expect(leanMassRisk(-0.9, -0.05)).toBe(true);
	});

	it("fast loss WITH shrinking waist is fine", () => {
		expect(leanMassRisk(-0.9, -0.5)).toBe(false);
	});

	it("slow loss with flat waist is fine", () => {
		expect(leanMassRisk(-0.5, -0.05)).toBe(false);
	});
});
