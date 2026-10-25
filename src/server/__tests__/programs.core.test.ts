import { describe, expect, it } from "vitest";
import {
  assertAuthor,
  assertExerciseReferenceAllowed,
  assertProgramUsable,
  customExerciseInputSchema,
  normalizeExerciseName,
  nextRevision,
  revisionGuard,
  validateSessionEntries,
} from "../programs.core";

describe("assertAuthor", () => {
  it("allows the program author", () => {
    expect(() => assertAuthor({ userId: "u1" }, "u1")).not.toThrow();
  });

  it("throws NOT_AUTHOR for a different user", () => {
    expect(() => assertAuthor({ userId: "u1" }, "u2")).toThrow("NOT_AUTHOR");
  });
});

describe("revisionGuard", () => {
  it("passes when expected matches current", () => {
    expect(() => revisionGuard(3, 3)).not.toThrow();
  });

  it("throws STALE_REVISION on mismatch", () => {
    expect(() => revisionGuard(2, 3)).toThrow("STALE_REVISION");
  });
});

describe("nextRevision", () => {
  it("increments monotonically", () => {
    expect(nextRevision(0)).toBe(1);
    expect(nextRevision(4)).toBe(5);
  });
});

describe("assertProgramUsable", () => {
  it("throws PROGRAM_NOT_FOUND when deleted", () => {
    expect(() =>
      assertProgramUsable(
        { hiddenAt: null, deletedAt: new Date() },
        { isOwner: true },
      ),
    ).toThrow("PROGRAM_NOT_FOUND");
  });

  it("throws PROGRAM_NOT_FOUND for hidden programs when not owner", () => {
    expect(() =>
      assertProgramUsable(
        { hiddenAt: new Date(), deletedAt: null },
        { isOwner: false },
      ),
    ).toThrow("PROGRAM_NOT_FOUND");
  });

  it("allows hidden programs for the owner", () => {
    expect(() =>
      assertProgramUsable(
        { hiddenAt: new Date(), deletedAt: null },
        { isOwner: true },
      ),
    ).not.toThrow();
  });
});

describe("normalizeExerciseName", () => {
  it("trims, lowercases, and collapses whitespace", () => {
    expect(normalizeExerciseName("  Bench   Press  ")).toBe("bench press");
  });
});

describe("assertExerciseReferenceAllowed", () => {
  const catalog = new Set(["cat-1"]);
  const mine = new Set(["custom-1"]);
  const inherited = new Set(["fork-custom"]);

  it("allows catalog exercises", () => {
    expect(() =>
      assertExerciseReferenceAllowed(
        { exerciseId: "cat-1" },
        {
          catalogIds: catalog,
          myCustomIds: mine,
          inheritedForeignCustomIds: inherited,
        },
      ),
    ).not.toThrow();
  });

  it("allows the author's customs", () => {
    expect(() =>
      assertExerciseReferenceAllowed(
        { exerciseId: "custom-1" },
        {
          catalogIds: catalog,
          myCustomIds: mine,
          inheritedForeignCustomIds: inherited,
        },
      ),
    ).not.toThrow();
  });

  it("allows fork-inherited foreign customs", () => {
    expect(() =>
      assertExerciseReferenceAllowed(
        { exerciseId: "fork-custom" },
        {
          catalogIds: catalog,
          myCustomIds: mine,
          inheritedForeignCustomIds: inherited,
        },
      ),
    ).not.toThrow();
  });

  it("rejects foreign customs not inherited", () => {
    expect(() =>
      assertExerciseReferenceAllowed(
        { exerciseId: "other-custom" },
        {
          catalogIds: catalog,
          myCustomIds: mine,
          inheritedForeignCustomIds: inherited,
        },
      ),
    ).toThrow("INVALID_ENTRY");
  });
});

describe("validateSessionEntries", () => {
  it("rejects when any entry is invalid", () => {
    expect(() =>
      validateSessionEntries([{ exerciseId: "cat" }, { exerciseId: "bad" }], {
        catalogIds: new Set(["cat"]),
        myCustomIds: new Set(),
        inheritedForeignCustomIds: new Set(),
      }),
    ).toThrow("INVALID_ENTRY");
  });
});

describe("customExerciseInputSchema", () => {
  it("parses a valid custom exercise", () => {
    const parsed = customExerciseInputSchema.parse({
      name: "Paused squat",
      aliases: ["tempo squat"],
      musclePrimary: "quads",
      muscleSecondary: ["glutes"],
      equipment: "barbell",
      formNote: "Pause at the bottom",
    });
    expect(parsed.name).toBe("Paused squat");
    expect(parsed.aliases).toHaveLength(1);
  });

  it("rejects too many aliases", () => {
    const result = customExerciseInputSchema.safeParse({
      name: "x",
      aliases: Array.from({ length: 9 }, (_, i) => `a${i}`),
      musclePrimary: "quads",
      muscleSecondary: [],
      equipment: "barbell",
    });
    expect(result.success).toBe(false);
  });
});
