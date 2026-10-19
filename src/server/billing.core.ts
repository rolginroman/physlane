/**
 * Stripe billing plan derivation — plain logic, no db/webhook IO (mirrors digest.core).
 */

import type Stripe from "stripe";
import type { UserRow, user } from "#/db/schema";

export type PlanUserState = Pick<UserRow, "plan" | "stripeSubscriptionId" | "planCurrentPeriodEnd">;
export type PlanUserPatch = Partial<typeof user.$inferInsert>;

export function deriveUserPatch(
	sub: Pick<Stripe.Subscription, "id" | "status"> & {
		items: { data: { current_period_end: number | null }[] };
	},
	user: PlanUserState,
): PlanUserPatch {
	const active = sub.status === "active" || sub.status === "trialing";
	const targetPlan: "free" | "pro" = active ? "pro" : "free";
	const patch: PlanUserPatch = {};

	if (user.plan !== targetPlan) patch.plan = targetPlan;

	if (active) {
		if (sub.id && user.stripeSubscriptionId !== sub.id) {
			patch.stripeSubscriptionId = sub.id;
		}
	} else if (sub.status === "canceled") {
		if (user.stripeSubscriptionId !== null) {
			patch.stripeSubscriptionId = null;
		}
	} else if (sub.id && user.stripeSubscriptionId !== sub.id) {
		patch.stripeSubscriptionId = sub.id;
	}

	const periodEndSec = sub.items.data[0]?.current_period_end;
	if (periodEndSec != null) {
		const periodEnd = new Date(periodEndSec * 1000);
		if (!user.planCurrentPeriodEnd || user.planCurrentPeriodEnd.getTime() !== periodEnd.getTime()) {
			patch.planCurrentPeriodEnd = periodEnd;
		}
	}

	return patch;
}
