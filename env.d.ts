/**
 * Secrets configured via `wrangler secret put` (or `.dev.vars` locally).
 * `wrangler types` only types bindings/vars declared in wrangler.jsonc, so
 * optional secret bindings are augmented here. All are runtime-optional;
 * code must null-check before use.
 */
declare namespace Cloudflare {
	interface Env {
		/** Secrets for the Telegram Mini App auth flow (tele-better-auth). */
		TELEGRAM_BOT_TOKEN?: string;
		TELEGRAM_BOT_USERNAME?: string;
		AUTH_SECRET?: string;
		STRIPE_SECRET_KEY?: string;
		STRIPE_WEBHOOK_SECRET?: string;
		STRIPE_PRICE_MONTHLY?: string;
		STRIPE_PRICE_YEARLY?: string;
	}
}
