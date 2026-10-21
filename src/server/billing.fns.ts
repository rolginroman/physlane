import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { env } from "cloudflare:workers";
import { useDb } from "#/db/client";
import * as schema from "#/db/schema";
import { captureEvent } from "#/lib/analytics/server";
import { requireUser } from "./auth.fns";
import { appError } from "#/lib/app-error";
import { useStripe, stripeConfigured } from "#/lib/stripe";

const CreateCheckoutInputSchema = z.object({
  interval: z.enum(["monthly", "yearly"]),
});

export const billingStatus = createServerFn({ method: "GET" }).handler(
  async () => {
    const me = await requireUser();
    const [row] = await useDb()
      .select({ planCurrentPeriodEnd: schema.user.planCurrentPeriodEnd })
      .from(schema.user)
      .where(eq(schema.user.id, me.id))
      .limit(1);
    return {
      plan: me.plan,
      onGlp1: me.onGlp1,
      configured: stripeConfigured(),
      planCurrentPeriodEndIso:
        row?.planCurrentPeriodEnd instanceof Date
          ? row.planCurrentPeriodEnd.toISOString()
          : null,
    };
  },
);

export const createCheckout = createServerFn({ method: "POST" })
  .validator((d) => CreateCheckoutInputSchema.parse(d))
  .handler(async ({ data }) => {
    const me = await requireUser();
    const stripe = useStripe();
    if (!stripe || !env.STRIPE_PRICE_MONTHLY || !env.STRIPE_PRICE_YEARLY) {
      throw appError("BILLING_NOT_CONFIGURED");
    }

    const db = useDb();

    // Find or create the Stripe customer.
    const [row] = await db
      .select({ stripeCustomerId: schema.user.stripeCustomerId })
      .from(schema.user)
      .where(eq(schema.user.id, me.id))
      .limit(1);
    let customer = row?.stripeCustomerId ?? null;
    if (!customer) {
      const created = await stripe.customers.create(
        {
          email: me.email,
          name: me.name,
          metadata: { userId: me.id },
        },
        { idempotencyKey: `customer:${me.id}` },
      );
      customer = created.id;
      await db
        .update(schema.user)
        .set({ stripeCustomerId: customer })
        .where(eq(schema.user.id, me.id));
    }

    const price =
      data.interval === "yearly"
        ? env.STRIPE_PRICE_YEARLY
        : env.STRIPE_PRICE_MONTHLY;
    const session = await stripe.checkout.sessions.create({
      customer,
      client_reference_id: me.id,
      mode: "subscription",
      line_items: [{ price, quantity: 1 }],
      success_url: `${env.APP_URL}/billing?checkout=success`,
      cancel_url: `${env.APP_URL}/billing?checkout=cancelled`,
      allow_promotion_codes: true,
      subscription_data: { metadata: { userId: me.id } },
    });
    captureEvent(
      { name: "checkout_started", props: { interval: data.interval } },
      me.id,
    );
    return { url: session.url };
  });

export const createBillingPortal = createServerFn({ method: "POST" }).handler(
  async () => {
    const me = await requireUser();
    const stripe = useStripe();
    if (!stripe) throw appError("BILLING_NOT_CONFIGURED");
    const [row] = await useDb()
      .select({ stripeCustomerId: schema.user.stripeCustomerId })
      .from(schema.user)
      .where(eq(schema.user.id, me.id))
      .limit(1);
    if (!row?.stripeCustomerId) throw appError("NO_STRIPE_CUSTOMER");
    const session = await stripe.billingPortal.sessions.create({
      customer: row.stripeCustomerId,
      return_url: `${env.APP_URL}/billing`,
    });
    return { url: session.url };
  },
);
