import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { isAppErrorCode } from "#/lib/app-error";
import { RadioGroup, RadioGroupItem } from "#/components/ui/radio-group";
import { Button } from "#/components/ui/button";
import {
  billingStatus,
  createBillingPortal,
  createCheckout,
} from "#/server/billing.fns";

export const Route = createFileRoute("/_auth/billing")({
  head: () => ({ meta: [{ title: "Billing · physlane" }] }),
  validateSearch: (
    search: Record<string, unknown>,
  ): { checkout?: "success" | "cancelled" } => ({
    checkout:
      search.checkout === "success"
        ? ("success" as const)
        : search.checkout === "cancelled"
          ? ("cancelled" as const)
          : undefined,
  }),
  loader: async () => billingStatus(),
  component: BillingPage,
});

type Interval = "monthly" | "yearly";

const PRICING: Record<
  Interval,
  {
    price: string;
    sub: string;
    checkoutLabel: string;
    flag?: string;
    effective?: string;
  }
> = {
  monthly: {
    price: "$10",
    sub: "per month",
    checkoutLabel: "$10 / month",
  },
  yearly: {
    price: "$100",
    sub: "per year",
    checkoutLabel: "$100 / year",
    flag: "2 months free",
    effective: "≈ $8.33/mo",
  },
};

const PRO_FEATURES = [
  "Adaptive TDEE estimate with spread, computed from your own series",
  "4-week weight projection and on-pace / too-fast / too-slow verdicts",
  "Unlimited history past the free 90 days",
  "GLP-1 mode with lean-mass watch",
];

const FREE_FEATURES = [
  "Full logging: weight, girths, daily kcal and protein",
  "Trend charts with cycle target overlay",
  "Cut / bulk cycles, streaks, metric and imperial units",
  "90 days of measurement and intake history",
];

/** 16px stroke check, one icon family across the page. */
function Check() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden="true"
      className="mt-1 shrink-0 text-brand-text"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 8.5 6.5 12 13 4.5" />
    </svg>
  );
}

function ArrowRight() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden="true"
      className="shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}

function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="m-0 mt-3 list-none space-y-2 p-0">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5">
          <Check />
          <span className="text-sm text-secondary">{item}</span>
        </li>
      ))}
    </ul>
  );
}

/** Server-fn errors arrive as opaque messages; map what we can, generic copy for the rest. */
function billingErrorCopy(err: unknown, action: string): string {
  const message = err instanceof Error ? err.message : "";
  if (!isAppErrorCode(message)) {
    return `Could not ${action}. Check your connection and try again.`;
  }
  if (message === "BILLING_NOT_CONFIGURED") {
    return `Checkout is temporarily unavailable. Billing is not configured on the server. Try again later.`;
  }
  if (message === "NO_STRIPE_CUSTOMER") {
    return "No billing profile is attached to your account yet. Contact support and we will sort it out.";
  }
  return `Could not ${action}. Check your connection and try again.`;
}

function IntervalPicker({
  value,
  onChange,
  disabled,
}: {
  value: Interval;
  onChange: (next: Interval) => void;
  disabled: boolean;
}) {
  const options = (["monthly", "yearly"] as const).map((id) => ({
    id,
    ...PRICING[id],
  }));
  return (
    <RadioGroup
      value={value}
      onValueChange={(next) => onChange(next as Interval)}
      aria-label="Billing interval"
      disabled={disabled}
      className="grid grid-cols-2 gap-2"
    >
      {options.map((o) => {
        const active = value === o.id;
        return (
          <RadioGroupItem
            key={o.id}
            value={o.id}
            disabled={disabled}
            className={`flex min-h-[96px] flex-col items-start rounded-xl border p-3.5 text-left transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-60 ${
              active
                ? "border-primary bg-brand-soft/50"
                : "border-border bg-card hover:border-border"
            }`}
          >
            <span className="font-display text-[1.875rem] leading-none">
              {o.price}
            </span>
            <span className="mt-1 text-xs text-secondary">{o.sub}</span>
            {o.flag ? (
              <span className="mt-2 text-[0.625rem] font-semibold uppercase tracking-wide text-brand-text">
                {o.flag}
              </span>
            ) : (
              <span
                aria-hidden="true"
                className="mt-2 text-[0.625rem] text-transparent"
              >
                ·
              </span>
            )}
            {o.effective ? (
              <span className="num mt-0.5 text-xs text-secondary">
                {o.effective}
              </span>
            ) : null}
          </RadioGroupItem>
        );
      })}
    </RadioGroup>
  );
}

