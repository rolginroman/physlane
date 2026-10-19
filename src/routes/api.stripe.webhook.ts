import { createFileRoute } from "@tanstack/react-router";
import { eq } from "drizzle-orm";
import Stripe from "stripe";
import { env } from "cloudflare:workers";
import { useDb, schema } from "#/db";
import { useStripe } from "#/lib/stripe";
import { deriveUserPatch, type PlanUserPatch } from "#/server/billing.core";

/**
 * Stripe webhook endpoint. POST-only.
 *
 * The ONLY place user.plan is written (BR2/I4): subscription state transitions
 * arrive here — never in billing.fns.ts. Idempotent: patches are skipped when
 * the stored state already matches the event.
 */
export const Route = createFileRoute("/api/stripe/webhook")({
	server: {
		handlers: {
			POST: async ({ request }: { request: Request }) => handleWebhook(request),
		},
	},
});

async function handleWebhook(request: Request): Promise<Response> {
	if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) {
		return new Response("billing not configured", { status: 503 });
	}
	const stripe = useStripe();
	if (!stripe) return new Response("billing not configured", { status: 503 });

	const payload = await request.text();
	const signature = request.headers.get("stripe-signature");
	if (!signature) return new Response("missing stripe-signature header", { status: 400 });

	let event: Stripe.Event;
	try {
		// constructEventAsync uses Web Crypto — safe on Workers.
		event = await stripe.webhooks.constructEventAsync(payload, signature, env.STRIPE_WEBHOOK_SECRET);
	} catch {
		return new Response("invalid signature", { status: 400 });
	}

	try {
		await processEvent(event, stripe);
	} catch (err) {
		console.error("stripe webhook handler error", event.type, err);
		return new Response("webhook handler error", { status: 500 });
	}
	return Response.json({ received: true });
}

async function processEvent(event: Stripe.Event, stripe: Stripe): Promise<void> {
	switch (event.type) {
		case "checkout.session.completed": {
			const session = event.data.object as Stripe.Checkout.Session;
			const customerId = expandableId(session.customer);
			const userId = session.metadata?.userId ?? session.client_reference_id ?? null;
			const user = await findUser(customerId, userId);
			if (!user) return;
			const subscriptionId = expandableId(session.subscription);
			const patch: PlanUserPatch = {};
			if (customerId && user.stripeCustomerId !== customerId) patch.stripeCustomerId = customerId;
			if (subscriptionId) {
				const sub = await retrieveSubscription(stripe, subscriptionId);
				Object.assign(patch, deriveUserPatch(sub, user));
			} else if (user.plan !== "pro") {
				patch.plan = "pro";
			}
			await applyPatch(user.id, patch);
			return;
		}
		case "customer.subscription.updated":
		case "customer.subscription.deleted": {
			const payloadSub = event.data.object as Stripe.Subscription;
			const user = await findUser(expandableId(payloadSub.customer), payloadSub.metadata?.userId ?? null);
			if (!user) return;
			const sub = await retrieveSubscription(
				stripe,
				payloadSub.id,
				event.type === "customer.subscription.deleted" ? payloadSub : undefined,
			);
			await applyPatch(user.id, deriveUserPatch(sub, user));
			return;
		}
		default:
			return; // unknown events: 200 no-op
	}
}

/** Fetch authoritative subscription state; deleted events may fall back to the webhook payload. */
async function retrieveSubscription(
	stripe: Stripe,
	subscriptionId: string,
	fallback?: Stripe.Subscription,
): Promise<Stripe.Subscription> {
	try {
		return await stripe.subscriptions.retrieve(subscriptionId);
	} catch (err) {
		if (fallback) return fallback;
		throw err;
	}
}

/** Write only when something actually changed (idempotent replays are no-ops). */
async function applyPatch(userId: string, patch: PlanUserPatch): Promise<void> {
	if (Object.keys(patch).length === 0) return;
	await useDb()
		.update(schema.user)
		.set({ ...patch, updatedAt: new Date() })
		.where(eq(schema.user.id, userId));
}

/** Look up by Stripe customer id first, then by client_reference_id / metadata userId. */
async function findUser(
	customerId: string | null,
	userId: string | null,
): Promise<schema.UserRow | null> {
	const db = useDb();
	if (customerId) {
		const [row] = await db
			.select()
			.from(schema.user)
			.where(eq(schema.user.stripeCustomerId, customerId))
			.limit(1);
		if (row) return row;
	}
	if (userId) {
		const [row] = await db.select().from(schema.user).where(eq(schema.user.id, userId)).limit(1);
		if (row) return row;
	}
	return null;
}

/** Stripe ids arrive as `"cus_x"` or an expanded object. */
function expandableId(
	value:
		| string
		| Stripe.Customer
		| Stripe.DeletedCustomer
		| Stripe.Subscription
		| null
		| undefined,
): string | null {
	if (typeof value === "string") return value;
	return value?.id ?? null;
}
