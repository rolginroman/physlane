import { describe, expect, it } from "vitest";
import {
  exerciseSearchRank,
  rankExercisesForSearch,
} from "#/lib/programs/exercise-search";

describe("exerciseSearchRank", () => {
  it("prefers prefix matches over substring matches", () => {
    const row = { name: "Bench Press", aliases: [] as string[] };
    expect(exerciseSearchRank(row, "bench")).toBe(0);
    expect(exerciseSearchRank(row, "press")).toBe(1);
  });
});

describe("rankExercisesForSearch", () => {
  it("sorts by rank then name", () => {
    const rows = [
      {
        name: "Z Press",
        aliases: [] as string[],
        musclePrimary: "front-delts" as const,
        muscleSecondary: [],
        equipment: "barbell" as const,
      },
      {
        name: "Bench Press",
        aliases: [] as string[],
        musclePrimary: "chest" as const,
        muscleSecondary: [],
        equipment: "barbell" as const,
      },
    ];
    const ranked = rankExercisesForSearch(rows, "press", 10);
    expect(ranked.map((r) => r.name)).toEqual(["Bench Press", "Z Press"]);
  });
});