function BillingPage() {
  const { plan, configured, planCurrentPeriodEndIso } = Route.useLoaderData();
  const checkout = Route.useSearch().checkout;
  const router = useRouter();

  const [interval, setInterval] = useState<Interval>("yearly");
  const [pending, setPending] = useState<"checkout" | "portal" | null>(null);
  const [error, setError] = useState<{
    action: string;
    message: string;
  } | null>(null);

  // Checkout return: poll until webhook flips plan (or ~60s), plus immediate first refresh.
  useEffect(() => {
    if (checkout !== "success") return;

    void router.invalidate();
    if (plan === "pro") return;

    let ticks = 0;
    const id = window.setInterval(() => {
      ticks += 1;
      if (ticks >= 30) {
        clearInterval(id);
        return;
      }
      void router.invalidate();
    }, 2000);

    return () => clearInterval(id);
  }, [checkout, plan, router]);

  async function startCheckout() {
    if (pending) return;
    setError(null);
    setPending("checkout");
    try {
      const { url } = await createCheckout({ data: { interval } });
      if (!url) throw new Error("no checkout url");
      window.location.assign(url);
    } catch (err) {
      setError({
        action: "start checkout",
        message: billingErrorCopy(err, "start checkout"),
      });
      setPending(null);
    }
  }

  async function openPortal() {
    if (pending) return;
    setError(null);
    setPending("portal");
    try {
      const { url } = await createBillingPortal();
      if (!url) throw new Error("no portal url");
      window.location.assign(url);
    } catch (err) {
      setError({
        action: "open the billing portal",
        message: billingErrorCopy(err, "open the billing portal"),
      });
      setPending(null);
    }
  }

  const renewalDate = planCurrentPeriodEndIso
    ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
        new Date(planCurrentPeriodEndIso),
      )
    : null;

  const priceLabel = PRICING[interval].checkoutLabel;

  return (
    <section className="pt-8" aria-labelledby="billing-h1">
      <h1 id="billing-h1" className="m-0 text-xl font-semibold tracking-tight">
        Billing
      </h1>

      {checkout === "success" && (
        <p
          role="status"
          className="mt-4 rounded-lg border border-brand-text/40 bg-brand-text/10 px-3 py-2.5 text-sm text-foreground"
        >
          {plan === "pro"
            ? "Pro is active. Every Pro feature is unlocked."
            : "Payment received. Pro activates the moment Stripe confirms the subscription, usually within a minute. This page updates on its own."}
        </p>
      )}
      {checkout === "cancelled" && (
        <p
          role="status"
          className="mt-4 rounded-lg border border-border bg-card px-3 py-2.5 text-sm text-secondary"
        >
          Checkout cancelled. Nothing was charged.
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm text-danger"
        >
          {error.message}
        </p>
      )}

      {!configured && (
        <div
          role="note"
          className="mt-4 rounded-xl border border-border bg-card px-4 py-3.5"
        >
          <p className="m-0 text-sm font-medium text-foreground">
            Online checkout is not enabled yet
          </p>
          <p className="m-0 mt-1 text-sm text-secondary">
            {plan === "pro"
              ? "Card billing goes live shortly. Nothing can be charged today. Your Pro plan stays active in the meantime."
              : "Card billing goes live shortly. Nothing can be charged today. Your free plan keeps working in full: logging, charts, cycles, streaks."}
          </p>
        </div>
      )}

      {plan === "free" ? (
        <div className="card mt-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="m-0 text-base font-semibold">Current plan: Free</h2>
            <p className="num m-0 text-sm text-secondary">$0</p>
          </div>
          <FeatureList items={FREE_FEATURES} />

          <div className="mt-5 border-t border-border pt-4">
            <h3 className="m-0 flex flex-wrap items-baseline gap-2">
              <span className="font-display text-[1.375rem] leading-none">
                Pro
              </span>
              <span className="rounded border border-brand-text px-1 py-0.5 text-[0.6875rem] font-semibold tracking-wide text-brand-text">
                UPGRADE
              </span>
            </h3>
            {configured ? (
              <>
                <FeatureList items={PRO_FEATURES} />
                <div className="mt-4">
                  <IntervalPicker
                    value={interval}
                    onChange={setInterval}
                    disabled={pending !== null}
                  />
                  <Button
                    type="button"
                    onClick={startCheckout}
                    disabled={pending !== null}
                    className="mt-3 min-h-11 gap-2 font-semibold"
                  >
                    {pending === "checkout" ? (
                      "Opening checkout…"
                    ) : (
                      <>
                        Start Pro · {priceLabel}
                        <ArrowRight />
                      </>
                    )}
                  </Button>
                  <p className="hint">
                    Secure Stripe checkout in a new tab. Cancel anytime from
                    this page.
                  </p>
                </div>
              </>
            ) : (
              <p className="m-0 mt-2 text-sm text-secondary">
                Pro pricing will be $10 per month or $100 per year once checkout
                is enabled. The estimate keeps building from your data in the
                meantime.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="card mt-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="m-0 flex items-center gap-2 text-base font-semibold">
              Current plan: Pro
              <span className="rounded border border-brand-text px-1.5 py-0.5 text-[0.6875rem] font-semibold tracking-wide text-brand-text">
                ACTIVE
              </span>
            </h2>
            {renewalDate && (
              <p className="num m-0 text-sm text-secondary">
                Renews {renewalDate}
              </p>
            )}
          </div>
          <FeatureList items={PRO_FEATURES} />
          <div className="mt-4 border-t border-border pt-4">
            {configured ? (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={openPortal}
                  disabled={pending !== null}
                  className="min-h-11 px-4 font-semibold"
                >
                  {pending === "portal"
                    ? "Opening portal…"
                    : "Manage subscription"}
                </Button>
                <p className="hint">
                  Update card, switch monthly or yearly, or cancel. Cancellation
                  takes effect at the end of the paid period.
                </p>
              </>
            ) : (
              <p className="m-0 text-sm text-secondary">
                Subscription management is unavailable while checkout is
                offline. Your Pro plan stays active.
              </p>
            )}
          </div>
        </div>
      )}

      <p className="mt-6 mb-0 text-xs text-muted-foreground">
        Only manual numbers are stored. No bank or social integrations, ever.
      </p>
    </section>
  );
}
