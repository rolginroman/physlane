import { createFileRoute, Link } from '@tanstack/react-router'
import LandingShell from '../components/landing/LandingShell'
import WaitlistForm from '../components/WaitlistForm'
import { useTelegramMode } from '#/lib/telegram-mode'

const SITE_URL = 'https://physlane.unpackit.top'
const SITE_NAME = 'physlane'
const TITLE = 'Calorie Tracker That Measures Your Burn · physlane'
const DESCRIPTION =
  'A calorie tracker that runs in any browser or Telegram: a sane target on day one, your measured daily burn in two weeks. Free while beta.'

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
      { name: 'theme-color', content: '#141821' },
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

/* ── hero ─────────────────────────────────────────────────────────────── */

function Hero() {
  const tgMode = useTelegramMode()
  return (
    <div className="wrap hero">
      <div className="hero-main">
        <p className="kicker">Weight · Calories · Body · Web&nbsp;or&nbsp;Telegram</p>
        <h1>
          Calorie apps guess.
          <br />
          This one measures.
        </h1>
        <p className="sub">
          Most apps run a 1990 formula on your height and weight and call the
          result personal. physlane gives you a sane target on day one, then
          works out what you actually burn from two weeks of your own weights
          and calories. Your target follows that number, and it keeps moving
          when your metabolism does.
        </p>
        <div className="actions">
          {tgMode ? (
            <Link to="/dashboard" className="btn btn-ink">
              Open the app
            </Link>
          ) : (
            <>
              <Link to="/sign-up" className="btn btn-ink">
                Open physlane
              </Link>
              <Link to="/guide" className="btn btn-line">
                The method
              </Link>
            </>
          )}
        </div>
      </div>
      <div className="hero-side">
        <div className="fact">
          <b className="mono">20<small> s</small></b>
          <span>daily time cost, wherever you open it</span>
        </div>
        <div className="fact">
          <b className="mono">day&nbsp;1</b>
          <span>a sane target to start, your burn measured by day&nbsp;14</span>
        </div>
        <div className="fact">
          <b className="mono">0</b>
          <span>macros to count, barcodes to scan</span>
        </div>
        <div className="note">Free while beta. Export as CSV, leave any day.</div>
      </div>
    </div>
  )
}

/* ── thesis blocks ────────────────────────────────────────────────────── */

