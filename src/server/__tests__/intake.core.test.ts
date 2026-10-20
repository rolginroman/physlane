import { describe, expect, it } from "vitest";
import { buildIntakeProjection, freeHistoryFloor } from "../intake.core";

const baseCycle = {
  phase: "cut" as const,
  targetRateKgPerWeek: -0.5,
  kcalTargetPerDay: 2200,
};

describe("freeHistoryFloor", () => {
  const pinnedNow = new Date("2026-10-20T12:00:00.000Z");

  it("clamps free plan when from is older than the floor", () => {
    expect(
      freeHistoryFloor({
        plan: "free",
        from: "2020-01-01",
        now: pinnedNow,
      }),
    ).toBe("2026-07-22");
  });

  it("keeps from unchanged for pro plan", () => {
    expect(
      freeHistoryFloor({
        plan: "pro",
        from: "2020-01-01",
        now: pinnedNow,
      }),
    ).toBe("2020-01-01");
  });

  it("keeps recent from for free plan when above the floor", () => {
    expect(
      freeHistoryFloor({
        plan: "free",
        from: "2026-10-01",
        now: pinnedNow,
      }),
    ).toBe("2026-10-01");
  });

  it("computes the floor from pinned now", () => {
    const floorOnly = freeHistoryFloor({
      plan: "free",
      from: "1900-01-01",
      now: pinnedNow,
    });
    expect(floorOnly).toBe("2026-07-22");
  });
});

describe("buildIntakeProjection", () => {
  it("uses the latest non-null weight in ascending measurement rows", () => {
    const projection = buildIntakeProjection({
      intakeRows: [{ date: "2026-10-01", kcal: 2000 }],
      measurementRows: [
        { takenAt: new Date("2026-09-20T08:00:00Z"), weightKg: 82 },
        { takenAt: new Date("2026-09-25T08:00:00Z"), weightKg: null },
        { takenAt: new Date("2026-10-01T08:00:00Z"), weightKg: 79.5 },
      ],
      tdeeKcal: 2500,
      activeCycle: baseCycle,
    });
    expect(projection?.currentWeightKg).toBe(79.5);
    expect(projection?.avgIntakeKcal).toBe(2000);
  });

  it("returns null when no logged intake days exist for the avg window", () => {
    const projection = buildIntakeProjection({
      intakeRows: [
        { date: "2026-10-01", kcal: null },
        { date: "2026-10-02", kcal: null },
      ],
      measurementRows: [
        { takenAt: new Date("2026-10-01T08:00:00Z"), weightKg: 80 },
      ],
      tdeeKcal: 2500,
      activeCycle: baseCycle,
    });
    expect(projection).toBeNull();
  });

  it("returns null when projectWeight rejects non-finite TDEE", () => {
    const projection = buildIntakeProjection({
      intakeRows: [{ date: "2026-10-01", kcal: 2000 }],
      measurementRows: [
        { takenAt: new Date("2026-10-01T08:00:00Z"), weightKg: 80 },
      ],
      tdeeKcal: Number.NaN,
      activeCycle: baseCycle,
    });
    expect(projection).toBeNull();
  });
});
import { beforeEach, vi } from "vitest";
import { upsertIntakeForUser } from "../intake.core";
import { assembleTdeeStatusPayload } from "../intake.tdee-assembly";
import type { IntakeContext } from "../intake.types";
import type { SessionUser } from "../auth.core";
import * as band from "#/lib/band";

const upsertDb = vi.hoisted(() => ({
  conflictSet: undefined as Record<string, unknown> | undefined,
  insertProteinG: undefined as number | null | undefined,
  returningProteinG: 150 as number | null,
}));

vi.mock("#/db/client", async () => {
  const schema = await import("#/db/schema");
  return {
    schema,
    useDb: () => ({
      insert: () => ({
        values: (row: { proteinG?: number | null }) => {
          upsertDb.insertProteinG = row.proteinG;
          return {
            onConflictDoUpdate: ({ set }: { set: Record<string, unknown> }) => {
              upsertDb.conflictSet = set;
              return {
                returning: async () => [
                  {
                    id: "intake-1",
                    userId: "u1",
                    date: "2026-10-05",
                    kcal: 2100,
                    proteinG: upsertDb.returningProteinG,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  },
                ],
              };
            },
          };
        },
      }),
    }),
  };
});

