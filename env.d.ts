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
    /** Shared secret required by the /api/telegram/remind cron endpoint. */
    CRON_SECRET?: string;
    /** Secret token Telegram sends on every webhook update (setWebhook). */
    TELEGRAM_WEBHOOK_SECRET?: string;
    AUTH_SECRET?: string;
    STRIPE_SECRET_KEY?: string;
    STRIPE_WEBHOOK_SECRET?: string;
  }
}
