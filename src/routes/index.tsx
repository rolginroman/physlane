import { createFileRoute, Link } from '@tanstack/react-router'
import SiteShell, { Arrow } from '../components/site/SiteShell'
import { Bars, ConvergeFigure, SparkChart } from '../components/site/charts'
import DashboardPreview from '../components/site/DashboardPreview'
import { AdjustIcon, LearnIcon, LogIcon, TrendIcon } from '../components/site/icons'
import { ART_PANEL_SIZES, ArtImage, Closer, Steps } from '../components/site/sections'

const SITE_URL = 'https://physlane.unpackit.top'
const SITE_NAME = 'physlane'
const TITLE = 'Calorie Tracker That Measures Your Burn · physlane'
const DESCRIPTION =
  'A calorie tracker that runs in any browser or Telegram: a sane target on day one, your measured daily burn in two weeks. Free while beta.'

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
]

export const Route = createFileRoute('/')({
  staticData: { appChrome: false },
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
  component: HomePage,
})


const LOGGED_BARS = [60, 85, 45, 100, 70, 55, 90, 65, 80]

/* ── hero ─────────────────────────────────────────────────────────────── */

function Hero() {
  return (
    <div className="wrap hero">
      <div className="hero-copy">
        <p className="site-label">Data about you. Not averages.</p>
        <h1 className="display-xl">
          Calorie apps guess.
          <br />
          This one <span className="em">measures.</span>
        </h1>
        <p className="body-lg">
          Log your weight and daily calories. Get a personalized estimate of your actual burn rate — from your own
          data.
        </p>
        <div className="actions">
          <Link className="btn site-btn-primary" to="/sign-up">
            Start tracking <Arrow />
          </Link>
          <a className="link" href="#method">
            See how it works
          </a>
        </div>
        <ul className="benefits">
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <circle cx="12" cy="13" r="8" />
              <path d="M12 9v4l2.5 2M9 2h6" />
            </svg>
            ~20 sec/day
          </li>
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M5.6 18.4 18.4 5.6" />
            </svg>
            No meal database
          </li>
          <li>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <rect x="5" y="10" width="14" height="10" rx="2" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" />
            </svg>
            Your data, your control
          </li>
        </ul>
      </div>

      <div className="stage">
        <svg className="stage-geo" viewBox="0 0 800 700" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
          <g stroke="currentColor" strokeWidth="1">
            <path d="M430 0v700M0 120h800M650 40v300M300 470h500" />
          </g>
          <path
            d="M60 520 C180 470 240 560 340 500 S520 330 640 300 S760 210 800 190"
            fill="none"
            stroke="var(--color-brand)"
            strokeWidth="1.5"
          />
          <g fill="var(--color-brand)">
            <circle cx="340" cy="500" r="4" />
            <circle cx="640" cy="300" r="4" />
          </g>
          <circle cx="120" cy="560" r="70" fill="none" stroke="currentColor" />
        </svg>
        <figure className="athlete">
          {/* LCP image. sizes = .athlete width in site.css: 92% of the stage column (≈39vw, max 640px);
              <=1100px 70% of the column; <=760px a 4:3 box whose 3:2 cover image is ~100vw wide. */}
          <ArtImage
            name="athlete-a-redraw"
            sizes="(max-width: 760px) 100vw, (max-width: 1100px) min(63vw, 640px), min(39vw, 560px)"
            loading="eager"
            fetchPriority="high"
            alt="Illustration of a man in a black tank top, head lowered in focus, in front of a red circle and a rising trend line"
          />
        </figure>

        <DashboardPreview />
      </div>
    </div>
  )
}

/* ── log / learn / adjust ─────────────────────────────────────────────── */

function HowItWorks() {
  return (
    <div className="wrap">
      <Steps
        label="How it works"
        items={[
          { icon: <LogIcon />, title: 'Log', body: 'Your weight and daily calories. Optional: tape measurements.' },
          { icon: <LearnIcon />, title: 'Learn', body: 'We build a personal estimate of your daily burn in about 14 days.' },
          {
            icon: <AdjustIcon />,
            title: 'Adjust',
            body: 'Track the trend, not one day. Your target follows what you actually burn.',
          },
        ]}
      />
    </div>
  )
}

/* ── analytics ────────────────────────────────────────────────────────── */

