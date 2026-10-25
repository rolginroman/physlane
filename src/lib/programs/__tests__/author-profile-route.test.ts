import { describe, expect, it } from "vitest";
import { isAuthorProfileLeafPath } from "../author-profile-route";

describe("isAuthorProfileLeafPath", () => {
  it("matches profile leaf only", () => {
    expect(isAuthorProfileLeafPath("/u/leotester", "leotester")).toBe(true);
    expect(isAuthorProfileLeafPath("/u/leotester/", "leotester")).toBe(true);
  });

  it("rejects program and deeper paths", () => {
    expect(
      isAuthorProfileLeafPath("/u/leotester/hypertrophy-base-a", "leotester"),
    ).toBe(false);
    expect(isAuthorProfileLeafPath("/u/other", "leotester")).toBe(false);
    expect(isAuthorProfileLeafPath("/u/leotester/extra", "leotester")).toBe(
      false,
    );
  });
});
