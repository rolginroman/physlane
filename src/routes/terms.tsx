// Legal template — not legal advice; have a qualified lawyer review before launch.

import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "#/components/site/site-shell";
import {
  CONTACT_EMAIL,
  GOVERNING_LAW,
  LAST_UPDATED,
  OPERATOR,
} from "#/lib/legal";
import { SITE_URL, seoHead } from "#/lib/seo";

const TITLE = "Terms of Service · physlane";
const DESCRIPTION =
  "Rules for using physlane: accounts, subscriptions, health disclaimer, and MCP.";

export const Route = createFileRoute("/terms")({
  staticData: { appChrome: false },
  head: () =>
    seoHead({
      title: TITLE,
      description: DESCRIPTION,
      path: "/terms",
      image: `${SITE_URL}/og.png`,
    }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <SiteShell>
      <div className="wrap article">
        <header className="article-head">
          <p className="site-label">Legal</p>
          <h1 className="display-xl">Terms of Service</h1>
          <p className="body-lg">
            By using physlane you agree to these terms. This is a template, not
            legal advice.
          </p>
          <p className="blog-meta caption">
            Updated <time dateTime={LAST_UPDATED}>{LAST_UPDATED}</time>
          </p>
        </header>

        <div className="article-body prose">
          <h2>The service</h2>
          <p>
            physlane helps you track weight trends, daily calorie totals, body
            measurements, and diet phases (cut, bulk, maintain). It estimates
            adaptive TDEE from your own entries. Optional MCP access lets
            supported LLM clients read and write your data within scopes you
            grant. {OPERATOR} provides physlane as described on the site and in
            your account.
          </p>

          <h2>Eligibility</h2>
          <p>
            You must be at least 16 and able to enter a binding contract where
            you live. physlane is not for people with eating disorders or anyone
            who should be under professional care for weight or nutrition —
            please seek qualified help instead.
          </p>

          <h2>Accounts</h2>
          <p>
            Keep your sign-in details secure and your information accurate. You
            are responsible for activity on your account. Email verification and
            password-reset emails are not sent today; sign-up uses email and
            password with automatic sign-in after registration.
          </p>

          <h2>Subscriptions and billing</h2>
          <p>
            Pro is billed through Stripe (monthly or yearly plans shown on the
            billing page). Subscriptions renew automatically until you cancel in
            the Stripe billing portal. After canceling, you keep access until
            the end of the paid period.
          </p>
          <p>
            If you are in the EU, you may have a 14-day right to withdraw from a
            distance contract. To exercise it, contact {CONTACT_EMAIL}. Refunds
            beyond that are considered case by case via the same contact.
          </p>

          <h2>Acceptable use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Use physlane for anything unlawful or harmful.</li>
            <li>
              Abuse the API, MCP, or automation in ways that harm the service or
              others.
            </li>
            <li>Scrape or access other users’ data.</li>
            <li>Enter someone else’s health data without permission.</li>
          </ul>

          <h2>Health disclaimer</h2>
          <p>
            physlane is informational only. It is not medical advice, diagnosis,
            or treatment. TDEE and other numbers are statistical estimates, not
            prescriptions. Consult a qualified professional for health
            decisions, including eating disorders.
          </p>

          <h2>MCP and LLM integrations</h2>
          <p>
            If you connect a third-party LLM client, you do so at your own risk.
            Their outputs and actions are theirs, not physlane’s. Access follows
            the scopes you approve. To disconnect an existing client, contact{" "}
            {CONTACT_EMAIL} (self-serve revoke is not available yet).
          </p>

          <h2>Intellectual property</h2>
          <p>
            You keep ownership of the data you enter. physlane owns the service,
            software, and branding. Blog articles are © physlane unless stated
            otherwise.
          </p>

          <h2>Termination</h2>
          <p>
            You may stop using physlane anytime. We may suspend or end access
            for abuse or breach of these terms. What happens to your data is
            described in our <Link to="/privacy">Privacy Policy</Link>.
          </p>

          <h2>Liability</h2>
          <p>
            physlane is provided “as is”. We do not warrant fitness for a
            particular purpose or medical outcomes. To the extent permitted by{" "}
            {GOVERNING_LAW}, our total liability for claims relating to the
            service in any 12-month period is limited to the fees you paid us in
            that period.{" "}
            <strong>
              [PLACEHOLDER: confirm cap and exclusions with counsel.]
            </strong>{" "}
            Nothing here excludes liability that cannot be excluded by law.
          </p>

          <h2>Governing law</h2>
          <p>
            These terms are governed by {GOVERNING_LAW}, without regard to
            conflict-of-law rules.{" "}
            <strong>
              [PLACEHOLDER: courts and dispute resolution — owner to complete.]
            </strong>
          </p>

          <h2>Changes</h2>
          <p>
            We may update these terms. We will change the “Updated” date when we
            do. If changes are material, we may notify you by reasonable means.
            Continued use after the effective date means you accept the new
            terms where allowed by law.
          </p>

          <p>
            Questions: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            See also our <Link to="/privacy">Privacy Policy</Link>.
          </p>
        </div>
      </div>
    </SiteShell>
  );
}
