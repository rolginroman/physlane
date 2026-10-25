import { describe, expect, it } from "vitest";
import { isProgramPathLeaf } from "../public-program-path";

describe("isProgramPathLeaf", () => {
  it("matches slug program leaf only", () => {
    expect(
      isProgramPathLeaf("/u/tara/hypertrophy", "tara", "hypertrophy"),
    ).toBe(true);
    expect(
      isProgramPathLeaf("/u/tara/hypertrophy/", "tara", "hypertrophy"),
    ).toBe(true);
  });

  it("rejects share-token and deeper paths", () => {
    expect(
      isProgramPathLeaf("/u/tara/hypertrophy/tok", "tara", "hypertrophy"),
    ).toBe(false);
    expect(
      isProgramPathLeaf("/u/tara/hypertrophy/tok/extra", "tara", "hypertrophy"),
    ).toBe(false);
    expect(isProgramPathLeaf("/u/tara/other", "tara", "hypertrophy")).toBe(
      false,
    );
    expect(
      isProgramPathLeaf("/u/tara/hypertrophy", "other", "hypertrophy"),
    ).toBe(false);
  });
});
