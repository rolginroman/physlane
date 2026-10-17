import { useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import WaitlistForm from '../components/WaitlistForm'

const SITE_URL = 'https://physlane.unpackit.top'
const SITE_NAME = 'physlane'
const TITLE = 'Adaptive TDEE Tracker for Lifters — physlane'
const DESCRIPTION =
  'physlane learns your real daily calorie burn (TDEE) from your own weigh-ins and food logs. Two numbers a day, under a minute. Free tier included; Pro $10/mo.'

const FAQS = [
  {
    q: 'How does it learn how many calories I burn?',
    a: 'From your own data, not a population formula. After 14 days of daily weigh-ins and calorie totals, physlane computes your weekly energy balance: what you ate minus what your weight change implies you burned. The result is smoothed week over week and shown with a range. In technical terms, it estimates your TDEE, and it keeps updating as you log.',
  },
  {
    q: 'Do I have to track meals or scan barcodes?',
    a: 'No. You log one number: total calories for the day, plus optional protein. Estimate it however you like. physlane stores the number, never the meal. There is no food database and there never will be.',
  },
  {
    q: 'What does the free plan include?',
    a: 'Everything you need for the daily habit: weight and body-measurement logging, daily calories, trend charts with your goal line, streaks, and 90 days of history. The daily-burn estimate, projections and on-track verdicts, unlimited history, and GLP-1 mode are Pro.',
  },
  {
    q: 'How much does Pro cost?',
    a: '$10 per month or $100 per year, your choice. Cancel anytime from the billing page; you keep Pro until the end of the paid period.',
  },
  {
    q: 'What happens to my data?',
    a: 'The numbers you type: weights, tape measurements, daily calories and protein, goal settings. physlane never connects to your bank or social accounts, never analyzes photos, and does not sell anything. You can delete any entry whenever you want.',
  },
]

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: SITE_NAME,
    applicationCategory: 'HealthApplication',
    operatingSystem: 'Web',
    url: SITE_URL,
    description: DESCRIPTION,
    offers: [
      { '@type': 'Offer', name: 'Free', price: '0', priceCurrency: 'USD' },
      {
        '@type': 'Offer',
        name: 'Pro monthly',
        price: '10',
        priceCurrency: 'USD',
        category: 'subscription, monthly',
      },
      {
        '@type': 'Offer',
        name: 'Pro yearly',
        price: '100',
        priceCurrency: 'USD',
        category: 'subscription, yearly',
      },
    ],
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  },
]

export const Route = createFileRoute('/')({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { name: 'robots', content: 'index, follow' },
      { property: 'og:site_name', content: SITE_NAME },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: SITE_URL },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:image', content: `${SITE_URL}/og.png` },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: TITLE },
      { name: 'twitter:description', content: DESCRIPTION },
      { name: 'twitter:image', content: `${SITE_URL}/og.png` },
    ],
    links: [{ rel: 'canonical', href: SITE_URL }],
    scripts: jsonLd.map((block) => ({
      type: 'application/ld+json',
      children: JSON.stringify(block),
    })),
  }),
  component: LandingPage,
})

/* ── hero trend chart (SSR-safe inline SVG) ───────────────────────────── */

/** 24 half-weekly morning weights, a clean 0.5 kg/wk cut with real noise. */
const WEIGHT_SERIES = [
  84.6, 84.4, 84.7, 84.1, 83.9, 84.2, 83.5, 83.3, 83.6, 82.9, 82.8, 82.9, 82.1,
  81.9, 82.2, 81.6, 81.4, 81.5, 80.9, 80.6, 80.9, 80.3, 80.0, 79.6,
]
const TARGET_RATE_KG_WK = -0.55
const CHART_W = 640
const CHART_H = 300
const PAD = { top: 18, right: 128, bottom: 26, left: 34 }
const Y_MIN = 77
const Y_MAX = 86

function scaleX(i: number): number {
  const inner = CHART_W - PAD.left - PAD.right
  return PAD.left + (i / (WEIGHT_SERIES.length - 1)) * inner
}

function scaleY(kg: number): number {
  const inner = CHART_H - PAD.top - PAD.bottom
  return PAD.top + ((Y_MAX - kg) / (Y_MAX - Y_MIN)) * inner
}

