import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import {
  billingStatus,
  createBillingPortal,
  createCheckout,
} from '#/server/billing.fns'

export const Route = createFileRoute('/_auth/billing')({
  head: () => ({ meta: [{ title: 'Billing · physlane' }] }),
  validateSearch: (search: Record<string, unknown>): { checkout?: 'success' | 'cancelled' } => ({
    checkout:
      search.checkout === 'success'
        ? ('success' as const)
        : search.checkout === 'cancelled'
          ? ('cancelled' as const)
          : undefined,
  }),
  loader: async () => billingStatus(),
  component: BillingPage,
})

type Interval = 'monthly' | 'yearly'

const PRO_FEATURES = [
  'Adaptive TDEE estimate with spread, computed from your own series',
  '4-week weight projection and on-pace / too-fast / too-slow verdicts',
  'Unlimited history past the free 90 days',
  'GLP-1 mode with lean-mass watch',
]

const FREE_FEATURES = [
  'Full logging: weight, girths, daily kcal and protein',
  'Trend charts with cycle target overlay',
  'Cut / bulk cycles, streaks, metric and imperial units',
  '90 days of measurement and intake history',
]

/** 16px stroke check, one icon family across the page. */
function Check() {
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden="true"
      className="mt-1 shrink-0 text-accent"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 8.5 6.5 12 13 4.5" />
    </svg>
  )
}

function FeatureList({ items }: { items: string[] }) {
  return (
    <ul className="m-0 mt-3 list-none space-y-2 p-0">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2.5">
          <Check />
          <span className="text-sm text-dim">{item}</span>
        </li>
      ))}
    </ul>
  )
}

/** Server-fn errors arrive as opaque messages; map what we can, generic copy for the rest. */
function billingErrorCopy(err: unknown, action: string): string {
  const message = err instanceof Error ? err.message : ''
  if (message.includes('BILLING_NOT_CONFIGURED')) {
    return `Checkout is temporarily unavailable. Billing is not configured on the server. Try again later.`
  }
  if (message.includes('NO_STRIPE_CUSTOMER')) {
    return 'No billing profile is attached to your account yet. Contact support and we will sort it out.'
  }
  return `Could not ${action}. Check your connection and try again.`
}

/** Interval selector in the same segmented-control vocabulary as the units toggle. */
function IntervalPicker({
  value,
  onChange,
  disabled,
}: {
  value: Interval
  onChange: (next: Interval) => void
  disabled: boolean
}) {
  const options: { id: Interval; label: string; sub: string }[] = [
    { id: 'monthly', label: '$10', sub: 'per month' },
    { id: 'yearly', label: '$100', sub: 'per year' },
  ]
  return (
    <div
      role="radiogroup"
      aria-label="Billing interval"
      className="grid grid-cols-2 gap-2 sm:max-w-xs"
    >
      {options.map((o) => {
        const active = value === o.id
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(o.id)}
            className={`flex min-h-11 flex-col items-start rounded-lg border px-3 py-2 text-left transition-colors duration-150 ease-out ${
              active
                ? 'border-accent/60 bg-accent/10'
                : 'border-line bg-surface hover:border-line2'
            }`}
          >
            <span className="num text-base font-semibold">{o.label}</span>
            <span className="text-xs text-dim">{o.sub}</span>
          </button>
        )
      })}
    </div>
  )
}

