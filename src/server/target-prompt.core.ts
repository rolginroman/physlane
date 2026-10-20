import { and, eq, isNull } from "drizzle-orm";
import { useDb } from "#/db/client";
import * as schema from "#/db/schema";
import { computeTdee } from "#/lib/tdee";
import { normalizeTargetKcal } from "#/lib/kcal-start";
import { appError } from "#/lib/app-error";
import { requireProPlan, type SessionUser } from "./auth.core";
import { loadIntakeContext } from "./intake.core";

export type ApplyMeasuredTargetResult = {
  ok: true;
  kcalTargetPerDay: number;
};

/** Pro-only: apply measured burn to the open cycle and record prompt state. */
export async function applyMeasuredTargetForUser(
  user: SessionUser,
): Promise<ApplyMeasuredTargetResult> {
  requireProPlan(user);

  const ctx = await loadIntakeContext(user.id);
  const result = computeTdee(ctx.entries);
  if (result.status !== "ready") throw appError("NOT_READY");

  const target = normalizeTargetKcal(result.kcal);
  const now = new Date();
  const db = useDb();

  // Update the open cycle's kcal target (the settings write path for targets).
  await db
    .update(schema.cycles)
    .set({ kcalTargetPerDay: target })
    .where(
      and(eq(schema.cycles.userId, user.id), isNull(schema.cycles.endDate)),
    );

  await db
    .update(schema.user)
    .set({
      targetPromptLastAppliedAt: now,
      targetPromptAppliedKcal: result.kcal,
      updatedAt: now,
    })
    .where(eq(schema.user.id, user.id));

  return { ok: true, kcalTargetPerDay: target };
}
