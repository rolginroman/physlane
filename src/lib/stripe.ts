import Stripe from "stripe";
import { env } from "cloudflare:workers";

/** Lazily-constructed Stripe client (fetch-based HTTP works on Workers). Null when unconfigured. */
export function useStripe(): Stripe | null {
  if (!env.STRIPE_SECRET_KEY) return null;
  return new Stripe(env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
    appInfo: { name: "physlane", version: "2.0.0" },
  });
}

export function stripeConfigured(): boolean {
  return Boolean(
    env.STRIPE_SECRET_KEY &&
    env.STRIPE_WEBHOOK_SECRET &&
    env.STRIPE_PRICE_MONTHLY &&
    env.STRIPE_PRICE_YEARLY,
  );
}
