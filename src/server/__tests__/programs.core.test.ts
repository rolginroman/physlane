import { describe, expect, it } from "vitest";
import {
  assertAuthor,
  assertExerciseReferenceAllowed,
  assertProgramUsable,
  assertSlugAvailable,
  customExerciseInputSchema,
  isSlugHistoryReserved,
  normalizeExerciseName,
  nextRevision,
  planVisibilityTransition,
  assertForkAllowed,
  buildForkSourceLabel,
  inheritedForeignCustomIdsFromExerciseOwners,
  planForkSessionCopies,
  resolvePublicProgramView,
  revisionGuard,
  authorSlugRenameAllowedAt,
  planAuthorProfileSave,
  resolveAuthorProfileRedirect,
  resolveAuthorSlugLookup,
  resolveProgramRedirect,
  suggestAuthorSlug,
  suggestProgramSlug,
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

const noHidden = { hiddenAt: null as Date | null };
const withSlug = (slug: string | null) => ({ ...noHidden, slug });
const authorNoSlug = { slug: null as string | null };
const authorWithSlug = { slug: "jane" };

describe("planVisibilityTransition", () => {
  it("refuses hidden programs", () => {
    const result = planVisibilityTransition(
      "draft",
      "unlisted",
      { hiddenAt: new Date(), slug: null },
      authorNoSlug,
    );
    expect(result).toEqual({ ok: false, code: "INVALID_TRANSITION" });
  });

  const invalidPairs: Array<
    ["draft" | "unlisted" | "public", "draft" | "unlisted" | "public"]
  > = [
    ["draft", "draft"],
    ["unlisted", "unlisted"],
    ["public", "public"],
  ];
  for (const [current, target] of invalidPairs) {
    it(`rejects self-transition ${current} → ${target}`, () => {
      expect(
        planVisibilityTransition(
          current,
          target,
          withSlug("ppl"),
          authorWithSlug,
        ),
      ).toEqual({ ok: false, code: "INVALID_TRANSITION" });
    });
  }

  it("draft → unlisted mints token and slugs when absent", () => {
    expect(
      planVisibilityTransition(
        "draft",
        "unlisted",
        withSlug(null),
        authorNoSlug,
      ),
    ).toEqual({
      ok: true,
      effects: {
        mintShareToken: true,
        clearShareToken: false,
        mintProgramSlug: true,
        mintAuthorSlug: true,
        profileBecomesPublic: false,
      },
    });
  });

  it("draft → public mints slugs but not token", () => {
    expect(
      planVisibilityTransition("draft", "public", withSlug(null), authorNoSlug),
    ).toEqual({
      ok: true,
      effects: {
        mintShareToken: false,
        clearShareToken: false,
        mintProgramSlug: true,
        mintAuthorSlug: true,
        profileBecomesPublic: true,
      },
    });
  });

  it("unlisted → public keeps token and slugs", () => {
    expect(
      planVisibilityTransition(
        "unlisted",
        "public",
        withSlug("ppl"),
        authorWithSlug,
      ),
    ).toEqual({
      ok: true,
      effects: {
        mintShareToken: false,
        clearShareToken: false,
        mintProgramSlug: false,
        mintAuthorSlug: false,
        profileBecomesPublic: true,
      },
    });
  });

  it("public → unlisted mints fresh token, retains slugs", () => {
    expect(
      planVisibilityTransition(
        "public",
        "unlisted",
        withSlug("ppl"),
        authorWithSlug,
      ),
    ).toEqual({
      ok: true,
      effects: {
        mintShareToken: true,
        clearShareToken: false,
        mintProgramSlug: false,
        mintAuthorSlug: false,
        profileBecomesPublic: false,
      },
    });
  });

  it("public → draft clears token, retains slugs", () => {
    expect(
      planVisibilityTransition(
        "public",
        "draft",
        withSlug("ppl"),
        authorWithSlug,
      ),
    ).toEqual({
      ok: true,
      effects: {
        mintShareToken: false,
        clearShareToken: true,
        mintProgramSlug: false,
        mintAuthorSlug: false,
        profileBecomesPublic: false,
      },
    });
  });

  it("unlisted → draft clears token", () => {
    expect(
      planVisibilityTransition(
        "unlisted",
        "draft",
        withSlug("ppl"),
        authorWithSlug,
      ),
    ).toEqual({
      ok: true,
      effects: {
        mintShareToken: false,
        clearShareToken: true,
        mintProgramSlug: false,
        mintAuthorSlug: false,
        profileBecomesPublic: false,
      },
    });
  });

  it("skips slug mint effects when slugs already set", () => {
    expect(
      planVisibilityTransition(
        "draft",
        "unlisted",
        withSlug("prog"),
        authorWithSlug,
      ),
    ).toMatchObject({
      ok: true,
      effects: {
        mintProgramSlug: false,
        mintAuthorSlug: false,
      },
    });
  });
});

describe("suggestProgramSlug", () => {
  it("returns base slug when free", () => {
    expect(suggestProgramSlug("Upper Lower Split", [])).toBe(
      "upper-lower-split",
    );
  });

  it("suffixes on collision within 40 chars", () => {
    expect(suggestProgramSlug("PPL", ["ppl"])).toBe("ppl-2");
    expect(suggestProgramSlug("PPL", ["ppl", "ppl-2"])).toBe("ppl-3");
  });

  it("clamps long titles before suffixing", () => {
    const longTitle = "a".repeat(50);
    const slug = suggestProgramSlug(longTitle, []);
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug).toBe("a".repeat(40));
  });

  it("returns empty when title cannot produce a slug", () => {
    expect(suggestProgramSlug("!!!", [])).toBe("");
  });
});

