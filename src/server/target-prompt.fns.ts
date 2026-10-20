import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { useDb } from "#/db/client";
import * as schema from "#/db/schema";
import { requireProPlan } from "#/server/auth.core";
import { requireUser } from "./auth.fns";
import { applyMeasuredTargetForUser } from "./target-prompt.core";

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
    return applyMeasuredTargetForUser(me);
  },
);

export const dismissTargetPrompt = createServerFn({ method: "POST" }).handler(
  async () => {
    const me = await requireUser();
    requireProPlan(me);
    const now = new Date();
    await useDb()
      .update(schema.user)
      .set({ targetPromptLastDismissedAt: now, updatedAt: now })
      .where(eq(schema.user.id, me.id));
    return { ok: true };
  },
);
