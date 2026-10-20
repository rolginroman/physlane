import { createFileRoute, Link } from "@tanstack/react-router";
import SiteShell, { Arrow } from "../components/site/SiteShell";
import { WeightTrendCard } from "../components/site/DashboardPreview";
import { LearnIcon, TapeIcon, TrendIcon } from "../components/site/icons";
import {
  ART_PANEL_SIZES,
  ArtImage,
  Closer,
  Facts,
  PageHero,
  Steps,
} from "../components/site/sections";
import SiteTable from "../components/site/SiteTable";
import { useTelegramMode } from "#/lib/telegram-mode";

const SITE_URL = "https://physlane.unpackit.top";
const TITLE = "GLP-1 Weight Tracking App · physlane";
const DESCRIPTION =
  "GLP-1 weight tracking for Ozempic, Wegovy and Mounjaro: weight trend, real intake, tape and body fat estimate, clinician-ready exports. Not medical advice.";

export const Route = createFileRoute("/glp-1")({
  staticData: { appChrome: false },
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "robots", content: "index, follow" },
      { property: "og:site_name", content: "physlane" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/glp-1` },
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
    links: [{ rel: "canonical", href: `${SITE_URL}/glp-1` }],
  }),
  component: Glp1Page,
});

function Glp1Page() {
  const tgMode = useTelegramMode();
  return (
    <SiteShell>
      <PageHero
        eyebrow="For GLP-1 users"
        title={
          <>
            On GLP-1, fast loss is easy to see.{" "}
            <span className="em">Composition</span> is the question.
          </>
        }
        sub="The medication suppresses appetite and the weight comes off. A twenty-second daily log shows what the scale cannot, whether the prescription is Ozempic, Wegovy or Mounjaro."
        actions={
          tgMode ? (
            <Link className="btn site-btn-primary" to="/dashboard">
              Open the app <Arrow />
            </Link>
          ) : (
            <>
              <Link className="btn site-btn-primary" to="/sign-up">
                Start tracking <Arrow />
              </Link>
              <Link className="link" to="/tracking">
                The daily log
              </Link>
            </>
          )
        }
        art={
          <ArtImage
            name="athlete-c2-w"
            sizes={ART_PANEL_SIZES}
            loading="eager"
            alt="Illustration of a woman with shoulder-length dark hair in a sweater, looking ahead, beside a rising trend line"
          />
        }
      />

      <section className="block" aria-labelledby="measurements">
        <div className="wrap split section-head">
          <div>
            <h2 className="display-md" id="measurements">
              Three measurements.
            </h2>
            <p className="body-md">
              The scale cannot tell you how much of the loss is fat, whether you
              have started eating too little to hold on to muscle, or what to
              bring to the person prescribing. Three measurements answer all
              three.
            </p>
          </div>
          <figure className="chart-figure">
            <WeightTrendCard />
            <figcaption className="caption" style={{ marginTop: 12 }}>
              Example values for illustration. Your numbers come from your own
              logs.
            </figcaption>
          </figure>
        </div>
        <div className="wrap">
          <Steps
            label="Three measurements"
            flow={false}
            items={[
              {
                icon: <TrendIcon />,
                title: "Weight, smoothed",
                body: "Daily weigh-ins, weekly slope. Plateaus and dose changes become visible events with dates attached.",
              },
              {
                icon: <LearnIcon />,
                title: "Intake, averaged",
                body: "Log the quiet-appetite days most of all. The 7-day mean shows whether calories have drifted too low.",
              },
              {
                icon: <TapeIcon />,
                title: "Tape, interpreted",
                body: "Waist and neck feed a Navy body fat estimate. Weight and estimate falling together means the loss is mostly fat.",
              },
            ]}
          />
        </div>
      </section>

      <section className="block band" aria-labelledby="appointments">
        <div className="wrap split">
          <div>
            <p className="site-label">Your care team</p>
            <h2
              className="display-md"
              id="appointments"
              style={{ marginTop: 16 }}
            >
              Built for appointments.
            </h2>
            <p className="body-md">
              Every entry carries a timestamp. Before a visit, send the share
              card or the CSV: rate of loss, intake average, composition trend.
              The three questions every clinician asks are already answered.
            </p>
          </div>
          <div>
            <SiteTable
              caption="Exports for your clinician"
              columns={["Export", "Contains"]}
              rows={[
                ["Share card", "Weekly summary, opt-in link, revocable"],
                [
                  "CSV",
                  "Full history: weight, intake, tape, body fat estimate",
                ],
              ]}
            />
            <p className="body-sm note">
              <b>Boundaries.</b> physlane is a tracker, not medical advice. It
              does not dose, diagnose or replace your care team. The body fat
              figure is an estimate from a tape measure with real error bars.
              Treat it as a direction, not a verdict.
            </p>
          </div>
        </div>
      </section>

      <Facts
        items={[
          ["−0.8 kg", "per week, a typical mid-treatment rate"],
          ["30 s", "for waist and neck tape"],
          ["2", "exports your clinician can read: card and CSV"],
        ]}
        note="Not medical advice. Dose questions go to your prescriber."
      />

      <Closer
        lead="The medicine handles appetite."
        accent="Your logs handle the rest."
      >
        <p className="body-md">
          Twenty seconds a day, in any browser or from the Telegram menu button.
          The free tier does the tracking. Pro, with GLP-1 mode, is $10 a month
          or $100 a year.
        </p>
        <p className="body-md">
          See <Link to="/tracking">how the daily log works</Link>, or read{" "}
          <Link to="/guide">the method</Link> behind every number physlane
          shows.
        </p>
        <Link
          className="btn site-btn-primary"
          to={tgMode ? "/dashboard" : "/sign-up"}
        >
          {tgMode ? "Open the app" : "Start tracking"} <Arrow />
        </Link>
      </Closer>
    </SiteShell>
  );
}
