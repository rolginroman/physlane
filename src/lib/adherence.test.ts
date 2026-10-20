import { describe, expect, it } from "vitest";
import {
  addDays,
  adherence7d,
  buildStrip,
  intakeStreak,
  intakeWeekCopy,
  lastNDates,
  tdeeEnergyCopy,
  type IntakeDay,
} from "./adherence";

const day = (start: string, n: number) => addDays(start, n);
const row = (
  date: string,
  kcal: number,
  proteinG: number | null = null,
): IntakeDay => ({
  date,
  kcal,
  proteinG,
});

describe("addDays / lastNDates", () => {
  it("crosses month and year boundaries", () => {
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01"); // 2026 not a leap year
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29"); // leap year
  });

  it("lastNDates returns n dates ending today, oldest first", () => {
    expect(lastNDates("2026-10-17", 7)).toEqual([
      "2026-10-11",
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
    ]);
  });
});

describe("intakeStreak", () => {
  it("counts consecutive days ending today", () => {
    const dates = ["2026-10-14", "2026-10-15", "2026-10-16", "2026-10-17"];
    expect(intakeStreak(dates, "2026-10-17")).toBe(4);
  });

  it("unlogged today does not break the streak", () => {
    const dates = ["2026-10-14", "2026-10-15", "2026-10-16"];
    expect(intakeStreak(dates, "2026-10-17")).toBe(3);
  });

  it("gap yesterday and today means zero", () => {
    expect(intakeStreak(["2026-10-15", "2026-10-13"], "2026-10-17")).toBe(0);
  });

  it("empty set means zero", () => {
    expect(intakeStreak([], "2026-10-17")).toBe(0);
  });

  it("ignores future dates and out-of-order input", () => {
    const dates = ["2026-10-18", "2026-10-16", "2026-10-15", "2026-10-17"];
    expect(intakeStreak(dates, "2026-10-17")).toBe(3);
  });
});

describe("buildStrip", () => {
  const today = "2026-10-17";

  it("fills 7 cells oldest first, padding missing days", () => {
    const strip = buildStrip([row(today, 2000)], {
      today,
      targetKcalPerDay: null,
      phase: null,
    });
    expect(strip).toHaveLength(7);
    expect(strip[6]).toMatchObject({
      date: today,
      kcal: 2000,
      isToday: true,
      state: "logged",
    });
    expect(strip[0]).toMatchObject({
      date: day(today, -6),
      kcal: null,
      state: "missed",
    });
  });

  it("unlogged today is pending, not missed", () => {
    const strip = buildStrip([], {
      today,
      targetKcalPerDay: 2500,
      phase: "cut",
    });
    expect(strip[6].state).toBe("pending");
  });

  it("cut: over target by >10% is off, within tolerance is hit", () => {
    const strip = buildStrip(
      [row(day(today, -1), 2751), row(day(today, -2), 2750)],
      {
        today,
        targetKcalPerDay: 2500,
        phase: "cut",
      },
    );
    expect(strip.find((d) => d.date === day(today, -1))?.state).toBe("off");
    expect(strip.find((d) => d.date === day(today, -2))?.state).toBe("hit");
  });

  it("bulk: under target by >10% is off", () => {
    const strip = buildStrip([row(day(today, -1), 2249)], {
      today,
      targetKcalPerDay: 2500,
      phase: "bulk",
    });
    expect(strip.find((d) => d.date === day(today, -1))?.state).toBe("off");
  });

  it("no target: logged days are neutral", () => {
    const strip = buildStrip([row(day(today, -1), 4000)], {
      today,
      targetKcalPerDay: null,
      phase: null,
    });
    expect(strip.find((d) => d.date === day(today, -1))?.state).toBe("logged");
  });

  it("ignores rows outside the 7-day window", () => {
    const strip = buildStrip([row(day(today, -7), 2000)], {
      today,
      targetKcalPerDay: null,
      phase: null,
    });
    expect(strip.every((d) => d.kcal === null)).toBe(true);
  });
});

