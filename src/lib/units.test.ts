import { describe, expect, it } from "vitest";
import {
	cmToIn,
	inToCm,
	kgToLb,
	lbToKg,
	lengthFromInput,
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
