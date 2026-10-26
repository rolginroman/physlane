import { describe, expect, it } from "vitest";
import {
  MUSCLE_GROUPS,
  MUSCLES,
  exerciseRegions,
  muscleDisplayLabel,
} from "../taxonomy";

describe("taxonomy", () => {
  it("lists 25 muscles across 8 regions", () => {
    expect(MUSCLES).toHaveLength(25);
    expect(Object.keys(MUSCLE_GROUPS)).toHaveLength(8);
  });

  it("maps every muscle to exactly one region", () => {
    const seen = new Set<string>();
    for (const muscles of Object.values(MUSCLE_GROUPS)) {
      for (const muscle of muscles) {
        expect(MUSCLES).toContain(muscle);
        expect(seen.has(muscle)).toBe(false);
        seen.add(muscle);
      }
    }
    expect(seen.size).toBe(MUSCLES.length);
  });

  it("derives regions from primary and secondary muscles", () => {
    expect(exerciseRegions("chest", ["triceps"])).toEqual(
      expect.arrayContaining(["chest", "arms"]),
    );
    expect(exerciseRegions("neck", [])).toEqual(["neck"]);
  });

  it("formats muscle display labels", () => {
    expect(muscleDisplayLabel("upper-chest")).toBe("Upper chest");
  });
});
