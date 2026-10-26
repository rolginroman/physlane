import { describe, expect, it } from "vitest";
import { validateMetaDraft } from "#/lib/programs/meta-validation";

const valid = {
  title: "Base",
  description: null,
  weeks: 8,
  goal: "hypertrophy" as const,
  level: "beginner" as const,
  daysPerWeek: 4,
  equipmentTags: [],
};

describe("validateMetaDraft", () => {
  it("accepts a valid draft", () => {
    expect(validateMetaDraft(valid)).toBeNull();
  });

  it("reports a cleared weeks field and a blank title", () => {
    const errors = validateMetaDraft({
      ...valid,
      weeks: Number.NaN,
      title: "",
    });
    expect(Object.keys(errors ?? {}).sort()).toEqual(["title", "weeks"]);
  });
});