describe("suggestAuthorSlug", () => {
  it("returns base slug when free", () => {
    expect(suggestAuthorSlug("alex", [])).toBe("alex");
  });

  it("suffixes on collision within 40 chars", () => {
    expect(suggestAuthorSlug("alex", ["alex"])).toBe("alex-2");
    expect(suggestAuthorSlug("alex", ["alex", "alex-2"])).toBe("alex-3");
  });

  it("clamps long base before suffixing", () => {
    const longBase = "a".repeat(40);
    const slug = suggestAuthorSlug(longBase, ["a".repeat(40)]);
    expect(slug).toBe(`${"a".repeat(38)}-2`);
    expect(slug?.length).toBeLessThanOrEqual(40);
  });

  it("returns null for empty base", () => {
    expect(suggestAuthorSlug("", [])).toBeNull();
  });

  it("returns null when all suffix candidates are taken", () => {
    const taken = ["alex"];
    for (let n = 2; n <= 99; n++) {
      taken.push(`alex-${n}`);
    }
    expect(suggestAuthorSlug("alex", taken)).toBeNull();
  });
});

describe("resolveAuthorSlugLookup", () => {
  it("resolves current and quarantined history slugs", () => {
    const now = new Date("2026-06-01T00:00:00Z");
    expect(
      resolveAuthorSlugLookup(
        "tara",
        { userId: "u1", slug: "tara" },
        null,
        "tara",
        now,
      ),
    ).toEqual({
      userId: "u1",
      currentAuthorSlug: "tara",
      viaHistory: false,
    });
    expect(
      resolveAuthorSlugLookup(
        "old-tara",
        null,
        { userId: "u1", createdAt: new Date("2026-01-01T00:00:00Z") },
        "tara",
        now,
      ),
    ).toEqual({
      userId: "u1",
      currentAuthorSlug: "tara",
      viaHistory: true,
    });
  });
});

describe("planAuthorProfileSave", () => {
  it("blocks rename during cooldown", () => {
    const now = new Date("2026-06-01T00:00:00Z");
    const lastRename = new Date("2026-05-01T00:00:00Z");
    const result = planAuthorProfileSave(
      {
        userId: "u1",
        displayName: "Tara",
        authorSlug: "tara",
        bio: null,
      },
      { displayName: "Tara", authorSlug: "tara-lifts", bio: null },
      ["tara"],
      [],
      lastRename,
      now,
    );
    expect(result).toEqual({ ok: false, code: "INVALID_TRANSITION" });
    expect(authorSlugRenameAllowedAt(lastRename)?.toISOString()).toBe(
      "2026-07-30T00:00:00.000Z",
    );
  });

  it("writes rename plan when slug changes and cooldown elapsed", () => {
    const now = new Date("2026-06-01T00:00:00Z");
    const result = planAuthorProfileSave(
      {
        userId: "u1",
        displayName: "Tara",
        authorSlug: "tara",
        bio: null,
      },
      { displayName: "Tara", authorSlug: "tara-lifts", bio: "Coach" },
      ["tara"],
      [],
      new Date("2026-01-01T00:00:00Z"),
      now,
    );
    expect(result).toMatchObject({
      ok: true,
      rename: { fromSlug: "tara", toSlug: "tara-lifts" },
    });
  });
});

describe("resolveProgramRedirect", () => {
  const author = {
    userId: "u1",
    currentAuthorSlug: "tara",
    viaHistory: true,
  };
  const publicProgram = {
    id: "p1",
    userId: "u1",
    slug: "hypertrophy",
    visibility: "public" as const,
    hiddenAt: null,
    deletedAt: null,
  };

  it("flattens stale author and program slugs with token preserved", () => {
    const result = resolveProgramRedirect(
      "old-tara",
      "old-program",
      author,
      null,
      publicProgram,
      "share-token-abc",
      false,
    );
    expect(result).toEqual({
      kind: "redirect",
      path: "/u/tara/hypertrophy/share-token-abc",
      search: {},
    });
  });

  it("does not redirect hidden programs", () => {
    const result = resolveProgramRedirect(
      "old-tara",
      "old-program",
      author,
      null,
      {
        ...publicProgram,
        visibility: "draft",
      },
      null,
      false,
    );
    expect(result).toEqual({ kind: "not_found" });
  });

  it("skips redirect for id permalinks", () => {
    expect(
      resolveProgramRedirect(
        "old-tara",
        "p1",
        author,
        publicProgram,
        null,
        null,
        true,
      ).kind,
    ).toBe("none");
  });
});

