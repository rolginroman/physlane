import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { and, asc, desc, eq, gte } from "drizzle-orm";
import { useDb } from "#/db/client";
import * as schema from "#/db/schema";
import { requireUser } from "./auth.fns";

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

const SaveMeasurementInputSchema = z.object({
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

const DeleteMeasurementInputSchema = z.object({
  id: z.string(),
});

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

/** Full history (pro) or last 90 days (free), oldest first. */
export const listMeasurements = createServerFn({ method: "GET" }).handler(
  async () => {
    const me = await requireUser();
    const db = useDb();
    const base = db.select().from(schema.measurements);
    const rows =
      me.plan === "pro"
        ? await base
            .where(eq(schema.measurements.userId, me.id))
            .orderBy(asc(schema.measurements.takenAt))
        : await db
            .select()
            .from(schema.measurements)
            .where(
              and(
                eq(schema.measurements.userId, me.id),
                gte(
                  schema.measurements.takenAt,
                  new Date(Date.now() - FREE_HISTORY_DAYS * 864e5),
                ),
              ),
            )
            .orderBy(asc(schema.measurements.takenAt));
    return rows.map(toDTO);
  },
);

export const saveMeasurement = createServerFn({ method: "POST" })
  .validator((d) => SaveMeasurementInputSchema.parse(d))
  .handler(async ({ data }) => {
    const me = await requireUser();
    const db = useDb();
    const values = {
      userId: me.id,
      takenAt: new Date(data.takenAt),
      weightKg: data.weightKg ?? null,
      neckCm: data.neckCm ?? null,
      chestCm: data.chestCm ?? null,
      waistCm: data.waistCm ?? null,
      hipsCm: data.hipsCm ?? null,
      armLeftCm: data.armLeftCm ?? null,
      armRightCm: data.armRightCm ?? null,
      thighLeftCm: data.thighLeftCm ?? null,
      thighRightCm: data.thighRightCm ?? null,
      calfCm: data.calfCm ?? null,
      notes: data.notes?.trim() || null,
    };
    if (data.id) {
      await db
        .update(schema.measurements)
        .set(values)
        .where(
          and(
            eq(schema.measurements.id, data.id),
            eq(schema.measurements.userId, me.id),
          ),
        );
    } else {
      await db
        .insert(schema.measurements)
        .values({ id: crypto.randomUUID(), ...values });
    }
    return { ok: true };
  });

export const deleteMeasurement = createServerFn({ method: "POST" })
  .validator((d) => DeleteMeasurementInputSchema.parse(d))
  .handler(async ({ data }) => {
    const me = await requireUser();
    await useDb()
      .delete(schema.measurements)
      .where(
        and(
          eq(schema.measurements.id, data.id),
          eq(schema.measurements.userId, me.id),
        ),
      );
    return { ok: true };
  });

/** Latest entry per user (prefill source). */
export const latestMeasurement = createServerFn({ method: "GET" }).handler(
  async () => {
    const me = await requireUser();
    const [row] = await useDb()
      .select()
      .from(schema.measurements)
      .where(eq(schema.measurements.userId, me.id))
      .orderBy(desc(schema.measurements.takenAt))
      .limit(1);
    return row ? toDTO(row) : null;
  },
);