const freeUser = (): SessionUser => ({
  id: "u1",
  name: "Test",
  email: "t@example.com",
  unitSystem: "metric",
  plan: "free",
  onGlp1: false,
  heightCm: null,
  sex: null,
  telegramId: null,
  reminderTime: null,
  reminderTz: null,
  shareToken: null,
  targetPromptLastAppliedAt: null,
  targetPromptLastDismissedAt: null,
  targetPromptAppliedKcal: null,
});

const emptyCtx = (): IntakeContext => ({
  entries: [],
  intakeRows: [],
  measurementRows: [],
});

const readyResult = () => ({
  status: "ready" as const,
  kcal: 2600,
  spreadKcal: 120,
  weeklyEstimates: [{ weekStart: "2026-01-01", kcal: 2600 }],
  pairs: 14,
  outliersRejected: 0,
});

describe("assembleTdeeStatusPayload — Pro gate", () => {
  const now = new Date("2026-10-18T00:00:00Z");

  it("free plan: no estimate kcal or projection numbers in the shaped payload", () => {
    const payload = assembleTdeeStatusPayload(
      freeUser(),
      emptyCtx(),
      readyResult(),
      null,
      now,
    );
    expect(payload.status).toBe("ready");
    if (payload.status !== "ready") return;
    expect(payload.gated).toBe(true);
    expect(payload.kcal).toBeNull();
    expect(payload.spreadKcal).toBeNull();
    expect(payload.weeklyEstimates).toBeNull();
    expect(payload.projection).toBeNull();
    expect(payload.targetPrompt.measuredKcal).toBeNull();
    const json = JSON.stringify(payload);
    expect(json).not.toContain("2600");
  });

  it("fails the gate if shapeTdeeStatus is bypassed (mutation check)", () => {
    const spy = vi.spyOn(band, "shapeTdeeStatus");
    try {
      assembleTdeeStatusPayload(
        freeUser(),
        emptyCtx(),
        readyResult(),
        null,
        now,
      );
      expect(spy).toHaveBeenCalled();
      const bypass = {
        status: "ready" as const,
        gated: false,
        kcal: 2600,
        spreadKcal: 120,
        confidence: 1,
        bandKcal: 80,
        pairs: 14,
        weeklyEstimates: [{ weekStart: "2026-01-01", kcal: 2600 }],
        projection: null,
        targetPrompt: { eligible: false, measuredKcal: 2600 },
        drift: null,
        driftFired: false,
      };
      expect(JSON.stringify(bypass)).toContain("2600");
      expect(bypass.kcal).not.toBeNull();
    } finally {
      spy.mockRestore();
    }
  });
});

describe("upsertIntakeForUser — proteinG on update", () => {
  const user = freeUser();

  beforeEach(() => {
    upsertDb.conflictSet = undefined;
    upsertDb.insertProteinG = undefined;
    upsertDb.returningProteinG = 150;
  });

  it("omitted proteinG preserves existing column on conflict (not in UPDATE set)", async () => {
    await upsertIntakeForUser(user, { date: "2026-10-05", kcal: 2100 });
    expect(upsertDb.insertProteinG).toBeNull();
    expect(upsertDb.conflictSet).toBeDefined();
    expect(upsertDb.conflictSet).not.toHaveProperty("proteinG");
    expect(upsertDb.conflictSet?.kcal).toBe(2100);
  });

  it("explicit null clears protein on conflict", async () => {
    await upsertIntakeForUser(user, {
      date: "2026-10-05",
      kcal: 2100,
      proteinG: null,
    });
    expect(upsertDb.conflictSet?.proteinG).toBeNull();
  });

  it("explicit proteinG updates on conflict", async () => {
    await upsertIntakeForUser(user, {
      date: "2026-10-05",
      kcal: 2100,
      proteinG: 140,
    });
    expect(upsertDb.conflictSet?.proteinG).toBe(140);
  });
});