function TrendHeroChart() {
  const weeks = (WEIGHT_SERIES.length - 1) / 2
  const targetStart = WEIGHT_SERIES[0]
  const targetEnd = targetStart + TARGET_RATE_KG_WK * weeks
  const weightPath = WEIGHT_SERIES.map(
    (kg, i) => `${i === 0 ? 'M' : 'L'}${scaleX(i).toFixed(1)},${scaleY(kg).toFixed(1)}`,
  ).join(' ')
  const gridlines = [78, 80, 82, 84, 86]
  const last = WEIGHT_SERIES[WEIGHT_SERIES.length - 1]
  const lastX = scaleX(WEIGHT_SERIES.length - 1)
  const lastY = scaleY(last)

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${CHART_W} ${CHART_H}`}
        className="h-auto w-full"
        role="img"
        aria-label="Weight trend over 12 weeks: from 84.6 kg down to 79.6 kg, tracking a dashed target line that ends near 78.3 kg."
      >
        {/* gridlines + axis labels */}
        {gridlines.map((kg) => (
          <g key={kg}>
            <line
              x1={PAD.left}
              x2={CHART_W - PAD.right}
              y1={scaleY(kg)}
              y2={scaleY(kg)}
              stroke="var(--color-line)"
              strokeWidth="1"
            />
            <text
              x={PAD.left - 8}
              y={scaleY(kg) + 3}
              textAnchor="end"
              className="num"
              fontSize="10"
              fill="var(--color-faint)"
            >
              {kg}
            </text>
          </g>
        ))}
        <text
          x={CHART_W - PAD.right}
          y={CHART_H - 6}
          textAnchor="end"
          fontSize="10"
          fill="var(--color-faint)"
        >
          week 12
        </text>

        {/* cycle target line */}
        <line
          x1={scaleX(0)}
          y1={scaleY(targetStart)}
          x2={scaleX(WEIGHT_SERIES.length - 1)}
          y2={scaleY(targetEnd)}
          stroke="var(--color-dim)"
          strokeWidth="1.5"
          strokeDasharray="5 5"
        />
        <text
          x={scaleX(WEIGHT_SERIES.length - 1) - 4}
          y={scaleY(targetEnd) + 14}
          textAnchor="end"
          fontSize="10"
          fill="var(--color-dim)"
        >
          target
        </text>

        {/* actual weight */}
        <path
          d={weightPath}
          fill="none"
          stroke="var(--color-blue)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx={lastX} cy={lastY} r="3.5" fill="var(--color-blue)" />
        <text
          x={lastX + 10}
          y={lastY + 3}
          fontSize="12"
          className="num"
          fill="var(--color-text)"
        >
          {last.toFixed(1)} kg
        </text>

        {/* burn-rate annotation at the latest point */}
        <text
          x={lastX + 10}
          y={lastY - 16}
          fontSize="12"
          className="num"
          fill="var(--color-accent)"
        >
          2,960 kcal/d ± 140
        </text>
        <text
          x={lastX + 10}
          y={lastY - 32}
          fontSize="10"
          fill="var(--color-dim)"
        >
          your daily burn
        </text>
      </svg>
      <figcaption className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-dim">
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-0.5 w-4 rounded bg-blue"
          />
          weight
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-0.5 w-4 rounded bg-[repeating-linear-gradient(90deg,var(--color-dim)_0_5px,transparent_5px_10px)]"
          />
          cycle target
        </span>
        <span>12 weeks of weight loss, target −0.55 kg/week. This is what the app chart looks like.</span>
      </figcaption>
    </figure>
  )
}

/* ── sections ─────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="pt-14 pb-14 sm:pt-24 sm:pb-20">
      <p className="m-0 text-sm font-medium text-dim">
        For anyone losing fat or building muscle
      </p>
      <h1 className="display-1 mt-3 max-w-3xl text-text">
        Know how many calories you really burn.
      </h1>
      <p className="mt-5 mb-0 max-w-2xl text-base text-dim sm:text-lg">
        Online calculators guess from your age and height. physlane measures
        yours from your own numbers: your morning weigh-in and what you ate
        that day. Two numbers a day, under a minute, and the estimate gets
        more accurate the longer you keep at it. There is no food database to
        search and nothing to scan.
      </p>
      <p className="mt-3 mb-0 max-w-2xl text-sm text-faint">
        Eat below your burn and you lose weight. Eat above it and you gain.
        Everyone knows that part. The hard part is knowing where your line
        actually sits, because it is not the same as anyone else's. physlane
        finds it from your own data and keeps it updated as your weight
        changes.
      </p>
      <div className="mt-7 flex flex-wrap items-center gap-3">
        <Link to="/sign-up" className="btn-primary no-underline">
          Start free, no card
        </Link>
        <a
          href="#the-loop"
          className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm font-semibold text-dim no-underline transition-colors duration-150 ease-out hover:border-line2 hover:text-text"
        >
          See the daily loop
        </a>
        <Link
          to="/sign-in"
          className="ml-1 inline-flex min-h-11 items-center px-2 text-sm font-medium text-faint no-underline hover:text-text"
        >
          Sign in
        </Link>
      </div>
      <div className="card mt-12 p-4 sm:p-5">
        <TrendHeroChart />
      </div>
    </section>
  )
}

const STEPS = [
  {
    n: '01',
    title: 'Weigh in',
    body: 'Step on the scale in the morning and type the number. Ten seconds.',
  },
  {
    n: '02',
    title: 'Log the day\u2019s calories',
    body: 'One number: roughly what you ate today. Protein is optional.',
  },
  {
    n: '03',
    title: 'Read your trend',
    body: 'Your weight chart updates, and on day 14 the app tells you how many calories you actually burn.',
  },
]

function HowItWorks() {
  return (
    <section id="the-loop" className="scroll-mt-16 border-t border-line py-14 sm:py-20">
      <h2 className="display-2 m-0 text-text">How it works</h2>
      <p className="mt-3 mb-0 max-w-2xl text-base text-dim">
        Three steps, every day, under a minute on your phone. You do the
        typing, the app does the math, and the estimate keeps improving for as
        long as you log.
      </p>
      <ol className="m-0 mt-8 grid list-none gap-0 p-0 sm:grid-cols-3 sm:gap-6">
        {STEPS.map((step) => (
          <li
            key={step.n}
            className="border-t border-line py-5 sm:border-t-0 sm:border-l sm:py-0 sm:pl-6 sm:first:border-l-0 sm:first:pl-0"
          >
            <p className="num m-0 text-sm text-faint">{step.n}</p>
            <h3 className="m-0 mt-2 text-base font-semibold text-text">
              {step.title}
            </h3>
            <p className="m-0 mt-1.5 text-sm text-dim">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  )
}

/* ── reviews & testimonials ───────────────────────────────────────────── */

/**
 * Real quotes land here as they come in: { quote, name, role }.
 * Until the founding cohort reports back, the section renders the honest
 * founding-users panel below. Never ship invented quotes.
 */
const TESTIMONIALS: { quote: string; name: string; role: string }[] = []

function Reviews() {
  return (
    <section className="border-t border-line py-14 sm:py-20">
      <h2 className="display-2 m-0 text-text">What users say</h2>
      {TESTIMONIALS.length > 0 ? (
        <ul className="m-0 mt-8 list-none divide-y divide-line border-y border-line p-0">
          {TESTIMONIALS.map((t) => (
            <li key={t.name} className="py-6">
              <blockquote className="m-0 max-w-3xl text-base leading-relaxed text-text">
                {t.quote}
              </blockquote>
              <p className="m-0 mt-3 text-sm text-dim">
                {t.name} · {t.role}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-8 grid gap-10 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-7">
            <h3 className="m-0 text-lg font-semibold text-text">
              Founding cohort, open now
            </h3>
            <p className="mt-2 mb-0 text-sm text-dim sm:text-base">
              physlane is new and does not pretend otherwise, so there are no
              testimonials here yet and no invented star ratings either. When
              the first cohort reports back, their words land on this page,
              attributed and unedited. They will have run the same math you
              would: two weeks of daily logging, then the same estimate you
              would get.
            </p>
            <p className="mt-3 mb-0 text-sm text-dim">
              What founding users get: a direct line to the builder and feature
              requests that actually ship.
            </p>
          </div>
          <ul className="m-0 list-none p-0 lg:col-span-5">
            {[
              {
                title: 'Open math, no black box',
                body: 'The estimate is weekly energy balance from your logged days. Every number traces to an entry you typed.',
              },
              {
                title: 'Your data stays yours',
                body: 'Manual numbers only. Nothing connects to your bank or social accounts, you can delete any entry, and nothing is sold.',
              },
              {
                title: 'You are the proof',
                body: 'Run it free for a month. If the trend and the estimate do not match what you see in the mirror, that is the review.',
              },
            ].map((row) => (
              <li key={row.title} className="border-t border-line py-4 last:border-b">
                <h3 className="m-0 text-base font-semibold text-text">{row.title}</h3>
                <p className="m-0 mt-1 text-sm text-dim">{row.body}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}

const COMPUTATION = [
  { label: 'weight trend', value: '−0.60 kg/wk' },
  { label: 'avg calories', value: '2,300 kcal/d' },
  { label: 'your daily burn', value: '2,960 kcal/d ± 140', accent: true },
]

const FEATURE_ROWS = [
  {
    title: 'Goal phases with a target line',
    body: 'Pick a goal and a weekly rate. Your target line sits on the weight chart, so drift is easy to see.',
  },
  {
    title: 'On track, or not',
    body: 'Too fast, too slow, or on pace, checked against your goal. Plus where you will be in four weeks if you keep eating like this. Pro.',
  },
  {
    title: 'GLP-1 friendly',
    body: 'If you are on a GLP-1, a dedicated mode puts protein first and watches for muscle loss while weight drops fast. Pro.',
  },
  {
    title: 'Private by design',
    body: 'You type numbers, that is all physlane keeps. Nothing connects to your bank or social accounts, and nothing gets sold.',
  },
]

function Features() {
  return (
    <section className="border-t border-line py-14 sm:py-20">
      <h2 className="display-2 m-0 text-text">Built for changing your body</h2>
      <div className="mt-8 grid gap-10 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-7">
          <h3 className="m-0 text-lg font-semibold text-text">
            Stop guessing
          </h3>
          <p className="mt-2 mb-0 text-sm text-dim sm:text-base">
            Every calculator uses the same trick: age, height, weight, an activity
            multiplier, done. physlane waits until it can measure you instead:
            two weeks of daily weigh-ins and calorie totals, then plain weekly
            math. The technical term is TDEE, total daily energy expenditure.
            The number shifts as your weight shifts, which is why a calculator
            you set once eventually stops being right.
          </p>
          <dl className="mt-5 divide-y divide-line rounded-xl border border-line bg-surface">
            {COMPUTATION.map((row) => (
              <div
                key={row.label}
                className="flex items-baseline justify-between gap-4 px-4 py-3"
              >
                <dt className="text-sm text-dim">{row.label}</dt>
                <dd
                  className={`num m-0 text-sm ${row.accent ? 'text-accent' : 'text-text'}`}
                >
                  {row.value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 mb-0 text-xs text-faint">
            The spread is half the range of the last 3 weekly estimates. Every
            number traces to days you logged.
          </p>
        </div>
        <ul className="m-0 list-none p-0 lg:col-span-5">
          {FEATURE_ROWS.map((row) => (
            <li key={row.title} className="border-t border-line py-4 last:border-b">
              <h3 className="m-0 text-base font-semibold text-text">
                {row.title}
              </h3>
              <p className="m-0 mt-1 text-sm text-dim">{row.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

const FREE_LIST = [
  'Weight and body-measurement logging',
  'Trend charts with your goal line',
  'Goal phases and streaks',
  '90 days of history',
]

const PRO_LIST = [
  'Your personal daily-burn estimate',
  'On-track verdicts and 4-week projection',
  'Unlimited history',
  'GLP-1 mode',
]

function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-16 border-t border-line py-14 sm:py-20">
      <h2 className="display-2 m-0 text-text">Pricing</h2>
      <p className="mt-3 mb-0 max-w-2xl text-base text-dim">
        Start free, no card. Upgrade when the estimate is ready and you want the
        number.
      </p>
      <div className="mt-8 grid max-w-3xl gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <h3 className="m-0 text-base font-semibold text-text">Free</h3>
          <p className="num m-0 mt-3 text-2xl font-semibold text-text">
            $0
          </p>
          <ul className="m-0 mt-4 list-none space-y-2 p-0">
            {FREE_LIST.map((item) => (
              <li key={item} className="flex gap-2.5 text-sm text-dim">
                <span aria-hidden="true" className="text-faint">
                  ·
                </span>
                {item}
              </li>
            ))}
          </ul>
          <Link
            to="/sign-up"
            className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-line bg-surface2 px-4 text-sm font-semibold text-text no-underline transition-colors duration-150 ease-out hover:border-line2"
          >
            Create account
          </Link>
        </div>
        <div className="rounded-xl border border-accent/50 bg-surface p-5">
          <h3 className="m-0 flex items-center gap-2 text-base font-semibold text-text">
            Pro
            <span className="rounded border border-accent px-1.5 py-0.5 text-[0.6875rem] font-semibold tracking-wide text-accent">
              PRO
            </span>
          </h3>
          <p className="num m-0 mt-3 text-2xl font-semibold text-text">
            $10
            <span className="text-sm font-normal text-dim">/mo</span>
            <span className="mx-2 text-faint" aria-hidden="true">
              ·
            </span>
            $100
            <span className="text-sm font-normal text-dim">/yr</span>
          </p>
          <ul className="m-0 mt-4 list-none space-y-2 p-0">
            {PRO_LIST.map((item) => (
              <li key={item} className="flex gap-2.5 text-sm text-dim">
                <span aria-hidden="true" className="text-faint">
                  ·
                </span>
                {item}
              </li>
            ))}
          </ul>
          <Link to="/sign-up" className="btn-primary mt-6 w-full no-underline">
            Create account
          </Link>
          <p className="hint">
            Upgrade from inside the app. Cancel anytime; Pro runs to the end of
            the paid period.
          </p>
        </div>
      </div>
    </section>
  )
}

function Faq() {
  return (
    <section id="faq" className="scroll-mt-16 border-t border-line py-14 sm:py-20">
      <h2 className="display-2 m-0 text-text">Questions</h2>
      <div className="mt-6 max-w-3xl">
        {FAQS.map((faq, i) => (
          <details
            key={faq.q}
            className="faq-item border-t border-line last:border-b"
            {...(i === 0 ? { open: true } : {})}
          >
            <summary className="text-sm font-medium text-text sm:text-base">
              {faq.q}
              <span
                aria-hidden="true"
                className="faq-marker num shrink-0 text-base text-dim"
              >
                +
              </span>
            </summary>
            <p className="m-0 max-w-2xl pb-4 pr-8 text-sm leading-relaxed text-dim">
              {faq.a}
            </p>
          </details>
        ))}
      </div>
    </section>
  )
}

/* ── closing: CTA + subscribe + share ─────────────────────────────────── */

function CopyLinkButton() {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm font-semibold text-dim transition-colors duration-150 ease-out hover:border-line2 hover:text-text"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText('https://physlane.unpackit.top/')
          setCopied(true)
          setTimeout(() => setCopied(false), 2000)
        } catch {
          /* clipboard blocked: the address stays visible in the footer */
        }
      }}
    >
      {copied ? 'Link copied' : 'Copy link'}
    </button>
  )
}

function ClosingCta() {
  return (
    <section className="border-t border-line py-14 sm:py-20">
      <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-7">
          <h2 className="display-2 m-0 text-text">Two numbers a day.</h2>
          <p className="mt-3 mb-0 max-w-xl text-base text-dim">
            That is the whole habit. Your calorie estimate shows up on day 14,
            built from your own entries.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link to="/sign-up" className="btn-primary no-underline">
              Start free, no card
            </Link>
            <a
              href="https://x.com/intent/tweet?url=https%3A%2F%2Fphyslane.unpackit.top%2F&text=physlane%20learns%20your%20real%20daily%20calorie%20burn%20from%20your%20own%20weigh-ins%20and%20food%20logs"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm font-semibold text-dim no-underline transition-colors duration-150 ease-out hover:border-line2 hover:text-text"
            >
              Share on X
            </a>
            <a
              href="https://www.reddit.com/submit?url=https%3A%2F%2Fphyslane.unpackit.top%2F&title=physlane%20learns%20your%20real%20daily%20calorie%20burn%20from%20your%20own%20weigh-ins%20and%20food%20logs"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm font-semibold text-dim no-underline transition-colors duration-150 ease-out hover:border-line2 hover:text-text"
            >
              Share on Reddit
            </a>
            <CopyLinkButton />
          </div>
        </div>
        <div className="lg:col-span-5 lg:border-l lg:border-line lg:pl-8">
          <h3 className="m-0 text-lg font-semibold text-text">
            Not ready to start?
          </h3>
          <p className="mt-2 mb-0 text-sm text-dim">
            One email when the founding cohort reports, with their charts and
            what the math said. Then silence.
          </p>
          <div className="mt-4">
            <WaitlistForm source="landing-closing" />
          </div>
        </div>
      </div>
    </section>
  )
}

function LandingPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
      <Hero />
      <HowItWorks />
      <Reviews />
      <Features />
      <Pricing />
      <Faq />
      <ClosingCta />
    </main>
  )
}
