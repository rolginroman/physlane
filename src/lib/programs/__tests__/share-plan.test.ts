import { describe, expect, it } from "vitest";
import {
  defaultShareSelection,
  planShareChange,
  publicChangeSummary,
  SHARE_VISIBILITIES,
  type ShareVisibility,
} from "../share-plan";

const base: {
  title: string;
  profilePublished: boolean;
  hasShareLink: boolean;
  profileLabel: string | null;
} = {
  title: "Hypertrophy Base",
  profilePublished: true,
  hasShareLink: false,
  profileLabel: "physlane.app/u/tara",
};

const plan = (
  current: ShareVisibility,
  selected: ShareVisibility,
  extra: Partial<typeof base> = {},
) => planShareChange({ ...base, current, selected, ...extra });

describe("share-plan", () => {
  it("preselects Unlisted for a draft and keeps the current state otherwise", () => {
    expect(defaultShareSelection("draft")).toBe("unlisted");
    expect(defaultShareSelection("unlisted")).toBe("unlisted");
    expect(defaultShareSelection("public")).toBe("public");
  });

  it("plans nothing when the selection is the current state", () => {
    for (const v of SHARE_VISIBILITIES) {
      expect(plan(v, v)).toBeNull();
    }
  });

  it("makes the draft default a one-tap Create share link", () => {
    const change = plan("draft", defaultShareSelection("draft"));
    expect(change?.label).toBe("Create share link");
    expect(change?.confirm).toBeNull();
    expect(change?.needsProfile).toBe(false);
  });

  it("confirms every transition that kills a link", () => {
    for (const [from, to] of [
      ["unlisted", "draft"],
      ["public", "draft"],
      ["public", "unlisted"],
    ] as const) {
      const change = plan(from, to);
      expect(change?.destructive).toBe(true);
      expect(change?.confirm?.destructive).toBe(true);
    }
  });

  it("names the public address and QR link when de-listing", () => {
    expect(plan("public", "draft")?.confirm?.bullets.join(" ")).toContain(
      "QR and print link",
    );
    expect(plan("public", "unlisted")?.confirm?.bullets.join(" ")).toContain(
      "new share link",
    );
  });

  it("asks for a profile, then confirms, only before the first go-public", () => {
    const first = plan("unlisted", "public", {
      profilePublished: false,
      hasShareLink: true,
    });
    expect(first?.needsProfile).toBe(true);
    expect(first?.confirm?.title).toBe("Make “Hypertrophy Base” public?");
    expect(first?.confirm?.bullets).toContain(
      "Your share link keeps working and opens the public page.",
    );

    const later = plan("unlisted", "public", { hasShareLink: true });
    expect(later?.needsProfile).toBe(false);
    expect(later?.confirm).toBeNull();
  });

  it("omits the share-link promise when a draft goes public", () => {
    const change = plan("draft", "public", { profilePublished: false });
    expect(change?.confirm?.bullets.join(" ")).not.toContain("share link");
  });

  it("omits the profile address until the author has one", () => {
    const change = plan("draft", "public", { profileLabel: null });
    expect(change?.consequence).toContain("Listed on your profile.");
  });

  it("summarizes what changed after going public", () => {
    expect(
      publicChangeSummary({
        profileLabel: "physlane.app/u/tara",
        firstPublic: true,
        hadShareLink: true,
      }),
    ).toEqual([
      "Public. Listed on your profile.",
      "Your profile page is live at physlane.app/u/tara.",
      "Old share links open this public page.",
    ]);
    expect(
      publicChangeSummary({
        profileLabel: "physlane.app/u/tara",
        firstPublic: false,
        hadShareLink: false,
      }),
    ).toEqual(["Public. Listed on your profile."]);
  });
});