function BillingPage() {
  const { plan, configured, planCurrentPeriodEndIso } = Route.useLoaderData()
  const checkout = Route.useSearch().checkout
  const router = useRouter()

  const [interval, setInterval] = useState<Interval>('yearly')
  const [pending, setPending] = useState<'checkout' | 'portal' | null>(null)
  const [error, setError] = useState<{ action: string; message: string } | null>(null)
  const invalidated = useRef(false)

  // Checkout return: refresh so a webhook already flipped plan reflects here.
  useEffect(() => {
    if (checkout === 'success' && !invalidated.current) {
      invalidated.current = true
      void router.invalidate()
    }
  }, [checkout, router])

  async function startCheckout() {
    if (pending) return
    setError(null)
    setPending('checkout')
    try {
      const { url } = await createCheckout({ data: { interval } })
      if (!url) throw new Error('no checkout url')
      window.location.assign(url)
    } catch (err) {
      setError({ action: 'start checkout', message: billingErrorCopy(err, 'start checkout') })
      setPending(null)
    }
  }

  async function openPortal() {
    if (pending) return
    setError(null)
    setPending('portal')
    try {
      const { url } = await createBillingPortal()
      if (!url) throw new Error('no portal url')
      window.location.assign(url)
    } catch (err) {
      setError({ action: 'open the billing portal', message: billingErrorCopy(err, 'open the billing portal') })
      setPending(null)
    }
  }

  const renewalDate = planCurrentPeriodEndIso
    ? new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(
        new Date(planCurrentPeriodEndIso),
      )
    : null

  const priceLabel = interval === 'yearly' ? '$100 / year' : '$10 / month'

  return (
    <section className="pt-8" aria-labelledby="billing-h1">
      <h1 id="billing-h1" className="m-0 text-xl font-semibold tracking-tight">
        Billing
      </h1>

      {checkout === 'success' && (
        <p
          role="status"
          className="mt-4 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2.5 text-sm text-text"
        >
          {plan === 'pro'
            ? 'Pro is active. Every Pro feature is unlocked.'
            : 'Payment received. Pro activates the moment Stripe confirms the subscription, usually within a minute. This page updates on its own.'}
        </p>
      )}
      {checkout === 'cancelled' && (
        <p
          role="status"
          className="mt-4 rounded-lg border border-line bg-surface px-3 py-2.5 text-sm text-dim"
        >
          Checkout cancelled. Nothing was charged.
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg border border-rose/40 bg-rose/10 px-3 py-2.5 text-sm text-rose"
        >
          {error.message}
        </p>
      )}

      {!configured && (
        <div
          role="note"
          className="mt-4 rounded-xl border border-line bg-surface px-4 py-3.5"
        >
          <p className="m-0 text-sm font-medium text-text">
            Online checkout is not enabled yet
          </p>
          <p className="m-0 mt-1 text-sm text-dim">
            {plan === 'pro'
              ? 'Card billing goes live shortly. Nothing can be charged today. Your Pro plan stays active in the meantime.'
              : 'Card billing goes live shortly. Nothing can be charged today. Your free plan keeps working in full: logging, charts, cycles, streaks.'}
          </p>
        </div>
      )}

      {plan === 'free' ? (
        <div className="card mt-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="m-0 text-base font-semibold">Current plan: Free</h2>
            <p className="num m-0 text-sm text-dim">$0</p>
          </div>
          <FeatureList items={FREE_FEATURES} />

          <div className="mt-5 border-t border-line pt-4">
            <h3 className="m-0 text-base font-semibold">
              Pro
              <span className="ml-2 rounded border border-line px-1 py-0.5 text-[0.6875rem] font-semibold tracking-wide text-dim">
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
                  {interval === 'yearly' && (
                    <p className="hint">Yearly works out to 2 months free.</p>
                  )}
                  <button
                    type="button"
                    onClick={startCheckout}
                    disabled={pending !== null}
                    className="btn-primary mt-3"
                  >
                    {pending === 'checkout'
                      ? 'Opening checkout…'
                      : `Checkout · ${priceLabel}`}
                  </button>
                  <p className="hint">
                    Secure Stripe checkout in a new tab. Cancel anytime from this page.
                  </p>
                </div>
              </>
            ) : (
              <p className="m-0 mt-2 text-sm text-dim">
                Pro pricing will be $10 per month or $100 per year once checkout is
                enabled. The estimate keeps building from your data in the meantime.
              </p>
            )}
          </div>
        </div>
      ) : (
        <div className="card mt-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="m-0 flex items-center gap-2 text-base font-semibold">
              Current plan: Pro
              <span className="rounded border border-accent px-1.5 py-0.5 text-[0.6875rem] font-semibold tracking-wide text-accent">
                ACTIVE
              </span>
            </h2>
            {renewalDate && (
              <p className="num m-0 text-sm text-dim">Renews {renewalDate}</p>
            )}
          </div>
          <FeatureList items={PRO_FEATURES} />
          <div className="mt-4 border-t border-line pt-4">
            {configured ? (
              <>
                <button
                  type="button"
                  onClick={openPortal}
                  disabled={pending !== null}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg border border-line bg-surface2 px-4 text-sm font-semibold text-text transition-colors duration-150 ease-out hover:border-line2 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pending === 'portal' ? 'Opening portal…' : 'Manage subscription'}
                </button>
                <p className="hint">
                  Update card, switch monthly or yearly, or cancel. Cancellation takes
                  effect at the end of the paid period.
                </p>
              </>
            ) : (
              <p className="m-0 text-sm text-dim">
                Subscription management is unavailable while checkout is offline. Your
                Pro plan stays active.
              </p>
            )}
          </div>
        </div>
      )}

      <p className="mt-6 mb-0 text-xs text-faint">
        Only manual numbers are stored. No bank or social integrations, ever.
      </p>
    </section>
  )
}
