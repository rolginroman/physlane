import { describe, expect, it } from "vitest";
import { ownerViewPath } from "../owner-view";

const base = {
  id: "p1",
  slug: "base",
  shareToken: "tok123456",
  hiddenAt: null,
};

describe("ownerViewPath", () => {
  it("follows the program to the address its visibility now has", () => {
    expect(ownerViewPath({ ...base, visibility: "public" }, "tara")).toBe(
      "/u/tara/base",
    );
    expect(ownerViewPath({ ...base, visibility: "unlisted" }, "tara")).toBe(
      "/u/tara/base/tok123456",
    );
  });

  it("sends a draft back to the editor, where it has no public address", () => {
    expect(ownerViewPath({ ...base, visibility: "draft" }, "tara")).toBe(
      "/programs/p1",
    );
  });
});
