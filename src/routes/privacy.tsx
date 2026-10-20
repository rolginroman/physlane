// Legal template — not legal advice; have a qualified lawyer review before launch.

import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteShell } from "#/components/site/site-shell";
import {
  ADDRESS,
  CONTACT_EMAIL,
  GOVERNING_LAW,
  LAST_UPDATED,
  OPERATOR,
} from "#/lib/legal";
import { SITE_URL, seoHead } from "#/lib/seo";

const TITLE = "Privacy Policy · physlane";
const DESCRIPTION =
  "What physlane stores, why, who we share it with, and your choices.";

export const Route = createFileRoute("/privacy")({
  staticData: { appChrome: false },
  head: () =>
    seoHead({
      title: TITLE,
      description: DESCRIPTION,
      path: "/privacy",
      image: `${SITE_URL}/og.png`,
    }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <SiteShell>
      <div className="wrap article">
        <header className="article-head">
          <p className="site-label">Legal</p>
          <h1 className="display-xl">Privacy Policy</h1>
          <p className="body-lg">
            This page describes how physlane handles your data. It is a
            template, not legal advice.
          </p>
          <p className="blog-meta caption">
            Updated <time dateTime={LAST_UPDATED}>{LAST_UPDATED}</time>
          </p>
        </header>

        <div className="article-body prose">
          <h2>Who we are</h2>
          <p>
            {OPERATOR} (“we”, “us”) runs physlane. We are the data controller
            for personal data you provide through the service.
          </p>
          <p>
            Address: {ADDRESS}
            <br />
            Contact: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
          </p>

          <h2>What we store</h2>
          <p>We store only what you enter or what the service needs to run.</p>
          <ul>
            <li>
              <strong>Account data:</strong> name, email, whether your email is
              verified, profile image (if you add one), unit preference (metric
              or imperial), plan (free or Pro), optional height, sex, whether
              you use GLP-1 medication, and Stripe customer id if you subscribe.
            </li>
            <li>
              <strong>Health and body data:</strong> weight, body measurements
              (neck, chest, waist, hips, arms, thighs, calves), notes, dates;
              daily calorie intake (and optional protein); diet cycles (cut,
              bulk, or maintain) with targets and notes; progress photos (pose
              and date). Photos are stored privately in Cloudflare R2.
            </li>
            <li>
              <strong>Telegram (optional):</strong> if you sign in or use the
              mini app, we may store your Telegram id and username. If you turn
              on reminders, we send at most one digest per week per chat with
              your latest weigh-in, weight change, calorie averages, and cycle
              info.
            </li>
            <li>
              <strong>Waitlist:</strong> email and source if you joined from the
              landing page. We do not send marketing email from that list today.
            </li>
            <li>
              <strong>Technical data:</strong> sign-in sessions (up to 7 days,
              refreshed while you use the app) including IP address and browser
              user agent; OAuth and MCP tokens if you connect external apps.
            </li>
            <li>
              <strong>Share links:</strong> an opaque token for optional
              progress cards; you can revoke it by rotating the link in
              settings.
            </li>
          </ul>
          <p>
            On your device we use a session cookie (httpOnly, 7 days) and
            localStorage key <code>physlane-theme</code> for appearance. We do
            not use analytics, tracking pixels, or advertising cookies.
          </p>

          <h2>Why we use your data</h2>
          <ul>
            <li>
              <strong>Account and service (contract):</strong> to run your
              account, show your logs, estimates, billing, and optional Telegram
              features.
            </li>
            <li>
              <strong>Health and body data (explicit consent):</strong> you
              choose to enter weight, measurements, intake, cycles, and photos.
              Under GDPR this is special-category data (Article 9). You may
              withdraw consent by stopping use of those features or by
              contacting us; withdrawal does not affect processing that was
              lawful before withdrawal.
            </li>
            <li>
              <strong>Security (legitimate interest):</strong> sessions, IP, and
              user agent help protect accounts and abuse.
            </li>
          </ul>

          <h2>Who we share data with</h2>
          <p>
            We do not sell your data. We use processors who help run the
            service:
          </p>
          <ul>
            <li>
              <strong>Cloudflare:</strong> hosting, D1 database, and private R2
              storage for photos (global network).
            </li>
            <li>
              <strong>Stripe:</strong> checkout, subscriptions, and billing
              portal. Your email and Stripe customer id are shared with Stripe
              when you pay.
            </li>
            <li>
              <strong>Telegram:</strong> only if you use Telegram sign-in, the
              mini app, or weekly reminders. The Telegram Web App script loads
              from telegram.org when you use those features.
            </li>
          </ul>
          <p>
            We do not use analytics providers, ad networks, error-tracking SDKs,
            or a transactional email provider (account email flows are limited
            today).
          </p>

          <h2>Connected apps (MCP)</h2>
          <p>
            physlane offers an MCP server so LLM clients (for example Claude or
            ChatGPT) can read your measurements, intake, and cycles and log
            entries on your behalf, within scopes you approve on a consent
            screen (<code>openid</code>, <code>profile</code>,{" "}
            <code>offline_access</code>, <code>mcp:read</code>,{" "}
            <code>mcp:write</code>). Access uses short-lived bearer tokens;
            refresh tokens are stored on our servers.
          </p>
          <p>
            You can decline access at the consent screen. There is no in-app
            list to revoke an already-connected client yet — contact us at{" "}
            {CONTACT_EMAIL} to disconnect one.
          </p>

          <h2>International transfers</h2>
          <p>
            Cloudflare, Stripe, and Telegram may process data outside your
            country.{" "}
            <strong>
              [PLACEHOLDER: transfer mechanism such as Standard Contractual
              Clauses — confirm with counsel for {GOVERNING_LAW}.]
            </strong>
          </p>

          <h2>How long we keep data</h2>
          <p>
            We keep your data while your account is active and as needed to
            provide the service.{" "}
            <strong>
              [PLACEHOLDER: retention period after account closure — owner to
              define.]
            </strong>{" "}
            You can delete individual entries anytime in the app.
          </p>

          <h2>Your rights</h2>
          <p>Depending on where you live, you may have the right to:</p>
          <ul>
            <li>Access and receive a copy of your data.</li>
            <li>
              Export measurements and daily intake as CSV from settings (all
              plans). Progress photos are not included in that export.
            </li>
            <li>Correct inaccurate data in the app or by contacting us.</li>
            <li>
              Delete entries yourself anytime; for full account deletion,
              contact {CONTACT_EMAIL} (we do not offer self-serve account
              deletion yet).
            </li>
            <li>Withdraw consent for health-related processing.</li>
            <li>Object to certain processing where the law allows.</li>
            <li>
              Complain to a supervisory authority —{" "}
              <strong>[PLACEHOLDER: authority for your region.]</strong>
            </li>
          </ul>

          <h2>Security</h2>
          <p>
            We use HTTPS in transit. Progress photos are private in R2 with
            per-user keys. We protect secrets and tokens on the server. We do
            not claim encryption at rest beyond what Cloudflare provides.
          </p>

          <h2>Children</h2>
          <p>
            physlane is not for anyone under 16. We do not knowingly collect
            data from children.
          </p>

          <h2>Not medical advice</h2>
          <p>
            physlane is for personal tracking and estimates only. It is not
            medical advice and does not replace a qualified professional.
          </p>

          <h2>Changes</h2>
          <p>
            We may update this policy. We will change the “Updated” date at the
            top when we do. Continued use after changes means you accept the
            updated policy where the law allows.
          </p>

          <p>
            See also our <Link to="/terms">Terms of Service</Link>.
          </p>
        </div>
      </div>
    </SiteShell>
  );
}
