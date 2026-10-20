import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { useDb } from "#/db/client";
import * as schema from "#/db/schema";
import { requireUser } from "./auth.fns";
import {
  listCyclesForUser,
  saveCycleForUser,
  SaveCycleInputSchema,
  toCycleDTO,
  type CycleDTO,
} from "./cycles.core";

export type { CycleDTO };

const EndActiveCycleInputSchema = z.object({
  id: z.string(),
});

export const listCycles = createServerFn({ method: "GET" }).handler(
  async () => {
    const me = await requireUser();
    return listCyclesForUser(me);
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
  .validator((d) => SaveCycleInputSchema.parse(d))
  .handler(async ({ data }) => {
    const me = await requireUser();
    await saveCycleForUser(me, data);
    return { ok: true };
  });

export const endActiveCycle = createServerFn({ method: "POST" })
  .validator((d) => EndActiveCycleInputSchema.parse(d))
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
