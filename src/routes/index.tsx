import { createFileRoute, Link } from '@tanstack/react-router'

const SITE_URL = 'https://physlane.workers.dev'
const SITE_NAME = 'physlane'
const TITLE = 'physlane · adaptive TDEE and recomp tracker for lifters'
const DESCRIPTION =
  'physlane computes your true burn rate from your own weight and intake series. Two numbers a day, under 60 seconds. No food database, no barcode scanner, no photo AI. Free tier included; Pro is $10/mo or $100/yr.'

const FAQS = [
  {
    q: 'How does the adaptive TDEE estimate work?',
    a: 'From your own data, not a population formula. After 14 days of same-day weight and kcal pairs, physlane computes your weekly energy balance: average intake minus the calories implied by your weight change. The result is smoothed week over week and shown with a spread. It keeps updating as you log.',
  },
  {
    q: 'Do I have to track meals or scan barcodes?',
    a: 'No. You log one number: total kcal for the day, plus optional protein. Estimate it however you like. physlane stores the number, never the meal. There is no food database and there never will be.',
  },
  {
    q: 'What does the free plan include?',
    a: 'Everything you need to run the daily loop: weight and girth logging, daily intake, trend charts with your cycle target overlay, streaks, and 90 days of history. The TDEE reveal, projection and verdicts, unlimited history, and GLP-1 mode are Pro.',
  },
  {
    q: 'How much does Pro cost?',
    a: '$10 per month or $100 per year, your choice. Cancel anytime from the billing page; you keep Pro until the end of the paid period.',
  },
  {
    q: 'What happens to my data?',
    a: 'Only the numbers you type: weights, girths, daily kcal and protein, cycle settings. No bank or social integrations, no photo analysis, no data selling. Delete any entry anytime.',
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
          adaptive TDEE
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
        <span>Cut, 12 weeks, target −0.55 kg/wk. Chart from the app.</span>
      </figcaption>
    </figure>
  )
}

/* ── sections ─────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <section className="pt-14 pb-14 sm:pt-24 sm:pb-20">
      <p className="m-0 text-sm font-medium text-dim">
        For lifters who run cut and bulk cycles
      </p>
      <h1 className="display-1 mt-3 max-w-3xl text-text">
        Know your true burn rate.
      </h1>
      <p className="mt-5 mb-0 max-w-2xl text-base text-dim sm:text-lg">
        physlane computes your TDEE from your own weight and intake series. Two
        numbers a day, under 60 seconds. No food database, no barcode scanner, no
        photo AI.
      </p>
      <div className="mt-7 flex flex-wrap items-center gap-3">
        <Link to="/sign-up" className="btn-primary no-underline">
          Create account
        </Link>
        <Link
          to="/sign-in"
          className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm font-semibold text-dim no-underline transition-colors duration-150 ease-out hover:border-line2 hover:text-text"
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
    body: 'Weight and waist in 30 seconds. Any subset of girths if you want them.',
  },
  {
    n: '02',
    title: 'Log one number',
    body: 'Total kcal for the day, plus protein if you track it. 10 seconds.',
  },
  {
    n: '03',
    title: 'Watch the trend',
    body: 'The chart carries your cycle target line. Day 14: your TDEE appears, built from your own series.',
  },
]

function HowItWorks() {
  return (
    <section className="border-t border-line py-14 sm:py-20">
      <h2 className="display-2 m-0 text-text">The daily loop</h2>
      <p className="mt-3 mb-0 max-w-2xl text-base text-dim">
        Under 60 seconds on your phone. That is the entire habit the product
        asks for.
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

const COMPUTATION = [
  { label: 'weight trend', value: '−0.60 kg/wk' },
  { label: 'avg intake', value: '2,300 kcal/d' },
  { label: 'burn estimate', value: '2,960 kcal/d ± 140', accent: true },
]

const FEATURE_ROWS = [
  {
    title: 'Cycles with target overlay',
    body: 'One active cut, bulk, or maintain phase with a target rate. The target line rides your weight chart.',
  },
  {
    title: 'Pace verdicts and projection',
    body: 'On pace, too fast, or too slow, stated against your cycle target, with a 4-week projection at current intake. Pro.',
  },
  {
    title: 'GLP-1 mode',
    body: 'Swaps deficit targets for protein-first guidance and a lean-mass watch on rapid loss with a flat waist. Pro.',
  },
  {
    title: 'Private by design',
    body: 'Manual numbers only. No bank or social integrations, no photo analysis, no data selling.',
  },
]

function Features() {
  return (
    <section className="border-t border-line py-14 sm:py-20">
      <h2 className="display-2 m-0 text-text">Built for recomposition</h2>
      <div className="mt-8 grid gap-10 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-7">
          <h3 className="m-0 text-lg font-semibold text-text">
            Adaptive TDEE, the honest way
          </h3>
          <p className="mt-2 mb-0 text-sm text-dim sm:text-base">
            Formulas guess from your age, height, and an activity multiplier.
            physlane waits until it can measure you: 14 days of same-day weight
            and intake pairs, then the balance math, smoothed weekly.
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
  'Weight, girth, and daily kcal logging',
  'Trend charts with cycle target overlay',
  'Cut / bulk cycles and streaks',
  '90 days of history',
]

const PRO_LIST = [
  'Adaptive TDEE estimate with spread',
  'Pace verdicts and 4-week projection',
  'Unlimited history',
  'GLP-1 mode',
]

function Pricing() {
  return (
    <section className="border-t border-line py-14 sm:py-20">
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
    <section className="border-t border-line py-14 sm:py-20">
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

function FinalCta() {
  return (
    <section className="border-t border-line py-14 sm:py-20">
      <div className="sm:flex sm:items-end sm:justify-between sm:gap-8">
        <div>
          <h2 className="display-2 m-0 text-text">
            Two numbers a day.
          </h2>
          <p className="mt-3 mb-0 max-w-xl text-base text-dim">
            That is the whole habit. The burn rate shows up on day 14, from your
            own data.
          </p>
        </div>
        <Link to="/sign-up" className="btn-primary mt-6 no-underline sm:mt-0">
          Create account
        </Link>
      </div>
    </section>
  )
}

function LandingPage() {
  return (
    <main className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6">
      <Hero />
      <HowItWorks />
      <Features />
      <Pricing />
      <Faq />
      <FinalCta />
    </main>
  )
}