describe("adherence7d", () => {
  const today = "2026-10-17";
  const mk = (
    rows: IntakeDay[],
    target: number | null,
    phase: "cut" | null = "cut",
  ) =>
    adherence7d(
      buildStrip(rows, { today, targetKcalPerDay: target, phase }),
      target,
    );

  it("missed past days score zero", () => {
    const stats = mk([row(day(today, -1), 2500)], 2500);
    // 6 scored days: 1 hit + 5 missed zeros
    expect(stats.pct).toBe(Math.round((1 / 6) * 100));
    expect(stats.loggedDays).toBe(1);
  });

  it("overshoot earns no extra credit", () => {
    const over = mk([row(day(today, -1), 5000)], 2500);
    const at = mk([row(day(today, -1), 2500)], 2500);
    expect(over.pct).toBe(at.pct);
  });

  it("unlogged today is excluded from scoring", () => {
    const stats = mk([row(day(today, -1), 2500)], 2500);
    expect(stats.pct).toBe(Math.round((1 / 6) * 100)); // not 1/7
  });

  it("logged today counts", () => {
    const stats = mk([row(today, 2500), row(day(today, -1), 2500)], 2500);
    // 7 scored days: 2 hits + 5 missed zeros
    expect(stats.pct).toBe(Math.round((2 / 7) * 100));
  });

  it("null pct without a target, avg still computed", () => {
    const stats = mk(
      [row(day(today, -1), 2000), row(day(today, -2), 3000)],
      null,
    );
    expect(stats.pct).toBeNull();
    expect(stats.avgKcal).toBe(2500);
    expect(stats.loggedDays).toBe(2);
  });

  it("nothing logged: all nulls, zero days", () => {
    const stats = mk([], 2500);
    expect(stats).toEqual({
      pct: null,
      avgKcal: null,
      loggedDays: 0,
      proteinDays: 0,
    });
  });

  it("protein days counted independently", () => {
    const stats = mk(
      [row(day(today, -1), 2000, 150), row(day(today, -2), 2000)],
      2000,
    );
    expect(stats.proteinDays).toBe(1);
  });
});

describe("tdeeEnergyCopy: deficit-copy suppression in GLP-1 mode", () => {
  it("non-GLP-1 with a cut target uses deficit framing", () => {
    const copy = tdeeEnergyCopy({
      tdeeKcal: 2800,
      targetKcalPerDay: 2300,
      onGlp1: false,
    });
    expect(copy).not.toBeNull();
    expect(copy?.headline).toContain("under your burn");
    expect(copy?.body).toContain("deficit");
  });

  it("non-GLP-1 with a bulk target uses surplus framing", () => {
    const copy = tdeeEnergyCopy({
      tdeeKcal: 2800,
      targetKcalPerDay: 3050,
      onGlp1: false,
    });
    expect(copy?.headline).toContain("over your burn");
    expect(copy?.body).toContain("surplus");
  });

  it("GLP-1 mode never mentions deficit or surplus", () => {
    for (const target of [2300, 2800, 3050, null]) {
      const copy = tdeeEnergyCopy({
        tdeeKcal: 2800,
        targetKcalPerDay: target,
        onGlp1: true,
      });
      expect(copy).not.toBeNull();
      expect(copy?.headline).not.toMatch(/deficit|surplus/i);
      expect(copy?.body).not.toMatch(/deficit|surplus/i);
      expect(copy?.body).toContain("protein");
    }
  });

  it("null without target and not on GLP-1", () => {
    expect(
      tdeeEnergyCopy({ tdeeKcal: 2800, targetKcalPerDay: null, onGlp1: false }),
    ).toBeNull();
  });
});

describe("intakeWeekCopy", () => {
  it("empty week says so", () => {
    expect(
      intakeWeekCopy({
        stats: { pct: null, avgKcal: null, loggedDays: 0, proteinDays: 0 },
        targetKcalPerDay: null,
        onGlp1: false,
      }),
    ).toEqual({
      main: "Nothing logged in the last 7 days.",
      note: null,
    });
  });

  it("non-GLP-1 frames the week against target", () => {
    const copy = intakeWeekCopy({
      stats: { pct: 80, avgKcal: 2150, loggedDays: 6, proteinDays: 3 },
      targetKcalPerDay: 2500,
      onGlp1: false,
    });
    expect(copy.main).toContain("under target");
  });

  it("GLP-1 mode reports numbers, no deficit wording, protein note", () => {
    const copy = intakeWeekCopy({
      stats: { pct: 80, avgKcal: 2150, loggedDays: 6, proteinDays: 3 },
      targetKcalPerDay: 2500,
      onGlp1: true,
    });
    expect(copy.main).not.toMatch(/deficit|surplus|under target|over target/i);
    expect(copy.main).toContain("2,150 kcal");
    expect(copy.note).toContain("Protein first");
    expect(copy.note).not.toMatch(/deficit|surplus/i);
  });

  it("GLP-1 without a target points at cycle targets", () => {
    const copy = intakeWeekCopy({
      stats: { pct: null, avgKcal: 1800, loggedDays: 2, proteinDays: 0 },
      targetKcalPerDay: null,
      onGlp1: true,
    });
    expect(copy.note).toContain("cycle target");
  });

  it("on-target week within 50 kcal", () => {
    const copy = intakeWeekCopy({
      stats: { pct: 100, avgKcal: 2480, loggedDays: 7, proteinDays: 7 },
      targetKcalPerDay: 2500,
      onGlp1: false,
    });
    expect(copy.main).toBe("On target for the week.");
  });
});
