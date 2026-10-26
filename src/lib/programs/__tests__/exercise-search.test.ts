import { describe, expect, it } from "vitest";
import {
  exerciseSearchRank,
  filterExercisesForSearch,
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

describe("filterExercisesForSearch", () => {
  const row = (
    name: string,
    musclePrimary: "chest" | "quads" | "biceps",
    ownerUserId: string | null = null,
  ) => ({
    name,
    aliases: [] as string[],
    musclePrimary,
    muscleSecondary: [] as never[],
    equipment: "barbell" as const,
    ownerUserId,
  });

  it("narrows by region before any cap is applied", () => {
    const rows = [
      ...Array.from({ length: 60 }, (_, i) => row(`A chest ${i}`, "chest")),
      row("Z squat", "quads"),
    ];
    const legs = filterExercisesForSearch(rows, { query: "", region: "legs" });
    expect(rankExercisesForSearch(legs, "", 50).map((r) => r.name)).toEqual([
      "Z squat",
    ]);
  });

  it("matches a region through secondary muscles", () => {
    const bench = {
      ...row("Bench", "chest"),
      muscleSecondary: ["triceps" as const],
    };
    expect(
      filterExercisesForSearch([bench], { query: "", region: "arms" }),
    ).toHaveLength(1);
  });

  it("limits to the user's own exercises for source mine", () => {
    const rows = [row("Catalog row", "chest"), row("My row", "chest", "u1")];
    expect(
      filterExercisesForSearch(rows, { query: "", source: "mine" }).map(
        (r) => r.name,
      ),
    ).toEqual(["My row"]);
  });
});
