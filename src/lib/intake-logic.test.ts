import { describe, expect, it } from "vitest";
import { isValidIntakeDate, validateIntake } from "./intake-logic";

describe("isValidIntakeDate", () => {
	it("accepts canonical real dates", () => {
		expect(isValidIntakeDate("2026-01-01")).toBe(true);
		expect(isValidIntakeDate("2028-02-29")).toBe(true); // leap year
	});

	it("rejects non-canonical or impossible dates", () => {
		expect(isValidIntakeDate("2026-1-5")).toBe(false);
		expect(isValidIntakeDate("2026/01/05")).toBe(false);
		expect(isValidIntakeDate("2026-02-30")).toBe(false);
		expect(isValidIntakeDate("2026-13-01")).toBe(false);
		expect(isValidIntakeDate("2026-00-10")).toBe(false);
		expect(isValidIntakeDate("2026-02-29")).toBe(false); // 2026 not a leap year
		expect(isValidIntakeDate("")).toBe(false);
	});
});

describe("validateIntake", () => {
	it("passes valid input through unchanged", () => {
		expect(validateIntake({ date: "2026-01-15", kcal: 2000, proteinG: 120 })).toEqual({
			date: "2026-01-15",
			kcal: 2000,
			proteinG: 120,
		});
	});

	it("normalises missing proteinG to null (0 protein stays 0)", () => {
		expect(validateIntake({ date: "2026-01-15", kcal: 2000, proteinG: null })).toEqual({
			date: "2026-01-15",
			kcal: 2000,
			proteinG: null,
		});
		expect(validateIntake({ date: "2026-01-15", kcal: 2000, proteinG: undefined })).toEqual({
			date: "2026-01-15",
			kcal: 2000,
			proteinG: null,
		});
		expect(validateIntake({ date: "2026-01-15", kcal: 2000, proteinG: 0 })).toEqual({
			date: "2026-01-15",
			kcal: 2000,
			proteinG: 0,
		});
	});

	it("accepts boundary values", () => {
		expect(validateIntake({ date: "2026-01-15", kcal: 0, proteinG: 0 })).toEqual({
			date: "2026-01-15",
			kcal: 0,
			proteinG: 0,
		});
		expect(validateIntake({ date: "2026-01-15", kcal: 20000, proteinG: 600 })).toEqual({
			date: "2026-01-15",
			kcal: 20000,
			proteinG: 600,
		});
	});

	it("rejects kcal out of range or non-integer", () => {
		expect(() => validateIntake({ date: "2026-01-15", kcal: -1, proteinG: null })).toThrow();
		expect(() => validateIntake({ date: "2026-01-15", kcal: 20001, proteinG: null })).toThrow();
		expect(() => validateIntake({ date: "2026-01-15", kcal: 2000.5, proteinG: null })).toThrow();
		expect(() => validateIntake({ date: "2026-01-15", kcal: "2000", proteinG: null })).toThrow();
		expect(() => validateIntake({ date: "2026-01-15", kcal: Number.NaN, proteinG: null })).toThrow();
	});

	it("rejects proteinG out of range or non-integer", () => {
		expect(() => validateIntake({ date: "2026-01-15", kcal: 2000, proteinG: -1 })).toThrow();
		expect(() => validateIntake({ date: "2026-01-15", kcal: 2000, proteinG: 601 })).toThrow();
		expect(() => validateIntake({ date: "2026-01-15", kcal: 2000, proteinG: 120.5 })).toThrow();
		expect(() => validateIntake({ date: "2026-01-15", kcal: 2000, proteinG: "120" })).toThrow();
	});

	it("rejects malformed dates", () => {
		expect(() => validateIntake({ date: "2026-1-5", kcal: 2000, proteinG: null })).toThrow();
		expect(() => validateIntake({ date: "not-a-date", kcal: 2000, proteinG: null })).toThrow();
		expect(() => validateIntake({ date: 20260115, kcal: 2000, proteinG: null })).toThrow();
	});
});
