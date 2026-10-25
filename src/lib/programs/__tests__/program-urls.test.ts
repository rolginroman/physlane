import { describe, expect, it } from "vitest";
import {
  publicProgramCanonicalPath,
  publicProgramIdPermalinkPath,
  publicProgramIdPermalinkUrlFromOrigin,
  shareLinkPath,
} from "../program-urls";

describe("program-urls", () => {
  it("builds two-segment public canonical paths", () => {
    expect(publicProgramCanonicalPath("tara", "hypertrophy")).toBe(
      "/u/tara/hypertrophy",
    );
  });

  it("builds permalink paths with literal p segment", () => {
    expect(publicProgramIdPermalinkPath("tara", "prog-uuid")).toBe(
      "/u/tara/p/prog-uuid",
    );
  });

  it("builds unlisted share paths with token suffix", () => {
    expect(shareLinkPath("tara", "hypertrophy", "tok_abc")).toBe(
      "/u/tara/hypertrophy/tok_abc",
    );
  });

  it("builds an origin-relative permalink without a double slash", () => {
    expect(
      publicProgramIdPermalinkUrlFromOrigin(
        "https://physlane.app/",
        "tara",
        "prog-uuid",
      ),
    ).toBe("https://physlane.app/u/tara/p/prog-uuid");
  });
});
