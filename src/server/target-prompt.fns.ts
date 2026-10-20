import { createServerFn } from "@tanstack/react-start";
import { and, eq, isNull } from "drizzle-orm";
import { useDb } from "#/db/client";
import * as schema from "#/db/schema";
import { requireUser } from "./auth.fns";
import { computeTdee } from "#/lib/tdee";
import { normalizeTargetKcal } from "#/lib/kcal-start";
import { loadIntakeContext } from "./intake.core";

/**
 * Day-14 target prompt actions (G3.2). Both are Pro-only and recompute the
 * measured burn server-side from the user's own series — a client-sent kcal
 * value is never trusted. Apply writes the active cycle's kcal target through
 * the same normalization the day-one prefill uses (round to 50s, clamp to the
 * valid range), which is the correction path that prefill was designed for.
 */

export const applyMeasuredTarget = createServerFn({ method: "POST" }).handler(
  async () => {
    const me = await requireUser();
    if (me.plan !== "pro") throw new Error("PRO_REQUIRED");

    const ctx = await loadIntakeContext(me.id);
    const result = computeTdee(ctx.entries);
    if (result.status !== "ready") throw new Error("NOT_READY");

    const target = normalizeTargetKcal(result.kcal);
    const now = new Date();
    const db = useDb();

    // Update the open cycle's kcal target (the settings write path for targets).
    await db
      .update(schema.cycles)
      .set({ kcalTargetPerDay: target })
      .where(
        and(eq(schema.cycles.userId, me.id), isNull(schema.cycles.endDate)),
      );

    await db
      .update(schema.user)
      .set({
        targetPromptLastAppliedAt: now,
        targetPromptAppliedKcal: result.kcal,
        updatedAt: now,
      })
      .where(eq(schema.user.id, me.id));

    return { ok: true, kcalTargetPerDay: target };
  },
);

export const dismissTargetPrompt = createServerFn({ method: "POST" }).handler(
  async () => {
    const me = await requireUser();
    if (me.plan !== "pro") throw new Error("PRO_REQUIRED");
    const now = new Date();
    await useDb()
      .update(schema.user)
      .set({ targetPromptLastDismissedAt: now, updatedAt: now })
      .where(eq(schema.user.id, me.id));
    return { ok: true };
  },
);
