import { describe, expect, it } from "vitest";
import { planActiveCycleEndOnSave } from "../cycles.transition";

describe("planActiveCycleEndOnSave", () => {
  it("starting a new active cycle ends open cycles at the provided instant", () => {
    const now = new Date("2026-10-18T14:30:00.000Z");
    const plan = planActiveCycleEndOnSave({}, now);
    expect(plan.shouldEndOpenCycles).toBe(true);
    expect(plan.endOpenCyclesAt).toEqual(now);
    expect(plan.endOpenCyclesAt.toISOString()).toBe("2026-10-18T14:30:00.000Z");
  });

  it("saving with an explicit endDate does not auto-end other cycles", () => {
    const plan = planActiveCycleEndOnSave(
      { endDate: "2026-06-01T00:00:00.000Z" },
      new Date(),
    );
    expect(plan.shouldEndOpenCycles).toBe(false);
  });
});
