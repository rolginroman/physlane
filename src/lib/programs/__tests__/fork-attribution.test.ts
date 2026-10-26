import { describe, expect, it } from "vitest";
import { forkAttributionAuthorName } from "#/lib/programs/fork-attribution";

describe("forkAttributionAuthorName", () => {
  it("returns the segment before the attribution separator", () => {
    expect(forkAttributionAuthorName("Tara · Hypertrophy Base")).toBe("Tara");
  });
});