function Analytics() {
  return (
    <section className="block" id="analytics">
      <div className="wrap split">
        <div>
          <h2 className="display-md">Built for real progress.</h2>
          <p className="body-md">
            A plain view of your body's energy balance. No guesswork, no food database. Your numbers, and what they add
            up to.
          </p>
          <Link className="btn site-btn-primary" to="/analytics">
            Explore features <Arrow />
          </Link>
        </div>
        <div className="metrics">
          <div className="site-card">
            <div className="card-head">
              <span className="card-title">Estimated daily burn</span>
              <span className="tag est">Estimate</span>
            </div>
            <span className="metric-lg site-num">
              2,340<span className="unit">kcal/day</span>
            </span>
            <div className="range">
              <i style={{ left: '50%' }} />
            </div>
            <span className="caption">Updates as you log. Range narrows with more data.</span>
          </div>
          <div className="site-card">
            <div className="card-head">
              <span className="card-title">Daily calories</span>
              <span className="tag">Logged</span>
            </div>
            <span className="metric-lg site-num">
              1,950<span className="unit">kcal avg</span>
            </span>
            <Bars heights={LOGGED_BARS} style={{ height: 40 }} />
            <span className="caption">Exactly what you entered. Nothing inferred.</span>
          </div>
          <div className="site-card">
            <div className="card-head">
              <span className="card-title">Weight change</span>
              <span className="tag">Trend</span>
            </div>
            <span className="metric-lg site-num">
              −2.1<span className="unit">kg</span>
            </span>
            <SparkChart />
            <span className="caption">Smoothed weekly. One heavy day is noise.</span>
          </div>
        </div>
      </div>
      <p className="wrap caption" style={{ marginTop: 16 }}>
        Example values for illustration. Your numbers come from your own logs.
      </p>
    </section>
  )
}

/* ── method ───────────────────────────────────────────────────────────── */

function Method() {
  return (
    <section className="block band method" id="method">
      <div className="wrap method-grid">
        <div>
          <p className="site-label">The method</p>
          <h2 className="display-md" style={{ marginTop: 16 }}>
            Track the trend, <span className="em">not one day.</span>
          </h2>
          <div className="formula">
            <p className="f">burn ≈ calories in − 7,700 × weight change (kg)</p>
            <p className="caption" style={{ marginTop: 6 }}>
              Energy balance, solved from your own series. About 7,700 kcal per kg of body mass.
            </p>
          </div>
          <ol>
            <li>
              <b>Day 1</b>
              <span className="body-md">
                A sensible starting target from a standard formula. Clearly labelled as a starting point.
              </span>
            </li>
            <li>
              <b>Day 14</b>
              <span className="body-md">Your first personal estimate, shown with a likely range.</span>
            </li>
            <li>
              <b>Week 3+</b>
              <span className="body-md">The range tightens and your target follows when your burn drifts.</span>
            </li>
          </ol>
        </div>
        <ConvergeFigure />
      </div>
    </section>
  )
}

/* ── people ───────────────────────────────────────────────────────────── */

function People() {
  return (
    <section className="block" id="people">
      <div className="wrap people">
        <figure className="art-panel">
          <ArtImage
            name="athlete-b-redraw"
            sizes={ART_PANEL_SIZES}
            alt="Illustration of a woman in a sports top, hand on hip, looking ahead, with red measurement lines behind her"
          />
        </figure>
        <div>
          <h2 className="display-md">Designed for people who measure.</h2>
          <p className="body-md" style={{ marginTop: 20, maxWidth: 'calc(46 * var(--ch))' }}>
            Cutting, bulking, maintaining, or on a GLP-1 medication. The loop is the same: two numbers a day, read as a
            trend.
          </p>
          <ul className="audience">
            <li>
              <TrendIcon />
              <div>
                <b>Weight management</b>
                <span className="body-sm">with real data, not a formula</span>
              </div>
            </li>
            <li>
              <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <path d="M4 11v6M24 11v6M7 8v12M21 8v12M7 14h14" />
              </svg>
              <div>
                <b>Gym-goers and everyday people</b>
                <span className="body-sm">recomp, cut, or bulk</span>
              </div>
            </li>
            <li>
              <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <rect x="5" y="9" width="18" height="10" rx="5" transform="rotate(-40 14 14)" />
                <path d="M11 10l6 8" />
              </svg>
              <div>
                <b>Helpful for GLP-1 users</b>
                <span className="body-sm">see loss pace and composition</span>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </section>
  )
}

/* ── trust row ────────────────────────────────────────────────────────── */

function Privacy() {
  return (
    <section className="wrap" style={{ paddingBottom: 'var(--space-section)' }}>
      <div className="trio">
        <div>
          <h3>Numbers only</h3>
          <p className="body-sm">Weight, calories, optional tape. No bank, social, or health-app connections.</p>
        </div>
        <div>
          <h3>Export any day</h3>
          <p className="body-sm">Your full history as CSV, free on every plan.</p>
        </div>
        <div>
          <h3>Delete any entry</h3>
          <p className="body-sm">Or the whole account. Nothing is sold.</p>
        </div>
      </div>
    </section>
  )
}

/* ── closer ───────────────────────────────────────────────────────────── */

function HomeCloser() {
  return (
    <Closer id="pricing" lead="A sane target on day one." accent="Your own number in two weeks.">
      <p className="body-md">Free while in beta. Works in any browser and in Telegram.</p>
      <Link className="btn site-btn-primary" to="/sign-up">
        Start tracking <Arrow />
      </Link>
    </Closer>
  )
}

function HomePage() {
  return (
    <SiteShell>
      <Hero />
      <HowItWorks />
      <Analytics />
      <Method />
      <People />
      <Privacy />
      <HomeCloser />
    </SiteShell>
  )
}
