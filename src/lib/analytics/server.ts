/**
 * Server-side PostHog capture via plain `fetch` (no posthog-node).
 *
 * POST `${host || "https://us.i.posthog.com"}/capture/` with
 * `{ api_key, event, distinct_id, properties, timestamp }`. Cloudflare Workers
 * lack Node APIs and background flush timers; one JSON POST per event is
 * sufficient at pre-launch volume.
 *
 * `distinct_id` is the opaque DB user id (`uid`) — funnels group per user
 * without PostHog person merging (`identify()` is never used). Server persons
 * stay separate from client anonymous persons by design.
 *
 * Fire-and-forget: callers get `void`; failures are swallowed (no console).
 * Un-awaited fetches may be dropped after the response returns on Workers;
 * acceptable pre-launch — upgrade path is `waitUntil` when exposed.
 */
import { env } from "cloudflare:workers";
import type { AnalyticsEvent } from "#/lib/analytics/events";

const DEFAULT_HOST = "https://us.i.posthog.com";

export function captureEvent(event: AnalyticsEvent, uid?: string): void {
  const apiKey = env.POSTHOG_KEY;
  if (!apiKey) return;

  const host = env.POSTHOG_HOST?.trim() || DEFAULT_HOST;
  const base = host.replace(/\/+$/, "");
  const properties = {
    ...(uid ? { uid } : {}),
    ...("props" in event ? event.props : {}),
  };

  const body = JSON.stringify({
    api_key: apiKey,
    event: event.name,
    distinct_id: uid ?? "server",
    properties,
    timestamp: new Date().toISOString(),
  });

  void fetch(`${base}/capture/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  }).catch(() => {});
}
