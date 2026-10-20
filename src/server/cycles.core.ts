import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { useDb } from "#/db/client";
import * as schema from "#/db/schema";
import type { SessionUser } from "./auth.core";
import { planActiveCycleEndOnSave } from "./cycles.transition";

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

const CyclePhaseSchema = z.enum(["cut", "bulk", "maintain"]);

export const SaveCycleInputSchema = z.object({
  id: z.string().optional(),
  phase: CyclePhaseSchema,
  startDate: z.string(),
  endDate: z.string().nullable().optional(),
  startWeightKg: z.number().nullable().optional(),
  targetRateKgPerWeek: z.number().nullable().optional(),
  kcalTargetPerDay: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type CycleInput = z.infer<typeof SaveCycleInputSchema>;

export { planActiveCycleEndOnSave } from "./cycles.transition";
export type { ActiveCycleEndPlan } from "./cycles.transition";

export const toCycleDTO = (c: schema.Cycle): CycleDTO => ({
  id: c.id,
  phase: c.phase,
  startDate: new Date(c.startDate).toISOString(),
  endDate: c.endDate ? new Date(c.endDate).toISOString() : null,
  startWeightKg: c.startWeightKg,
  targetRateKgPerWeek: c.targetRateKgPerWeek,
  kcalTargetPerDay: c.kcalTargetPerDay,
  notes: c.notes,
});

export async function listCyclesForUser(
  user: SessionUser,
): Promise<CycleDTO[]> {
  const rows = await useDb()
    .select()
    .from(schema.cycles)
    .where(eq(schema.cycles.userId, user.id))
    .orderBy(desc(schema.cycles.startDate));
  return rows.map(toCycleDTO);
}

export async function saveCycleForUser(
  user: SessionUser,
  input: CycleInput,
): Promise<CycleDTO> {
  const db = useDb();
  const now = new Date();
  const endPlan = planActiveCycleEndOnSave(input, now);

  if (endPlan.shouldEndOpenCycles) {
    await db
      .update(schema.cycles)
      .set({ endDate: endPlan.endOpenCyclesAt })
      .where(
        and(eq(schema.cycles.userId, user.id), isNull(schema.cycles.endDate)),
      );
  }

  const id = input.id ?? crypto.randomUUID();
  const values = {
    userId: user.id,
    phase: input.phase,
    startDate: new Date(input.startDate),
    endDate: input.endDate ? new Date(input.endDate) : null,
    startWeightKg: input.startWeightKg ?? null,
    targetRateKgPerWeek: input.targetRateKgPerWeek ?? null,
    kcalTargetPerDay: input.kcalTargetPerDay ?? null,
    notes: input.notes?.trim() || null,
  };

  if (input.id) {
    await db
      .update(schema.cycles)
      .set(values)
      .where(
        and(eq(schema.cycles.id, input.id), eq(schema.cycles.userId, user.id)),
      );
  } else {
    await db.insert(schema.cycles).values({ id, ...values });
  }

  return {
    id,
    phase: values.phase,
    startDate: values.startDate.toISOString(),
    endDate: values.endDate ? values.endDate.toISOString() : null,
    startWeightKg: values.startWeightKg,
    targetRateKgPerWeek: values.targetRateKgPerWeek,
    kcalTargetPerDay: values.kcalTargetPerDay,
    notes: values.notes,
  };
}
