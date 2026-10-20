import { and, asc, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { useDb, schema } from "#/db";
import { newShareToken, publicFirstName } from "#/lib/share";

/**
 * Public share-card logic (G2.6) — plain functions shared by server fns.
 *
 * PRIVACY: a card may only ever expose the owner's first name, unit system,
 * plan, cycle facts and weight numbers. Email, Telegram identity and every
 * other profile field stay out of the DTO by construction — do not widen the
 * selects below without revisiting that promise.
 */

export type SharedCycle = {
  phase: "cut" | "bulk" | "maintain";
  startDate: string;
  endDate: string | null;
  startWeightKg: number | null;
  targetRateKgPerWeek: number | null;
};

export type SharedCard = {
  firstName: string | null;
  unitSystem: "metric" | "imperial";
  plan: "free" | "pro";
  cycle: SharedCycle | null;
  currentWeightKg: number | null;
  /** current weight − cycle start weight; null when either side is missing */
  deltaKg: number | null;
  /** weight-only series, oldest first (feeds the read-only trend chart) */
  entries: Array<{ takenAt: string; weightKg: number }>;
};

/** Look up a public card by its opaque token. Unknown/revoked → null. */
export async function getSharedCardByToken(
  token: string,
): Promise<SharedCard | null> {
  const db = useDb();

  const [owner] = await db
    .select({
      id: schema.user.id,
      name: schema.user.name,
      unitSystem: schema.user.unitSystem,
      plan: schema.user.plan,
    })
    .from(schema.user)
    .where(
      and(eq(schema.user.shareToken, token), isNotNull(schema.user.shareToken)),
    )
    .limit(1);
  if (!owner) return null;

  // Latest cycle: the active one when present, else the most recent ended.
  const [cycleRow] = await db
    .select({
      phase: schema.cycles.phase,
      startDate: schema.cycles.startDate,
      endDate: schema.cycles.endDate,
      startWeightKg: schema.cycles.startWeightKg,
      targetRateKgPerWeek: schema.cycles.targetRateKgPerWeek,
    })
    .from(schema.cycles)
    .where(eq(schema.cycles.userId, owner.id))
    .orderBy(desc(isNull(schema.cycles.endDate)), desc(schema.cycles.startDate))
    .limit(1);

  const weightRows = await db
    .select({
      takenAt: schema.measurements.takenAt,
      weightKg: schema.measurements.weightKg,
    })
    .from(schema.measurements)
    .where(
      and(
        eq(schema.measurements.userId, owner.id),
        isNotNull(schema.measurements.weightKg),
      ),
    )
    .orderBy(asc(schema.measurements.takenAt));

  const entries = weightRows.map((r) => ({
    takenAt: r.takenAt.toISOString(),
    weightKg: r.weightKg as number,
  }));
  const currentWeightKg =
    entries.length > 0 ? entries[entries.length - 1].weightKg : null;
  const deltaKg =
    cycleRow?.startWeightKg != null && currentWeightKg != null
      ? currentWeightKg - cycleRow.startWeightKg
      : null;

  return {
    firstName: publicFirstName(owner.name),
    unitSystem: owner.unitSystem,
    plan: owner.plan,
    cycle: cycleRow
      ? {
          phase: cycleRow.phase,
          startDate: cycleRow.startDate.toISOString(),
          endDate: cycleRow.endDate ? cycleRow.endDate.toISOString() : null,
          startWeightKg: cycleRow.startWeightKg,
          targetRateKgPerWeek: cycleRow.targetRateKgPerWeek,
        }
      : null,
    currentWeightKg,
    deltaKg,
    entries,
  };
}

/** Issue a fresh token for the owner, revoking every previously shared link. */
export async function rotateShareToken(userId: string): Promise<string> {
  const token = newShareToken();
  await useDb()
    .update(schema.user)
    .set({ shareToken: token, updatedAt: new Date() })
    .where(eq(schema.user.id, userId));
  return token;
}
