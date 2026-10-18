import { createFileRoute, Link } from '@tanstack/react-router'
import LandingShell from '../components/landing/LandingShell'
import { useTelegramMode } from '#/lib/telegram-mode'

const SITE_URL = 'https://physlane.unpackit.top'
const TITLE = 'GLP-1 Weight Tracking App · physlane'
const DESCRIPTION =
  'GLP-1 weight tracking for Ozempic, Wegovy and Mounjaro: weight trend, real intake, tape and body fat estimate, clinician-ready exports. Not medical advice.'

export const Route = createFileRoute('/glp-1')({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { name: 'robots', content: 'index, follow' },
      { name: 'theme-color', content: '#141821' },
      { property: 'og:site_name', content: 'physlane' },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: `${SITE_URL}/glp-1` },
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
    links: [{ rel: 'canonical', href: `${SITE_URL}/glp-1` }],
  }),
  component: Glp1Page,
})

function Glp1Page() {
  const tgMode = useTelegramMode()
  return (
    <LandingShell current="glp-1">
      <div className="wrap hero">
        <div className="hero-main">
          <p className="kicker">For GLP-1 users</p>
          <h1>
            Fast loss is
            <br />
            easy to see.
            <br />
            Composition is
            <br />
            the question.
          </h1>
          <p className="sub">
            The medication suppresses appetite and the weight comes off. What
            the scale cannot tell you is how much of that loss is fat, whether
            you have started eating too little to hold on to muscle, and what
            to bring to the person prescribing. A twenty-second daily log
            answers all three, whether the prescription is Ozempic, Wegovy or
            Mounjaro.
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
                <Link to="/tracking" className="btn btn-line">
                  The daily log
                </Link>
              </>
            )}
          </div>
        </div>
        <div className="hero-side">
          <div className="fact">
            <b className="mono">−0.8</b>
            <span>kg per week, typical mid-treatment rate</span>
          </div>
          <div className="fact">
            <b className="mono">30<small> s</small></b>
            <span>for waist and neck tape</span>
          </div>
          <div className="fact">
            <b className="mono">2</b>
            <span>exports your clinician can read: card and CSV</span>
          </div>
          <div className="note">Not medical advice. Dose questions go to your prescriber.</div>
        </div>
      </div>

      <section className="block">
        <div className="wrap">
          <div className="block-head">
            <span className="no">§1</span>
            <h2>Three measurements.</h2>
          </div>
          <div className="cols3">
            <div>
              <span className="no">01</span>
              <h3>Weight, smoothed</h3>
              <p>
                Daily weigh-ins, weekly slope. Plateaus and dose changes become
                visible events with dates attached.
              </p>
            </div>
            <div>
              <span className="no">02</span>
              <h3>Intake, averaged</h3>
              <p>
                Quiet-appetite days are the important ones to log. The 7-day
                mean shows whether calories have drifted too low.
              </p>
            </div>
            <div>
              <span className="no">03</span>
              <h3>Tape, interpreted</h3>
              <p>
                Waist and neck feed a Navy body fat estimate. Weight down and
                estimate down together means the loss is mostly fat.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="block">
        <div className="wrap">
          <div className="block-head">
            <span className="no">§2</span>
            <h2>Built for appointments.</h2>
          </div>
          <p className="lead">
            Every entry carries a timestamp. Ahead of a visit, send the share
            card or the CSV: rate of loss, intake average, composition trend.
            The three questions every clinician asks are already answered.
          </p>
          <table className="spec">
            <thead>
              <tr>
                <th>Export</th>
                <th>Contains</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Share card</td>
                <td>Weekly summary, opt-in link, revocable</td>
              </tr>
              <tr>
                <td>CSV</td>
                <td>Full history: weight, intake, tape, body fat estimate</td>
              </tr>
            </tbody>
          </table>
          <div className="disclaimer">
            <b>Boundaries.</b> physlane is a tracker, not medical advice. It
            does not dose, diagnose or replace your care team. The body fat
            figure is an estimate from a tape measure with real error bars, so
            treat it as a direction rather than a verdict.
          </div>
        </div>
      </section>

      <section className="block">
        <div className="wrap final">
          <div>
            <h2>The medicine handles appetite. Your logs handle the rest.</h2>
            <p>
              Twenty seconds a day, in any browser or from the Telegram menu
              button, keeps the whole picture in one place. The free tier does
              the tracking; Pro, with GLP-1 mode, is $10 a month or $100 a
              year.
            </p>
            <Link to={tgMode ? '/dashboard' : '/sign-up'} className="btn btn-ink">
              Open physlane
            </Link>
          </div>
          <div className="side">
            <h3>Next</h3>
            <p>
              See how the daily log works, or read the method behind every
              number physlane shows.
            </p>
            <div className="actions" style={{ marginTop: 0 }}>
              <Link to="/tracking" className="btn btn-line">
                The daily log
              </Link>
              <Link to="/guide" className="btn btn-line">
                The guide
              </Link>
            </div>
          </div>
        </div>
      </section>
    </LandingShell>
  )
}
