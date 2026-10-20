import { createServerFn } from "@tanstack/react-start";
import { asc, eq } from "drizzle-orm";
import { useDb, schema } from "#/db";
import { requireUser } from "./auth.fns";
import { buildIntakeCsv, buildMeasurementsCsv } from "#/lib/csv";

/**
 * Data export as CSV strings (G1.5). Available to every plan — no Pro gate:
 * users can always take their own numbers with them. All rows, canonical
 * units (kg + cm), oldest first. Builders + escaping live in #/lib/csv.
 */

export const exportMeasurementsCsv = createServerFn({ method: "GET" }).handler(
  async () => {
    const me = await requireUser();
    const rows = await useDb()
      .select()
      .from(schema.measurements)
      .where(eq(schema.measurements.userId, me.id))
      .orderBy(asc(schema.measurements.takenAt));
    return buildMeasurementsCsv(
      rows.map((m) => ({
        takenAtIso: new Date(m.takenAt).toISOString(),
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
      })),
    );
  },
);

export const exportIntakeCsv = createServerFn({ method: "GET" }).handler(
  async () => {
    const me = await requireUser();
    const rows = await useDb()
      .select({ date: schema.dailyIntake.date, kcal: schema.dailyIntake.kcal })
      .from(schema.dailyIntake)
      .where(eq(schema.dailyIntake.userId, me.id))
      .orderBy(asc(schema.dailyIntake.date));
    return buildIntakeCsv(rows.map((r) => ({ date: r.date, kcal: r.kcal })));
  },
);
