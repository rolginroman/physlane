import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { useDb } from "#/db/client";
import * as schema from "#/db/schema";
import { requireUser } from "./auth.fns";
import {
  latestMeasurementForUser,
  listMeasurementsForUser,
  saveMeasurementForUser,
  SaveMeasurementInputSchema,
  type MeasurementDTO,
} from "./measurements.core";

export type { MeasurementDTO };

const DeleteMeasurementInputSchema = z.object({
  id: z.string(),
});

/** Full history (pro) or last 90 days (free), oldest first. */
export const listMeasurements = createServerFn({ method: "GET" }).handler(
  async () => {
    const me = await requireUser();
    return listMeasurementsForUser(me);
  },
);

export const saveMeasurement = createServerFn({ method: "POST" })
  .validator((d) => SaveMeasurementInputSchema.parse(d))
  .handler(async ({ data }) => {
    const me = await requireUser();
    await saveMeasurementForUser(me, data);
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
    return latestMeasurementForUser(me);
  },
);
