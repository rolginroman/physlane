import type { UnitSystem } from "#/lib/units";

/** Goal phase chosen in onboarding (`src/routes/_auth.onboarding.tsx`). */
export type OnboardingGoal = "cut" | "bulk" | "maintain";

export type AnalyticsEvent =
  | { name: "signup_completed" }
  | {
      name: "onboarding_completed";
      props: { goal: OnboardingGoal; units: UnitSystem };
    }
  | { name: "measurement_logged" }
  | { name: "intake_logged" }
  | {
      name: "checkout_started";
      props: { interval: "monthly" | "yearly" };
    }
  | { name: "subscription_activated" }
  | { name: "subscription_updated" }
  | { name: "subscription_deleted" };

export type AnalyticsEventName = AnalyticsEvent["name"];

/** Strip query/hash and collapse high-cardinality route segments for analytics. */
export function sanitizeAnalyticsPath(pathname: string): string {
  const pathOnly = pathname.split(/[?#]/)[0] ?? pathname;
  if (pathOnly === "" || pathOnly === "/") return "/";

  if (
    pathOnly.startsWith("/share/") &&
    pathOnly.length > "/share/".length &&
    !pathOnly.slice("/share/".length).includes("/")
  ) {
    return "/share/$token";
  }

  const blogSlug = /^\/blog\/([^/]+)$/.exec(pathOnly);
  if (blogSlug) return "/blog/$slug";

  return pathOnly;
}