function FormBlock() {
  return (
    <section className="block">
      <div className="wrap">
        <div className="block-head">
          <span className="no">§1</span>
          <h2>The product is a form.</h2>
        </div>
        <p className="lead">
          Tracking fails when it costs too much. physlane opens in any browser
          or from the Telegram menu button, takes weight, calories and an
          optional tape measurement, and closes. A habit this cheap is still
          standing in week six.
        </p>
        <div className="cols3">
          <div>
            <span className="no">01</span>
            <h3>Log</h3>
            <p>
              Weight, daily calories, waist and neck when you have the tape
              out. Anything skipped is simply empty.
            </p>
          </div>
          <div>
            <span className="no">02</span>
            <h3>Remind</h3>
            <p>One daily nudge at your local time. There are no streaks to defend.</p>
          </div>
          <div>
            <span className="no">03</span>
            <h3>Review</h3>
            <p>
              Trend, target, adherence, body fat estimate. One screen, readable
              before the coffee cools.
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

const INDEX_ROWS = [
  {
    to: '/analytics',
    no: 'A/01',
    title: 'Analytics',
    body: 'Burn rate measured from your logs. Trends, composition, adherence, references.',
  },
  {
    to: '/tracking',
    no: 'A/02',
    title: 'Tracking',
    body: 'The twenty-second check-in. Reminders, units, history, export.',
  },
  {
    to: '/glp-1',
    no: 'A/03',
    title: 'GLP-1',
    body: 'Fast loss, visible composition, share cards for your clinician.',
  },
  {
    to: '/guide',
    no: 'A/04',
    title: 'Guide',
    body: 'The method, the math and the research behind every number.',
  },
] as const

function IndexBlock() {
  return (
    <section className="block">
      <div className="wrap">
        <div className="block-head">
          <span className="no">§2</span>
          <h2>The index.</h2>
        </div>
        <div className="index-list">
          {INDEX_ROWS.map((row) => (
            <Link key={row.to} to={row.to}>
              <span className="no">{row.no}</span>
              <h3>{row.title}</h3>
              <span className="arrow" aria-hidden="true">
                →
              </span>
              <p>{row.body}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}

function Bignum() {
  return (
    <section className="block">
      <div className="wrap">
        <div className="bignum">
          <div className="n">
            7<em>,</em>700
          </div>
          <div>
            <h3>Kilocalories per kilogram of body mass.</h3>
            <p>
              A kilogram of body mass costs roughly 7,700 kcal. Track what you
              eat and what you weigh for two weeks, and that relationship gives
              up your burn rate. The figure also drifts as you diet, which is
              why physlane re-solves it from your logs instead of stamping it
              once.
            </p>
            <p className="src">Wishnofsky, 1958 · Hall et al., The Lancet, 2011</p>
          </div>
        </div>
      </div>
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

const COHORT_ROWS = [
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
]

function Reviews() {
  return (
    <section className="block">
      <div className="wrap">
        <div className="block-head">
          <span className="no">§3</span>
          <h2>What users say.</h2>
        </div>
        {TESTIMONIALS.length > 0 ? (
          <ul className="index-list" style={{ listStyle: 'none' }}>
            {TESTIMONIALS.map((t) => (
              <li key={t.name}>
                <blockquote>{t.quote}</blockquote>
                <p className="mono">
                  {t.name} · {t.role}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <>
            <h3 className="sub-h">Founding cohort, open now</h3>
            <p className="lead">
              physlane is new and does not pretend otherwise, so there are no
              testimonials here yet and no invented star ratings either. When
              the first cohort reports back, their words land on this page,
              attributed and unedited. They will have run the same math you
              would: two weeks of daily logging, then the same estimate you
              would get.
            </p>
            <p className="lead">
              What founding users get: a direct line to the builder and feature
              requests that actually ship.
            </p>
            <div className="cols3">
              {COHORT_ROWS.map((row, i) => (
                <div key={row.title}>
                  <span className="no">0{i + 1}</span>
                  <h3>{row.title}</h3>
                  <p>{row.body}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  )
}

/* ── FAQ ──────────────────────────────────────────────────────────────── */

function Faq() {
  return (
    <section className="block">
      <div className="wrap">
        <div className="block-head">
          <span className="no">§4</span>
          <h2>Questions.</h2>
        </div>
        <div className="faq">
          {FAQS.map((faq, i) => (
            <details key={faq.q} open={i === 0}>
              <summary>
                <span>{faq.q}</span>
                <span className="no">Q.{String(i + 1).padStart(2, '0')}</span>
              </summary>
              <p>{faq.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ── closing: CTA + waitlist ──────────────────────────────────────────── */

function Closing() {
  const tgMode = useTelegramMode()
  return (
    <section className="block">
      <div className="wrap final">
        <div>
          <h2>A sane target on day one. Your own number in two weeks.</h2>
          <p>Both work from your first log.</p>
          <Link
            to={tgMode ? '/dashboard' : '/sign-up'}
            className="btn btn-ink"
          >
            Open physlane
          </Link>
        </div>
        <div className="side">
          {tgMode ? (
            <>
              <h3>Already inside Telegram</h3>
              <p>
                Open the app to log today's two numbers. No waitlist, no card.
              </p>
            </>
          ) : (
            <>
              <h3>Not ready to start?</h3>
              <p>
                One email when the founding cohort reports, with their charts
                and what the math said. Then silence.
              </p>
              <WaitlistForm source="landing-closing" />
            </>
          )}
        </div>
      </div>
    </section>
  )
}

function LandingPage() {
  return (
    <LandingShell current="home">
      <Hero />
      <FormBlock />
      <IndexBlock />
      <Bignum />
      <Reviews />
      <Faq />
      <Closing />
    </LandingShell>
  )
}
