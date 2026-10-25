import { describe, expect, it } from "vitest";
import {
  collectSaveBlockers,
  entryToPayload,
  numberToInput,
  parseNumberInput,
  saveBlockedLabel,
  validateSession,
} from "#/lib/programs/entry-validation";
import type { ProgramEntryDTO, ProgramSessionDTO } from "#/server/programs.fns";

function entry(patch: Partial<ProgramEntryDTO> = {}): ProgramEntryDTO {
  return {
    id: "e1",
    orderIndex: 0,
    exerciseId: "ex-1",
    groupTag: null,
    sets: 3,
    repsType: "count",
    repsValue: 10,
    loadType: "none",
    loadValue: null,
    intensityType: "none",
    intensityValue: null,
    restSeconds: null,
    cues: null,
    refUrl: null,
    ...patch,
  };
}

function session(
  entries: ProgramEntryDTO[],
  patch: Partial<ProgramSessionDTO> = {},
): ProgramSessionDTO {
  return {
    id: "s1",
    weekNumber: 1,
    orderIndex: 0,
    title: "Upper A",
    notes: null,
    entries,
    ...patch,
  };
}

describe("entryToPayload", () => {
  it("sends cleared sets as typed instead of coercing to 3", () => {
    expect(entryToPayload(entry({ sets: Number.NaN })).sets).toBeNaN();
    expect(entryToPayload(entry({ sets: 0 })).sets).toBe(0);
  });

  it("clears values the chosen type makes meaningless", () => {
    const payload = entryToPayload(
      entry({ repsType: "max", repsValue: 8, loadValue: 5, intensityValue: 7 }),
    );
    expect(payload.repsValue).toBeNull();
    expect(payload.loadValue).toBeNull();
    expect(payload.intensityValue).toBeNull();
  });
});

describe("validateSession", () => {
  it("accepts a valid session", () => {
    expect(validateSession(session([entry()]), "metric")).toBeNull();
  });

  it("names the empty reps field instead of passing it through", () => {
    const errors = validateSession(
      session([entry({ repsType: "seconds", repsValue: null })]),
      "metric",
    );
    expect(errors?.entries.e1?.repsValue).toBe("Add seconds, or choose Max.");
  });

  it("flags zero sets, a missing load and an out-of-range rest on one entry", () => {
    const errors = validateSession(
      session([
        entry({ sets: 0, loadType: "kg", loadValue: null, restSeconds: 901 }),
      ]),
      "imperial",
    );
    expect(Object.keys(errors?.entries.e1 ?? {}).sort()).toEqual([
      "loadValue",
      "restSeconds",
      "sets",
    ]);
    expect(errors?.entries.e1?.loadValue).toContain("lb");
  });

  it("flags a link without a scheme and an empty title", () => {
    const errors = validateSession(
      session([entry({ refUrl: "example.com" })], { title: "" }),
      "metric",
    );
    expect(errors?.entries.e1?.refUrl).toBeDefined();
    expect(errors?.title).toBeDefined();
  });
});

describe("collectSaveBlockers", () => {
  it("blocks only the invalid session and labels the count", () => {
    const good = session([entry()], { id: "good" });
    const bad = session([entry({ id: "b1", sets: 0 }), entry({ id: "b2" })], {
      id: "bad",
    });
    const blockers = collectSaveBlockers([good, bad], "metric");
    expect(Object.keys(blockers.bySession)).toEqual(["bad"]);
    expect(saveBlockedLabel(blockers)).toBe("Fix 1 entry to save");
  });

  it("has no label when everything is valid", () => {
    expect(
      saveBlockedLabel(collectSaveBlockers([session([entry()])], "metric")),
    ).toBeNull();
  });

  it("counts a bad session title as an issue", () => {
    const blockers = collectSaveBlockers(
      [session([entry({ sets: 0 })], { title: "" })],
      "metric",
    );
    expect(saveBlockedLabel(blockers)).toBe("Fix 2 issues to save");
  });
});

describe("number input helpers", () => {
  it("keeps blank, valid and invalid text distinguishable", () => {
    expect(parseNumberInput("")).toBeNull();
    expect(parseNumberInput("12")).toBe(12);
    expect(parseNumberInput("1e")).toBeNaN();
  });

  it("shows cleared values as blank", () => {
    expect(numberToInput(Number.NaN)).toBe("");
    expect(numberToInput(null)).toBe("");
    expect(numberToInput(0)).toBe("0");
  });
});
