import { createFileRoute, Link } from "@tanstack/react-router";
import { Arrow, SiteShell } from "../components/site/site-shell";
import { ConvergeFigure } from "../components/site/charts";
import { LearnIcon, TapeIcon, TrendIcon } from "../components/site/icons";
import {
  ART_PANEL_SIZES,
  ArtImage,
  Closer,
  Facts,
  PageHero,
  Steps,
} from "../components/site/sections";
import { SiteTable } from "../components/site/site-table";

const SITE_URL = "https://physlane.unpackit.top";
const TITLE = "Measure Your TDEE From Your Own Logs · physlane";
const DESCRIPTION =
  "What is my TDEE? physlane measures your total daily energy expenditure from your own calorie and weight logs: a sane start on day one, a measured number in two weeks.";

export const Route = createFileRoute("/analytics")({
  staticData: { appChrome: false },
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { name: "robots", content: "index, follow" },
      { property: "og:site_name", content: "physlane" },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_URL}/analytics` },
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
    links: [{ rel: "canonical", href: `${SITE_URL}/analytics` }],
  }),
  component: AnalyticsPage,
});

function AnalyticsPage() {
  return (
    <SiteShell>
      <PageHero
        eyebrow="Analytics"
        title={
          <>
            Your burn rate, solved from your own{" "}
            <span className="em">data.</span>
          </>
        }
        sub="physlane reads your ledger: what you ate, what you weighed, and the difference between the two. After two weeks of logs, the estimate settles on your actual burn."
        actions={
          <>
            <Link className="btn site-btn-primary" to="/sign-up">
              Start tracking <Arrow />
            </Link>
            <Link className="link" to="/guide">
              Method and references
            </Link>
          </>
        }
        art={
          <ArtImage
            name="athlete-c3-analytics"
            sizes={ART_PANEL_SIZES}
            loading="eager"
            alt="Illustration of a hand holding a phone with a chart grid on screen, a red trend line running behind it"
          />
        }
        figure={<ConvergeFigure />}
      />

      <section className="block" aria-labelledby="charts">
        <div className="wrap">
          <div className="section-head">
            <h2 className="display-md" id="charts">
              What the charts tell you.
            </h2>
          </div>
          <Steps
            label="What the charts tell you"
            flow={false}
            items={[
              {
                icon: <TrendIcon />,
                title: "Whether it is working",
                body: "Weight trend with phase bands and weekly slope. Plateaus get dates instead of feelings.",
              },
              {
                icon: <TapeIcon />,
                title: "What the loss consists of",
                body: "A Navy-method body fat estimate from tape, trending next to weight.",
              },
              {
                icon: <LearnIcon />,
                title: "How close you ran to target",
                body: "Adherence per cycle: intake against target, one number a week.",
              },
            ]}
          />
        </div>
      </section>

      <section className="block band" aria-labelledby="ledger">
        <div className="wrap split">
          <div>
            <p className="site-label">The method</p>
            <h2 className="display-md" id="ledger" style={{ marginTop: 16 }}>
              The ledger.
            </h2>
            <p className="body-md">
              Every calculator runs Mifflin-St Jeor (1990) times an activity
              multiplier you picked by feel. physlane uses your ledger instead.
              The estimate keeps moving as your metabolism adapts.
            </p>
            <p className="body-sm note">
              <b>Read the sources yourself.</b> Wishnofsky 1958, Hall et al.
              2011, Mifflin-St Jeor 1990, Siri 1956, Hodgdon and Beckett 1984.
              All linked in the <Link to="/guide">guide</Link>, which also
              states what physlane does not know.
            </p>
          </div>
          <SiteTable
            caption="The ledger: each line and its source"
            columns={["Line", "Source"]}
            rows={[
              ["Calories in", "Your daily notes, 7-day windows"],
              ["Mass change", "Daily weigh-ins, smoothed trend"],
              ["Energy density", "≈ 7,700 kcal per kg, Wishnofsky 1958"],
              ["Adaptation", "Drift follows your logs, per Hall et al. 2011"],
              [
                "Output",
                "Daily burn with confidence bounds, re-solved as you log",
              ],
            ]}
          />
        </div>
      </section>

      <Facts
        items={[
          ["±300", "kcal a day: how far a calculator estimate is often off"],
          ["7–14 d", "from a sane starting target to a measured burn"],
          ["1", "adherence number per week"],
        ]}
        note="Illustrative figures on this page. Yours come from your logs."
      />

      <Closer
        lead="A number no formula can give you."
        accent="Measured from your logs, updated as you change."
      >
        <p className="body-md">
          Free while in beta. Works in any browser and in Telegram.
        </p>
        <Link className="btn site-btn-primary" to="/sign-up">
          Start tracking <Arrow />
        </Link>
      </Closer>
    </SiteShell>
  );
}
