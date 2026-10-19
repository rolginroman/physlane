import { describe, expect, it } from "vitest";
import { deriveUserPatch, type PlanUserState } from "./billing.core";

const freeUser = (): PlanUserState => ({
	plan: "free",
	stripeSubscriptionId: null,
	planCurrentPeriodEnd: null,
});

const proUser = (subId = "sub_a", periodEnd: Date | null = new Date("2026-11-01T00:00:00Z")): PlanUserState => ({
	plan: "pro",
	stripeSubscriptionId: subId,
	planCurrentPeriodEnd: periodEnd,
});

const sub = (
	over: Partial<{
		id: string;
		status: string;
		itemPeriodEnd: number | null;
	}>,
) => ({
	id: over.id ?? "sub_test",
	status: over.status ?? "active",
	items: { data: [{ current_period_end: over.itemPeriodEnd ?? 1_762_512_000 }] },
});

describe("deriveUserPatch — activation", () => {
	it("promotes a free user when the fetched subscription is active", () => {
		const periodEnd = new Date(1_762_512_000 * 1000);
		const patch = deriveUserPatch(sub({ status: "active", itemPeriodEnd: 1_762_512_000 }), freeUser());
		expect(patch).toEqual({
			plan: "pro",
			stripeSubscriptionId: "sub_test",
			planCurrentPeriodEnd: periodEnd,
		});
	});

	it("promotes a free user when the fetched subscription is trialing", () => {
		const patch = deriveUserPatch(sub({ status: "trialing" }), freeUser());
		expect(patch.plan).toBe("pro");
	});
});

describe("deriveUserPatch — demotion by status", () => {
	for (const status of ["past_due", "unpaid"] as const) {
		it(`demotes to free but retains stripeSubscriptionId when status is ${status}`, () => {
			const patch = deriveUserPatch(sub({ status, id: "sub_a" }), proUser("sub_a"));
			expect(patch.plan).toBe("free");
			expect(patch.stripeSubscriptionId).toBeUndefined();
		});
	}

	it("demotes to free when status is canceled", () => {
		const patch = deriveUserPatch(sub({ status: "canceled", id: "sub_a" }), proUser("sub_a"));
		expect(patch.plan).toBe("free");
	});
});

describe("deriveUserPatch — foreign subscription events", () => {
	it("ignores canceled events for a different subscription when user is bound elsewhere", () => {
		const patch = deriveUserPatch(sub({ id: "sub_old", status: "canceled" }), proUser("sub_cur"));
		expect(patch).toEqual({});
	});

	it("ignores past_due events for a different subscription when user is bound elsewhere", () => {
		const patch = deriveUserPatch(sub({ id: "sub_old", status: "past_due" }), proUser("sub_cur"));
		expect(patch).toEqual({});
	});

	it("rebinds stripeSubscriptionId when a different subscription is active", () => {
		const patch = deriveUserPatch(sub({ id: "sub_new", status: "active" }), proUser("sub_cur"));
		expect(patch.stripeSubscriptionId).toBe("sub_new");
		expect(patch.plan).toBeUndefined();
	});
});

describe("deriveUserPatch — reorder protection (mapping boundary; handler always re-fetches)", () => {
	it("demotes a pro user when the fetched subscription is canceled and clears sub id", () => {
		const patch = deriveUserPatch(sub({ status: "canceled", id: "sub_a" }), proUser("sub_a"));
		expect(patch).toMatchObject({ plan: "free", stripeSubscriptionId: null });
	});

	it("re-promotes to pro when input subscription is active even if user is currently free (stale replay)", () => {
		const patch = deriveUserPatch(sub({ status: "active", id: "sub_stale" }), freeUser());
		expect(patch.plan).toBe("pro");
		expect(patch.stripeSubscriptionId).toBe("sub_stale");
	});
});

describe("deriveUserPatch — idempotency", () => {
	it("returns {} when subscription state already matches the user", () => {
		const periodEnd = new Date(1_762_512_000 * 1000);
		const user = proUser("sub_test", periodEnd);
		const patch = deriveUserPatch(
			sub({ status: "active", id: "sub_test", itemPeriodEnd: 1_762_512_000 }),
			user,
		);
		expect(patch).toEqual({});
	});

	it("omits planCurrentPeriodEnd when unchanged", () => {
		const periodEnd = new Date(1_762_512_000 * 1000);
		const user = proUser("sub_test", periodEnd);
		const patch = deriveUserPatch(
			sub({ status: "active", id: "sub_test", itemPeriodEnd: 1_762_512_000 }),
			user,
		);
		expect(patch.planCurrentPeriodEnd).toBeUndefined();
	});
});
