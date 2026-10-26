import { describe, expect, it } from "vitest";
import { deleteConfirmBody, libraryAddress } from "../library-rows";

const row = {
  visibility: "unlisted" as const,
  slug: "strength-foundations",
  shareToken: "x9LpAbCdEf",
  hiddenAt: null,
};

describe("libraryAddress", () => {
  it("shows the public path as is", () => {
    expect(libraryAddress({ ...row, visibility: "public" }, "tara")).toEqual({
      kind: "public",
      path: "/u/tara/strength-foundations",
      display: "/u/tara/strength-foundations",
    });
  });

  it("cuts the share token for display but keeps it whole in the path", () => {
    expect(libraryAddress(row, "tara")).toEqual({
      kind: "unlisted",
      path: "/u/tara/strength-foundations/x9LpAbCdEf",
      display: "/u/tara/strength-foundations/x9Lp…",
    });
  });

  it("has no address for drafts, hidden programs, or a missing author slug", () => {
    expect(libraryAddress({ ...row, visibility: "draft" }, "tara")).toBeNull();
    expect(
      libraryAddress({ ...row, hiddenAt: "2026-10-01T00:00:00.000Z" }, "tara"),
    ).toBeNull();
    expect(libraryAddress(row, null)).toBeNull();
  });
});

describe("deleteConfirmBody", () => {
  it("never mentions links for a draft", () => {
    expect(deleteConfirmBody("draft")).not.toContain("links");
  });

  it("mentions the profile only for a public program", () => {
    expect(deleteConfirmBody("public")).toContain("profile");
    expect(deleteConfirmBody("unlisted")).not.toContain("profile");
    expect(deleteConfirmBody("unlisted")).toContain("links");
  });
});