describe("resolveAuthorProfileRedirect", () => {
  it("returns current profile path for history hits", () => {
    expect(
      resolveAuthorProfileRedirect("old", {
        userId: "u1",
        currentAuthorSlug: "new",
        viaHistory: true,
      }),
    ).toBe("/u/new");
  });
});

describe("assertSlugAvailable", () => {
  it("throws SLUG_TAKEN for current slugs", () => {
    expect(() => assertSlugAvailable("taken", ["taken"], [])).toThrow(
      "SLUG_TAKEN",
    );
  });

  it("throws SLUG_TAKEN for quarantined history", () => {
    const now = new Date("2026-06-01T00:00:00Z");
    const createdAt = new Date("2026-01-01T00:00:00Z");
    expect(() =>
      assertSlugAvailable("old", [], [{ slug: "old", createdAt }], now),
    ).toThrow("SLUG_TAKEN");
  });

  it("allows expired history slugs", () => {
    const now = new Date("2028-01-02T00:00:00Z");
    const createdAt = new Date("2026-01-01T00:00:00Z");
    expect(() =>
      assertSlugAvailable("old", [], [{ slug: "old", createdAt }], now),
    ).not.toThrow();
    expect(isSlugHistoryReserved(createdAt, now)).toBe(false);
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

describe("resolvePublicProgramView", () => {
  const live = {
    deletedAt: null as Date | null,
    hiddenAt: null as Date | null,
    visibility: "public" as const,
  };

  it("returns removed_by_author when deleted", () => {
    expect(
      resolvePublicProgramView(
        { ...live, deletedAt: new Date() },
        "public-only",
      ).kind,
    ).toBe("removed_by_author");
  });

  it("returns unavailable when hidden", () => {
    expect(
      resolvePublicProgramView({ ...live, hiddenAt: new Date() }, "token").kind,
    ).toBe("unavailable");
  });

  it("allows unlisted via token mode", () => {
    expect(
      resolvePublicProgramView({ ...live, visibility: "unlisted" }, "token")
        .kind,
    ).toBe("ok");
  });

  it("rejects draft on public-only paths", () => {
    expect(
      resolvePublicProgramView({ ...live, visibility: "draft" }, "public-only")
        .kind,
    ).toBe("not_found");
  });
});

describe("planForkSessionCopies", () => {
  it("keeps foreign custom exercise ids on entries", () => {
    const plans = planForkSessionCopies(
      [
        {
          id: "s1",
          weekNumber: 1,
          orderIndex: 0,
          title: "Day A",
          notes: null,
          entries: [
            {
              orderIndex: 0,
              exerciseId: "foreign-custom",
              groupTag: null,
              sets: 3,
              repsType: "count",
              repsValue: 10,
              loadType: "kg",
              loadValue: 60,
              intensityType: "none",
              intensityValue: null,
              restSeconds: 90,
              cues: null,
              refUrl: null,
            },
          ],
        },
      ],
      () => "new-id",
    );
    expect(plans[0]?.entries[0]?.exerciseId).toBe("foreign-custom");
    expect(plans[0]?.newSessionId).toBe("new-id");
  });
});

describe("inheritedForeignCustomIdsFromExerciseOwners", () => {
  it("marks exercises owned by someone other than the program author", () => {
    const owners = new Map<string, string | null>([
      ["cat", null],
      ["mine", "author-1"],
      ["theirs", "author-2"],
    ]);
    const inherited = inheritedForeignCustomIdsFromExerciseOwners(
      [{ exerciseId: "cat" }, { exerciseId: "mine" }, { exerciseId: "theirs" }],
      owners,
      "author-1",
    );
    expect([...inherited]).toEqual(["theirs"]);
  });
});

describe("assertForkAllowed", () => {
  const base = {
    visibility: "public" as const,
    deletedAt: null as Date | null,
    hiddenAt: null as Date | null,
    forkable: true,
  };

  it("allows public programs without a token", () => {
    expect(() =>
      assertForkAllowed(base, { grantedByToken: false }),
    ).not.toThrow();
  });

  it("allows unlisted when token grant matches", () => {
    expect(() =>
      assertForkAllowed(
        { ...base, visibility: "unlisted" },
        { grantedByToken: true },
      ),
    ).not.toThrow();
  });

  it("rejects non-forkable programs", () => {
    expect(() =>
      assertForkAllowed(
        { ...base, forkable: false },
        { grantedByToken: false },
      ),
    ).toThrow("INVALID_TRANSITION");
  });
});

describe("buildForkSourceLabel", () => {
  it("joins author and title with a middle dot", () => {
    expect(buildForkSourceLabel("Tara", "Hypertrophy Base")).toBe(
      "Tara · Hypertrophy Base",
    );
  });
});
