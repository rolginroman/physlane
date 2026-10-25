import { describe, expect, it } from "vitest";
import {
  defaultKgLoad,
  loadFromInput,
  loadToInput,
} from "#/lib/programs/load-units";

describe("load units", () => {
  it("shows stored kg as typed for metric authors", () => {
    expect(loadToInput(32.5, "metric")).toBe("32.5");
    expect(loadToInput(40, "metric")).toBe("40");
  });

  it("converts lb input to unrounded kg and shows the same lb back", () => {
    const kg = loadFromInput("135", "imperial");
    expect(kg).toBeCloseTo(61.235, 3);
    expect(loadToInput(kg, "imperial")).toBe("135");
  });

  it("does not drift through repeated lb -> kg -> lb at 0.5 lb steps", () => {
    for (let lb = 0.5; lb <= 1322; lb += 0.5) {
      const text = String(lb);
      const once = loadFromInput(text, "imperial");
      expect(loadToInput(once, "imperial")).toBe(text);
      const twice = loadFromInput(loadToInput(once, "imperial"), "imperial");
      expect(twice).toBeCloseTo(once ?? Number.NaN, 9);
    }
  });

  it("does not drift for 0.25 kg steps", () => {
    for (let kg = 0.25; kg <= 600; kg += 0.25) {
      expect(loadFromInput(loadToInput(kg, "metric"), "metric")).toBe(kg);
    }
  });

  it("separates cleared from unparsable text", () => {
    expect(loadFromInput("  ", "metric")).toBeNull();
    expect(loadFromInput("abc", "metric")).toBeNaN();
    expect(loadFromInput("32,5", "metric")).toBe(32.5);
  });

  it("shows blank for missing values", () => {
    expect(loadToInput(null, "imperial")).toBe("");
    expect(loadToInput(Number.NaN, "metric")).toBe("");
  });

  it("starts imperial authors at a whole-lb default", () => {
    expect(loadToInput(defaultKgLoad("imperial"), "imperial")).toBe("90");
  });
});
