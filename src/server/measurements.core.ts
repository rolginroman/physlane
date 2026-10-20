import { and, asc, desc, eq, gte } from "drizzle-orm";
import { z } from "zod";
import { useDb } from "#/db/client";
import * as schema from "#/db/schema";
import type { SessionUser } from "./auth.core";

const FREE_HISTORY_DAYS = 90;

export type MeasurementDTO = {
  id: string;
  takenAt: string;
  weightKg: number | null;
  neckCm: number | null;
  chestCm: number | null;
  waistCm: number | null;
  hipsCm: number | null;
  armLeftCm: number | null;
  armRightCm: number | null;
  thighLeftCm: number | null;
  thighRightCm: number | null;
  calfCm: number | null;
  notes: string | null;
};

export const SaveMeasurementInputSchema = z.object({
  id: z.string().optional(),
  takenAt: z.string(),
  weightKg: z.number().nullable().optional(),
  neckCm: z.number().nullable().optional(),
  chestCm: z.number().nullable().optional(),
  waistCm: z.number().nullable().optional(),
  hipsCm: z.number().nullable().optional(),
  armLeftCm: z.number().nullable().optional(),
  armRightCm: z.number().nullable().optional(),
  thighLeftCm: z.number().nullable().optional(),
  thighRightCm: z.number().nullable().optional(),
  calfCm: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export type MeasurementInput = z.infer<typeof SaveMeasurementInputSchema>;

const toDTO = (m: schema.Measurement): MeasurementDTO => ({
  id: m.id,
  takenAt: new Date(m.takenAt).toISOString(),
  weightKg: m.weightKg,
  neckCm: m.neckCm,
  chestCm: m.chestCm,
  waistCm: m.waistCm,
  hipsCm: m.hipsCm,
  armLeftCm: m.armLeftCm,
  armRightCm: m.armRightCm,
  thighLeftCm: m.thighLeftCm,
  thighRightCm: m.thighRightCm,
  calfCm: m.calfCm,
  notes: m.notes,
});

export async function listMeasurementsForUser(
  user: SessionUser,
): Promise<MeasurementDTO[]> {
  const db = useDb();
  const base = db.select().from(schema.measurements);
  const rows =
    user.plan === "pro"
      ? await base
          .where(eq(schema.measurements.userId, user.id))
          .orderBy(asc(schema.measurements.takenAt))
      : await db
          .select()
          .from(schema.measurements)
          .where(
            and(
              eq(schema.measurements.userId, user.id),
              gte(
                schema.measurements.takenAt,
                new Date(Date.now() - FREE_HISTORY_DAYS * 864e5),
              ),
            ),
          )
          .orderBy(asc(schema.measurements.takenAt));
  return rows.map(toDTO);
}

export async function saveMeasurementForUser(
  user: SessionUser,
  input: MeasurementInput,
): Promise<MeasurementDTO> {
  const db = useDb();
  const id = input.id ?? crypto.randomUUID();
  const values = {
    userId: user.id,
    takenAt: new Date(input.takenAt),
    weightKg: input.weightKg ?? null,
    neckCm: input.neckCm ?? null,
    chestCm: input.chestCm ?? null,
    waistCm: input.waistCm ?? null,
    hipsCm: input.hipsCm ?? null,
    armLeftCm: input.armLeftCm ?? null,
    armRightCm: input.armRightCm ?? null,
    thighLeftCm: input.thighLeftCm ?? null,
    thighRightCm: input.thighRightCm ?? null,
    calfCm: input.calfCm ?? null,
    notes: input.notes?.trim() || null,
  };
  if (input.id) {
    await db
      .update(schema.measurements)
      .set(values)
      .where(
        and(
          eq(schema.measurements.id, input.id),
          eq(schema.measurements.userId, user.id),
        ),
      );
  } else {
    await db.insert(schema.measurements).values({ id, ...values });
  }
  return {
    id,
    takenAt: values.takenAt.toISOString(),
    weightKg: values.weightKg,
    neckCm: values.neckCm,
    chestCm: values.chestCm,
    waistCm: values.waistCm,
    hipsCm: values.hipsCm,
    armLeftCm: values.armLeftCm,
    armRightCm: values.armRightCm,
    thighLeftCm: values.thighLeftCm,
    thighRightCm: values.thighRightCm,
    calfCm: values.calfCm,
    notes: values.notes,
  };
}

export async function latestMeasurementForUser(
  user: SessionUser,
): Promise<MeasurementDTO | null> {
  const [row] = await useDb()
    .select()
    .from(schema.measurements)
    .where(eq(schema.measurements.userId, user.id))
    .orderBy(desc(schema.measurements.takenAt))
    .limit(1);
  return row ? toDTO(row) : null;
}
