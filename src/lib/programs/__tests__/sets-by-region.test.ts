import { describe, expect, it } from "vitest";
import { setsByRegion, totalSets } from "../sets-by-region";

const exercises = {
  bench: { musclePrimary: "chest" as const },
  ohp: { musclePrimary: "front-delts" as const },
  incline: { musclePrimary: "upper-chest" as const },
  row: { musclePrimary: "lats" as const },
};

describe("setsByRegion", () => {
  it("sums sets per region of the primary muscle, biggest first", () => {
    const result = setsByRegion(
      [
        { exerciseId: "bench", sets: 4 },
        { exerciseId: "incline", sets: 3 },
        { exerciseId: "ohp", sets: 3 },
        { exerciseId: "row", sets: 4 },
      ],
      exercises,
    );
    expect(result).toEqual([
      { region: "chest", sets: 7 },
      { region: "back", sets: 4 },
      { region: "shoulders", sets: 3 },
    ]);
  });

  it("skips exercises missing from the catalog map", () => {
    expect(setsByRegion([{ exerciseId: "gone", sets: 5 }], exercises)).toEqual(
      [],
    );
  });

  it("breaks ties in a fixed region order", () => {
    const result = setsByRegion(
      [
        { exerciseId: "row", sets: 3 },
        { exerciseId: "bench", sets: 3 },
      ],
      exercises,
    );
    expect(result.map((r) => r.region)).toEqual(["chest", "back"]);
  });
});

describe("totalSets", () => {
  it("adds sets across sessions", () => {
    expect(
      totalSets([
        { entries: [{ exerciseId: "a", sets: 3 }] },
        {
          entries: [
            { exerciseId: "b", sets: 4 },
            { exerciseId: "c", sets: 2 },
          ],
        },
      ]),
    ).toBe(9);
  });
});
