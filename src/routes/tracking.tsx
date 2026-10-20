import { createFileRoute, Link } from "@tanstack/react-router";
import SiteShell, { Arrow } from "../components/site/SiteShell";
import DashboardPreview from "../components/site/DashboardPreview";
import { LearnIcon, LogIcon, OpenIcon } from "../components/site/icons";
import {
  ART_PANEL_SIZES,
  ArtImage,
  Closer,
  Facts,
  PageHero,
  Steps,
} from "../components/site/sections";
import SiteTable from "../components/site/SiteTable";

const SITE_URL = "https://physlane.unpackit.top";
const TITLE = "Daily Weight and Calorie Log · physlane";
const DESCRIPTION =
  "A daily weight and calorie log in any browser or Telegram: twenty-second check-ins, tape and body fat, reminders, editable history and CSV export. Free while beta.";

export const Route = createFileRoute("/tracking")({
  staticData: { appChrome: false },
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "robots", content: "index, follow" },
      { property: "og:site_name", content: "physlane" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/tracking` },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:image", content: `${SITE_URL}/og.png` },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: TITLE },
      { name: "twitter:description", content: DESCRIPTION },
      { name: "twitter:image", content: `${SITE_URL}/og.png` },
    ],
    links: [{ rel: "canonical", href: `${SITE_URL}/tracking` }],
  }),
  component: TrackingPage,
});

function TrackingPage() {
  return (
    <SiteShell>
      <PageHero
        eyebrow="Tracking"
        title={
          <>
            A weight and calorie log in twenty{" "}
            <span className="em">seconds.</span>
          </>
        }
        sub="One form. That is the product. Nothing to install, no maze of screens. Open it in any browser or from the Telegram menu button, and the entries add up to the one dataset that matters: yours."
        actions={
          <>
            <Link className="btn site-btn-primary" to="/sign-up">
              Start tracking <Arrow />
            </Link>
            <Link className="link" to="/analytics">
              What the data becomes
            </Link>
          </>
        }
        art={
          <ArtImage
            name="athlete-c1-everyday"
            sizes={ART_PANEL_SIZES}
            loading="eager"
            alt="Illustration of a grey-haired man in a jacket and T-shirt, looking ahead, with a red circle and trend line behind him"
          />
        }
        figure={<DashboardPreview tab="Log" />}
      />

      <section className="block" aria-labelledby="loop">
        <div className="wrap">
          <div className="section-head">
            <h2 className="display-md" id="loop">
              The loop.
            </h2>
          </div>
          <Steps
            label="The loop"
            items={[
              {
                icon: <OpenIcon />,
                title: "Open",
                body: "Browser bookmark, Telegram menu button, or the daily reminder. One tap, and the form is up, prefilled with today.",
              },
              {
                icon: <LogIcon />,
                title: "Enter",
                body: "Weight. Calories. Tape, some days. Fields you skip stay empty, and the day still counts.",
              },
              {
                icon: <LearnIcon />,
                title: "Review",
                body: "One screen: trend, target, adherence. History with every delta, every entry editable.",
              },
            ]}
          />
        </div>
      </section>

      <section className="block band" aria-labelledby="terms">
        <div className="wrap split">
          <div>
            <p className="site-label">The details</p>
            <h2 className="display-md" id="terms" style={{ marginTop: 16 }}>
              The terms.
            </h2>
            <p className="body-sm note">
              <b>Why it sticks.</b> A check-in that opens where you already are,
              browser or chat, is the one you keep. Friction kills more diets
              than pizza does.
            </p>
          </div>
          <SiteTable
            caption="The terms: units, reminders, sharing, export and price"
            columns={["Item", "Detail"]}
            rows={[
              ["Units", "kg and cm, or lb and in, switchable anytime"],
              ["Reminders", "Daily, local time zone, set from the device"],
              ["Sharing", "Opt-in card, revocable link, off by default"],
              ["Export", "CSV of measurements and intake, any day"],
              ["Price", "Free while beta, Pro at $10 per month later"],
            ]}
          />
        </div>
      </section>

      <Facts
        items={[
          ["4", "fields: date, weight, calories, tape"],
          ["1", "required: make the day count"],
          ["∞", "edits. Fix any entry, and everything recomputes"],
        ]}
        note="Reminders fire at your local time, from the device you saved on."
      />

      <Closer
        lead="Twenty seconds a day."
        accent="A real dataset in two weeks."
      >
        <p className="body-md">That is the whole commitment.</p>
        <Link className="btn site-btn-primary" to="/sign-up">
          Start tracking <Arrow />
        </Link>
      </Closer>
    </SiteShell>
  );
}
