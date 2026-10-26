import { describe, expect, it } from "vitest";
import {
  entrySchema,
  programMetaSchema,
  validateProgramShape,
} from "../program-shape";

const baseMeta = {
  title: "Test",
  weeks: 4,
  goal: "strength" as const,
  level: "beginner" as const,
  daysPerWeek: 3,
  equipmentTags: ["barbell" as const],
};

function entry(overrides: Record<string, unknown> = {}) {
  return {
    exerciseId: "ex-1",
    sets: 3,
    repsType: "count" as const,
    repsValue: 10,
    loadType: "none" as const,
    loadValue: null,
    intensityType: "none" as const,
    intensityValue: null,
    restSeconds: 60,
    ...overrides,
  };
}

describe("entrySchema", () => {
  it("allows max reps with null repsValue", () => {
    const parsed = entrySchema.safeParse(
      entry({ repsType: "max", repsValue: null }),
    );
    expect(parsed.success).toBe(true);
  });

  it("requires repsValue for count", () => {
    const parsed = entrySchema.safeParse(
      entry({ repsType: "count", repsValue: null }),
    );
    expect(parsed.success).toBe(false);
  });

  it("rejects load value when load type is none", () => {
    const parsed = entrySchema.safeParse(
      entry({ loadType: "none", loadValue: 50 }),
    );
    expect(parsed.success).toBe(false);
  });

  it("bounds percent1rm load", () => {
    expect(
      entrySchema.safeParse(entry({ loadType: "percent1rm", loadValue: 201 }))
        .success,
    ).toBe(false);
    expect(
      entrySchema.safeParse(entry({ loadType: "percent1rm", loadValue: 85 }))
        .success,
    ).toBe(true);
  });
});

describe("validateProgramShape", () => {
  it("rejects sessions beyond program weeks", () => {
    const meta = programMetaSchema.parse(baseMeta);
    const errors = validateProgramShape(meta, [
      {
        weekNumber: 5,
        orderIndex: 0,
        title: "Late week",
        entries: [entry()],
      },
    ]);
    expect(errors).not.toBeNull();
    expect(errors?.some((e) => e.includes("exceeds program length"))).toBe(
      true,
    );
  });

  it("returns null when shape is valid", () => {
    const meta = programMetaSchema.parse(baseMeta);
    expect(
      validateProgramShape(meta, [
        {
          weekNumber: 2,
          orderIndex: 0,
          title: "Day A",
          entries: [entry()],
        },
      ]),
    ).toBeNull();
  });
});
