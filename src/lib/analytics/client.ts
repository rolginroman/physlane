/**
 * Client analytics via posthog-js (dynamic import only after a non-null key).
 *
 * After sign-in, `uid` is registered with `register_once({ uid })` — a super-
 * property, not `identify()` (no person merging). Server events use
 * `distinct_id=uid`; client anonymous persons remain separate by design.
 */
import { getAnalyticsConfig } from "#/lib/analytics/config.fns";
import {
  sanitizeAnalyticsPath,
  type AnalyticsEvent,
} from "#/lib/analytics/events";

type LoadedPostHog = Awaited<typeof import("posthog-js")>["default"];

let initPromise: Promise<void> | null = null;
let posthog: LoadedPostHog | null = null;
let pendingPath: string | null = null;
let lastSentPath: string | null = null;

function flushPendingPageview(): void {
  if (!posthog || pendingPath == null) return;
  const path = pendingPath;
  pendingPath = null;
  sendPageview(path);
}

function sendPageview(path: string): void {
  if (!posthog || typeof window === "undefined") return;
  const sanitized = sanitizeAnalyticsPath(path);
  lastSentPath = sanitized;
  posthog.capture("$pageview", {
    $current_url: `${window.location.origin}${sanitized}`,
  });
}

/** Idempotent; safe under React StrictMode double-mount. */
export function initAnalytics(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const config = await getAnalyticsConfig();
    if (!config.key) return;

    const mod = await import("posthog-js");
    const client = mod.default;
    client.init(config.key, {
      api_host: config.host ?? undefined,
      capture_pageview: false,
      autocapture: false,
    });
    posthog = client;
    flushPendingPageview();
  })().catch(() => {
    initPromise = null;
  });

  return initPromise;
}

export function pageview(path: string): void {
  if (typeof window === "undefined") return;
  try {
    const sanitized = sanitizeAnalyticsPath(path);
    if (sanitized === lastSentPath) return;
    if (!posthog) {
      pendingPath = sanitized;
      lastSentPath = sanitized;
      return;
    }
    sendPageview(path);
  } catch {
    // never throw
  }
}

export function clientEvent(event: AnalyticsEvent): void {
  if (typeof window === "undefined" || !posthog) return;
  try {
    posthog.capture(event.name, "props" in event ? event.props : undefined);
  } catch {
    // never throw
  }
}

export function setUserUid(uid: string): void {
  if (typeof window === "undefined" || !posthog) return;
  try {
    posthog.register_once({ uid });
  } catch {
    // never throw
  }
}
