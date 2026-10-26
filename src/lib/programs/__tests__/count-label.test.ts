import { describe, expect, it } from "vitest";
import { countLabel } from "#/lib/programs/count-label";

describe("countLabel", () => {
  it("uses the singular only for exactly one", () => {
    expect(countLabel(1, "week")).toBe("1 week");
    expect(countLabel(0, "week")).toBe("0 weeks");
    expect(countLabel(2, "week")).toBe("2 weeks");
  });

  it("honours an irregular plural", () => {
    expect(countLabel(1, "entry", "entries")).toBe("1 entry");
    expect(countLabel(3, "entry", "entries")).toBe("3 entries");
  });
});
