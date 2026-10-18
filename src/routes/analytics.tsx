import { createFileRoute, Link } from '@tanstack/react-router'
import LandingShell from '../components/landing/LandingShell'

const SITE_URL = 'https://physlane.unpackit.top'
const TITLE = 'Measure Your TDEE From Your Own Logs · physlane'
const DESCRIPTION =
  'What is my TDEE? physlane measures your total daily energy expenditure from your own calorie and weight logs: a sane start on day one, a measured number in two weeks.'

export const Route = createFileRoute('/analytics')({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { name: 'robots', content: 'index, follow' },
      { name: 'theme-color', content: '#141821' },
      { property: 'og:site_name', content: 'physlane' },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: `${SITE_URL}/analytics` },
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
    links: [{ rel: 'canonical', href: `${SITE_URL}/analytics` }],
  }),
  component: AnalyticsPage,
})

function AnalyticsPage() {
  return (
    <LandingShell current="analytics">
      <div className="wrap hero">
        <div className="hero-main">
          <p className="kicker">Analytics</p>
          <h1>Your burn rate, solved from your own data.</h1>
          <p className="sub">
            Every calculator runs Mifflin-St Jeor, 1990, times an activity
            multiplier you picked by feel. physlane uses your ledger instead:
            what you ate, what you weighed, and the difference between the two.
            After two weeks of logs the estimate settles on your actual burn,
            and it keeps moving as your metabolism adapts.
          </p>
          <div className="actions">
            <Link to="/sign-up" className="btn btn-ink">
              Open physlane
            </Link>
            <Link to="/guide" className="btn btn-line">
              Method and references
            </Link>
          </div>
        </div>
        <div className="hero-side">
          <div className="fact">
            <b className="mono">±300</b>
            <span>how far a calculator estimate is often off, per day</span>
          </div>
          <div className="fact">
            <b className="mono">7-14 d</b>
            <span>from sane starting target to measured burn</span>
          </div>
          <div className="fact">
            <b className="mono">1</b>
            <span>adherence number per week</span>
          </div>
          <div className="note">Illustrative figures on this page. Yours come from your logs.</div>
        </div>
      </div>

      <section className="block">
        <div className="wrap">
          <div className="block-head">
            <span className="no">§1</span>
            <h2>The ledger.</h2>
          </div>
          <table className="spec">
            <thead>
              <tr>
                <th>Line</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Calories in</td>
                <td>Your daily notes, 7-day windows</td>
              </tr>
              <tr>
                <td>Mass change</td>
                <td>Daily weigh-ins, smoothed trend</td>
              </tr>
              <tr>
                <td>Energy density</td>
                <td>≈ 7,700 kcal per kg, Wishnofsky 1958</td>
              </tr>
              <tr>
                <td>Adaptation</td>
                <td>Drift follows your logs, per Hall et al. 2011</td>
              </tr>
              <tr>
                <td>Output</td>
                <td>Daily burn with confidence bounds, re-solved as you log</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="block">
        <div className="wrap">
          <div className="block-head">
            <span className="no">§2</span>
            <h2>What the charts tell you.</h2>
          </div>
          <div className="cols3">
            <div>
              <span className="no">01</span>
              <h3>Whether it is working</h3>
              <p>Weight trend with phase bands and weekly slope. Plateaus get dates instead of feelings.</p>
            </div>
            <div>
              <span className="no">02</span>
              <h3>What the loss consists of</h3>
              <p>Navy-method body fat estimate from tape, trending next to weight.</p>
            </div>
            <div>
              <span className="no">03</span>
              <h3>How close you ran to target</h3>
              <p>Adherence per cycle: intake against target, one number a week.</p>
            </div>
          </div>
          <div className="disclaimer">
            <b>Read the sources yourself.</b> Wishnofsky 1958, Hall et al. 2011,
            Mifflin-St Jeor 1990, Siri 1956, Hodgdon and Beckett 1984. All
            linked in the <Link to="/guide">guide</Link>, which also states what
            physlane does not know.
          </div>
        </div>
      </section>

      <section className="block">
        <div className="wrap final">
          <div>
            <h2>A number no formula can give you.</h2>
            <p>Measured from your logs, updated as you change.</p>
            <Link to="/sign-up" className="btn btn-ink">
              Open physlane
            </Link>
          </div>
        </div>
      </section>
    </LandingShell>
  )
}
