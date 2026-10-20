import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { TrendChart } from "#/components/trend-chart";
import type { MeasurementDTO } from "#/server/measurements.fns";
import type { CycleDTO } from "#/server/cycles.fns";
import { getSharedCard, type SharedCard } from "#/server/share.fns";
import { fmtWeight, formatWeightDelta, type UnitSystem } from "#/lib/units";

/**
 * Public read-only progress card (G2.6). No auth: possession of the token is
 * the grant; unknown or revoked tokens render the 404 card. The DTO carries
 * only the owner's first name + numbers — never email or Telegram identity.
 * There is no editing UI here by design. Cards stay out of search indexes.
 */
export const Route = createFileRoute("/share/$token")({
  // Explicit ctx type: letting TS infer the destructured param breaks the
  // whole route's generic inference in this TS version.
  head: ({ loaderData }: { loaderData?: SharedCard }) => {
    const title = `${loaderData?.firstName ? `${loaderData.firstName}'s` : ""} physlane progress`;
    const description = shareDescription(loaderData ?? null);
    return {
      title: `${title} · physlane`,
      meta: [
        { name: "robots", content: "noindex" },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
      ],
    };
  },
  loader: async ({ params }) => {
    const card = await getSharedCard({ data: { token: params.token } });
    if (!card) throw notFound();
    return card;
  },
  notFoundComponent: ShareNotFound,
  component: SharePage,
});

function ShareNotFound() {
  return (
    <main className="mx-auto w-full max-w-5xl px-4 pt-8 pb-16">
      <div className="card mt-4 p-4">
        <h1 className="m-0 text-xl font-semibold tracking-tight">
          No such card
        </h1>
        <p className="m-0 mt-1 text-sm text-dim">
          This share link does not exist or was revoked by its owner.
        </p>
        <Link
          to="/"
          className="mt-3 inline-flex min-h-11 items-center text-sm font-medium text-accent"
        >
          Go to physlane
        </Link>
      </div>
    </main>
  );
}

const CURRENT_YEAR = new Date().getUTCFullYear();
const fullDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const shortDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** Deterministic (UTC, fixed locale) so SSR and client render the same string. */
function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.getUTCFullYear() === CURRENT_YEAR
    ? shortDate.format(d)
    : fullDate.format(d);
}

function shareDescription(card: SharedCard | null): string {
  const delta = card?.deltaKg ?? null;
  if (delta == null || Math.abs(delta) < 0.05) {
    return "Weight trend and cycle progress, tracked with physlane.";
  }
  return `Weight change since the cycle started: ${formatWeightDelta(delta, "metric")}.`;
}

function SharePage() {
  const card = Route.useLoaderData();
  const units = card.unitSystem as UnitSystem;

  // TrendChart consumes the app-wide DTO shapes; map the shared weight-only
  // series into them. plan 'pro' only suppresses the free-plan upsell banner —
  // the shared series is complete either way.
  const entries: MeasurementDTO[] = card.entries.map((e) => ({
    id: e.takenAt,
    takenAt: e.takenAt,
    weightKg: e.weightKg,
    neckCm: null,
    chestCm: null,
    waistCm: null,
    hipsCm: null,
    armLeftCm: null,
    armRightCm: null,
    thighLeftCm: null,
    thighRightCm: null,
    calfCm: null,
    notes: null,
  }));
  const cycle: CycleDTO | null = card.cycle
    ? {
        id: "shared",
        phase: card.cycle.phase,
        startDate: card.cycle.startDate,
        endDate: card.cycle.endDate,
        startWeightKg: card.cycle.startWeightKg,
        targetRateKgPerWeek: card.cycle.targetRateKgPerWeek,
        kcalTargetPerDay: null,
        notes: null,
      }
    : null;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pt-8 pb-16">
      <h1 className="m-0 text-xl font-semibold tracking-tight">
        {card.firstName ? `${card.firstName}'s progress` : "Progress"}
      </h1>

      <div className="card mt-4 p-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="rounded border border-accent px-1.5 py-0.5 text-[0.6875rem] font-semibold tracking-wide text-accent">
            {card.cycle ? card.cycle.phase.toUpperCase() : "PROGRESS"}
          </span>
          {card.cycle && (
            <span className="text-xs text-dim">
              {fmtDate(card.cycle.startDate)} –{" "}
              {card.cycle.endDate ? fmtDate(card.cycle.endDate) : "now"}
            </span>
          )}
        </div>
        <dl className="m-0 mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
          <div>
            <dt className="text-xs text-dim">Current weight</dt>
            <dd className="num m-0 mt-0.5 text-sm">
              {fmtWeight(card.currentWeightKg, units)}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-dim">Since cycle start</dt>
            <dd className="num m-0 mt-0.5 text-sm">
              {card.deltaKg != null
                ? formatWeightDelta(card.deltaKg, units)
                : "—"}
            </dd>
          </div>
          {card.cycle?.startWeightKg != null && (
            <div>
              <dt className="text-xs text-dim">Start weight</dt>
              <dd className="num m-0 mt-0.5 text-sm">
                {fmtWeight(card.cycle.startWeightKg, units)}
              </dd>
            </div>
          )}
        </dl>
      </div>

      <TrendChart entries={entries} cycle={cycle} units={units} plan="pro" />

      <p className="m-0 mt-4 text-center text-xs text-dim">
        Shared from{" "}
        <Link to="/" className="font-medium text-accent">
          physlane
        </Link>
        . Read-only view.
      </p>
    </main>
  );
}
