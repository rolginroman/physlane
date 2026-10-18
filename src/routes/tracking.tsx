import { createFileRoute, Link } from '@tanstack/react-router'
import LandingShell from '../components/landing/LandingShell'

const SITE_URL = 'https://physlane.unpackit.top'
const TITLE = 'Daily Weight and Calorie Log · physlane'
const DESCRIPTION =
  'A daily weight and calorie log in any browser or Telegram: twenty-second check-ins, tape and body fat, reminders, editable history and CSV export. Free while beta.'

export const Route = createFileRoute('/tracking')({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { name: 'robots', content: 'index, follow' },
      { name: 'theme-color', content: '#ffffff' },
      { property: 'og:site_name', content: 'physlane' },
      { property: 'og:type', content: 'website' },
      { property: 'og:url', content: `${SITE_URL}/tracking` },
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
    links: [{ rel: 'canonical', href: `${SITE_URL}/tracking` }],
  }),
  component: TrackingPage,
})

function TrackingPage() {
  return (
    <LandingShell current="tracking">
      <div className="wrap hero">
        <div className="hero-main">
          <p className="kicker">Tracking</p>
          <h1>One form, twenty seconds. That is the product.</h1>
          <p className="sub">
            You install nothing and there is no maze of screens to learn. Open
            it in any browser or from the Telegram menu button; the log takes
            twenty seconds, and the entries accumulate into the one dataset
            that matters: yours.
          </p>
          <div className="actions">
            <Link to="/sign-up" className="btn btn-ink">
              Open physlane
            </Link>
            <Link to="/analytics" className="btn btn-line">
              What the data becomes
            </Link>
          </div>
        </div>
        <div className="hero-side">
          <div className="fact">
            <b className="mono">4</b>
            <span>fields: date, weight, calories, tape</span>
          </div>
          <div className="fact">
            <b className="mono">1</b>
            <span>required: make the day count</span>
          </div>
          <div className="fact">
            <b className="mono">∞</b>
            <span>edits. Fix any entry, everything recomputes</span>
          </div>
          <div className="note">Reminders fire at your local time, from the device you saved on.</div>
        </div>
      </div>

      <section className="block">
        <div className="wrap">
          <div className="block-head">
            <span className="no">§1</span>
            <h2>The loop.</h2>
          </div>
          <div className="cols3">
            <div>
              <span className="no">01</span>
              <h3>Open</h3>
              <p>
                Browser bookmark, Telegram menu button, or the daily reminder.
                One tap, the form is up, prefilled with today.
              </p>
            </div>
            <div>
              <span className="no">02</span>
              <h3>Enter</h3>
              <p>
                Weight. Calories. Tape, some days. Fields you skip stay empty
                and the day still counts.
              </p>
            </div>
            <div>
              <span className="no">03</span>
              <h3>Review</h3>
              <p>
                One screen: trend, target, adherence. History with every delta,
                every entry editable.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="block">
        <div className="wrap">
          <div className="block-head">
            <span className="no">§2</span>
            <h2>The terms.</h2>
          </div>
          <table className="spec">
            <thead>
              <tr>
                <th>Item</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Units</td>
                <td>kg and cm, or lb and in, switchable anytime</td>
              </tr>
              <tr>
                <td>Reminders</td>
                <td>Daily, local time zone, set from the device</td>
              </tr>
              <tr>
                <td>Sharing</td>
                <td>Opt-in card, revocable link, off by default</td>
              </tr>
              <tr>
                <td>Export</td>
                <td>CSV of measurements and intake, any day</td>
              </tr>
              <tr>
                <td>Price</td>
                <td>Free while beta, Pro at $10 per month later</td>
              </tr>
            </tbody>
          </table>
          <div className="disclaimer">
            <b>Why it sticks.</b> A check-in that opens where you already are,
            browser or chat, is the one you keep. Friction kills more diets
            than pizza does.
          </div>
        </div>
      </section>

      <section className="block">
        <div className="wrap final">
          <div>
            <h2>Twenty seconds a day, a real dataset in two weeks.</h2>
            <p>That is the whole commitment.</p>
            <Link to="/sign-up" className="btn btn-ink">
              Open physlane
            </Link>
          </div>
        </div>
      </section>
    </LandingShell>
  )
}
