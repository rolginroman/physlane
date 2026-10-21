import { createServerFn } from "@tanstack/react-start";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { useDb } from "#/db/client";
import * as schema from "#/db/schema";
import { appError } from "#/lib/app-error";
import { isValidIntakeDate } from "#/lib/intake-logic";
import { intakeStreak } from "#/lib/adherence";
import { captureEvent } from "#/lib/analytics/server";
import { requireUser } from "./auth.fns";
import {
  buildTdeeStatusForUser,
  intakeRangeForUser,
  upsertIntakeForUser,
  type DailyIntakeDTO,
  type ProjectionDTO,
} from "./intake.core";

export type { DailyIntakeDTO, ProjectionDTO };
export type TdeeStatusResult = import("#/lib/band").TdeeStatusPayload;
export type TargetPromptPayload = import("#/lib/band").TargetPromptPayload;

const toDTO = (r: schema.DailyIntake): DailyIntakeDTO => ({
  date: r.date,
  kcal: r.kcal,
  proteinG: r.proteinG,
});

/** Canonical UTC 'YYYY-MM-DD' for a Date/epoch-ms. */
const toDate = (d: Date): string => d.toISOString().slice(0, 10);

const GetOrCreateIntakeInputSchema = z.object({
  date: z.string(),
});

const UpsertIntakeInputSchema = z.object({
  date: z.string(),
  kcal: z.number(),
  proteinG: z.number().nullable().optional(),
});

const IntakeRangeInputSchema = z.object({
  from: z.string(),
  to: z.string(),
});

/** Existing row for the date, or a transient default — nothing is inserted here. */
export const getOrCreateIntake = createServerFn({ method: "GET" })
  .validator((d) => GetOrCreateIntakeInputSchema.parse(d))
  .handler(async ({ data }) => {
    const me = await requireUser();
    if (!isValidIntakeDate(data.date)) throw appError("INVALID_DATE");
    const [row] = await useDb()
      .select()
      .from(schema.dailyIntake)
      .where(
        and(
          eq(schema.dailyIntake.userId, me.id),
          eq(schema.dailyIntake.date, data.date),
        ),
      )
      .limit(1);
    return row ? toDTO(row) : { date: data.date, kcal: null, proteinG: null };
  });

/** Insert-or-update the user's row for a date (I5: one row per user-date, idempotent). */
export const upsertIntake = createServerFn({ method: "POST" })
  .validator((d) => UpsertIntakeInputSchema.parse(d))
  .handler(async ({ data }) => {
    const me = await requireUser();
    await upsertIntakeForUser(me, data);
    captureEvent({ name: "intake_logged" }, me.id);
    return { ok: true };
  });

/** Intake history ascending. Free plan: `from` clamped to 90 days back (F12). */
export const intakeRange = createServerFn({ method: "GET" })
  .validator((d) => IntakeRangeInputSchema.parse(d))
  .handler(async ({ data }) => {
    const me = await requireUser();
    return intakeRangeForUser(me, { from: data.from, to: data.to });
  });

/**
 * TDEE pipeline state: intake kcal joined with same-day measurement weights.
 * Free users get status + pair count + the confidence band but never the
 * estimate numbers; the gate itself lives in the pure shaper (src/lib/band.ts).
 */
export const tdeeStatus = createServerFn({ method: "GET" }).handler(
  async () => {
    const me = await requireUser();
    return buildTdeeStatusForUser(me);
  },
);

/**
 * Consecutive-day intake logging streak (F17), ending today. An unlogged
 * today does not break it: the grace lives in the pure fn, not here.
 */
export const getIntakeStreak = createServerFn({ method: "GET" }).handler(
  async () => {
    const me = await requireUser();
    const rows = await useDb()
      .select({ date: schema.dailyIntake.date })
      .from(schema.dailyIntake)
      .where(eq(schema.dailyIntake.userId, me.id));
    return {
      streak: intakeStreak(
        rows.map((r) => r.date),
        toDate(new Date()),
      ),
    };
  },
);
