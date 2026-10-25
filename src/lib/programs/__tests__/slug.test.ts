import { describe, expect, it } from "vitest";
import { suggestSlug, validateSlug } from "../slug";

describe("validateSlug", () => {
  it("accepts valid kebab slugs", () => {
    expect(validateSlug("abc")).toEqual({ ok: true });
    expect(validateSlug("my-program-2")).toEqual({ ok: true });
  });

  it("rejects too short and too long", () => {
    expect(validateSlug("ab").ok).toBe(false);
    expect(validateSlug("a".repeat(41)).ok).toBe(false);
    expect(validateSlug("abc").ok).toBe(true);
    expect(validateSlug("a".repeat(40)).ok).toBe(true);
  });

  it("rejects bad hyphen placement and invalid characters", () => {
    expect(validateSlug("-abc").ok).toBe(false);
    expect(validateSlug("abc-").ok).toBe(false);
    expect(validateSlug("a--b").ok).toBe(false);
    expect(validateSlug("UPPER").ok).toBe(false);
    expect(validateSlug("a_b").ok).toBe(false);
  });

  it("rejects reserved slugs", () => {
    expect(validateSlug("programs").ok).toBe(false);
    expect(validateSlug("sign-in").ok).toBe(false);
  });
});

describe("suggestSlug", () => {
  it("normalizes names to kebab-case", () => {
    expect(suggestSlug("  My Program  ")).toBe("my-program");
    expect(suggestSlug("Café René")).toBe("cafe-rene");
  });

  it("collapses separators and clamps length", () => {
    expect(suggestSlug("foo   bar___baz")).toBe("foo-bar-baz");
    expect(suggestSlug("a".repeat(50)).length).toBeLessThanOrEqual(40);
  });

  it("returns empty when nothing usable remains", () => {
    expect(suggestSlug("   ")).toBe("");
    expect(suggestSlug("!!!")).toBe("");
  });
});
