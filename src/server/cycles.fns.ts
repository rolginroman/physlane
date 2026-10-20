import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, isNull } from "drizzle-orm";
import { useDb, schema } from "#/db";
import { requireUser } from "./auth.fns";

export type CycleDTO = {
  id: string;
  phase: "cut" | "bulk" | "maintain";
  startDate: string;
  endDate: string | null;
  startWeightKg: number | null;
  targetRateKgPerWeek: number | null;
  kcalTargetPerDay: number | null;
  notes: string | null;
};

type CycleInput = {
  id?: string;
  phase: "cut" | "bulk" | "maintain";
  startDate: string;
  endDate?: string | null;
  startWeightKg?: number | null;
  targetRateKgPerWeek?: number | null;
  kcalTargetPerDay?: number | null;
  notes?: string | null;
};

const toCycleDTO = (c: schema.Cycle): CycleDTO => ({
  id: c.id,
  phase: c.phase,
  startDate: new Date(c.startDate).toISOString(),
  endDate: c.endDate ? new Date(c.endDate).toISOString() : null,
  startWeightKg: c.startWeightKg,
  targetRateKgPerWeek: c.targetRateKgPerWeek,
  kcalTargetPerDay: c.kcalTargetPerDay,
  notes: c.notes,
});

export const listCycles = createServerFn({ method: "GET" }).handler(
  async () => {
    const me = await requireUser();
    const rows = await useDb()
      .select()
      .from(schema.cycles)
      .where(eq(schema.cycles.userId, me.id))
      .orderBy(desc(schema.cycles.startDate));
    return rows.map(toCycleDTO);
  },
);

/** The user's open cycle (endDate null), latest startDate first. Null when none is running. */
export const getActiveCycle = createServerFn({ method: "GET" }).handler(
  async () => {
    const me = await requireUser();
    const [row] = await useDb()
      .select()
      .from(schema.cycles)
      .where(
        and(eq(schema.cycles.userId, me.id), isNull(schema.cycles.endDate)),
      )
      .orderBy(desc(schema.cycles.startDate))
      .limit(1);
    return row ? toCycleDTO(row) : null;
  },
);

/** Onboarding gate: has this user ever created a cycle? */
export const hasAnyCycle = createServerFn({ method: "GET" }).handler(
  async () => {
    const me = await requireUser();
    const [row] = await useDb()
      .select({ id: schema.cycles.id })
      .from(schema.cycles)
      .where(eq(schema.cycles.userId, me.id))
      .limit(1);
    return Boolean(row);
  },
);

export const saveCycle = createServerFn({ method: "POST" })
  .validator((d: CycleInput) => d)
  .handler(async ({ data }) => {
    const me = await requireUser();
    const db = useDb();

    // Invariant I2 (single active cycle): starting a new cycle, or updating one
    // to active, auto-ends any currently open cycle first. Powers cut→bulk rollover.
    if (!data.endDate) {
      await db
        .update(schema.cycles)
        .set({ endDate: new Date() })
        .where(
          and(eq(schema.cycles.userId, me.id), isNull(schema.cycles.endDate)),
        );
    }

    const values = {
      userId: me.id,
      phase: data.phase,
      startDate: new Date(data.startDate),
      endDate: data.endDate ? new Date(data.endDate) : null,
      startWeightKg: data.startWeightKg ?? null,
      targetRateKgPerWeek: data.targetRateKgPerWeek ?? null,
      kcalTargetPerDay: data.kcalTargetPerDay ?? null,
      notes: data.notes?.trim() || null,
    };

    if (data.id) {
      await db
        .update(schema.cycles)
        .set(values)
        .where(
          and(eq(schema.cycles.id, data.id), eq(schema.cycles.userId, me.id)),
        );
    } else {
      await db
        .insert(schema.cycles)
        .values({ id: crypto.randomUUID(), ...values });
    }
    return { ok: true };
  });

export const endActiveCycle = createServerFn({ method: "POST" })
  .validator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const me = await requireUser();
    await useDb()
      .update(schema.cycles)
      .set({ endDate: new Date() })
      .where(
        and(eq(schema.cycles.id, data.id), eq(schema.cycles.userId, me.id)),
      );
    return { ok: true };
  });
