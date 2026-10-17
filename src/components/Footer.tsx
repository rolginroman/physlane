import { Link, useRouterState } from '@tanstack/react-router'
import { useTelegramMode } from '#/lib/telegram-mode'

/**
 * Route-aware footer: the landing gets the marketing footer (links, share,
 * stance), app surfaces keep the one-liner product register. Inside Telegram
 * the marketing footer is dropped everywhere — dense shell, no nav duplication.
 */
export default function Footer() {
  const path = useRouterState({ select: (s) => s.location.pathname })
  const tgMode = useTelegramMode()
  const isLanding = path === '/'

  if (!isLanding || tgMode) {
    return (
      <footer className="px-4 py-6">
        <p className="m-0 text-center text-xs text-faint">
          physlane · manual numbers only, no bank or social integrations ·{' '}
          <Link
            to="/billing"
            className="inline-flex items-center px-2 py-2 text-dim underline decoration-line underline-offset-2 hover:text-text"
          >
            Pricing
          </Link>
        </p>
      </footer>
    )
  }

  const shareUrl = 'https://physlane.unpackit.top/'
  const shareText = 'physlane learns your real daily calorie burn from your own weigh-ins and food logs'

  return (
    <footer className="border-t border-line px-4 py-10 sm:px-6">
      <div className="mx-auto grid w-full max-w-6xl gap-8 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="m-0 text-sm font-semibold text-text">physlane</p>
          <p className="m-0 mt-2 max-w-56 text-xs leading-relaxed text-dim">
            Find your real daily calorie burn, from your own numbers. Manual entry only.
          </p>
        </div>
        <nav aria-label="Product">
          <p className="m-0 text-xs font-semibold uppercase tracking-wide text-faint">Product</p>
          <ul className="m-0 mt-3 list-none space-y-2 p-0">
            <li>
              <Link to="/sign-up" className="inline-flex min-h-8 items-center text-sm text-dim no-underline hover:text-text">
                Create account
              </Link>
            </li>
            <li>
              <Link to="/sign-in" className="inline-flex min-h-8 items-center text-sm text-dim no-underline hover:text-text">
                Sign in
              </Link>
            </li>
            <li>
              <a href="/#pricing" className="inline-flex min-h-8 items-center text-sm text-dim no-underline hover:text-text">
                Pricing
              </a>
            </li>
            <li>
              <a href="/#faq" className="inline-flex min-h-8 items-center text-sm text-dim no-underline hover:text-text">
                Questions
              </a>
            </li>
          </ul>
        </nav>
        <nav aria-label="Stance">
          <p className="m-0 text-xs font-semibold uppercase tracking-wide text-faint">Stance</p>
          <ul className="m-0 mt-3 list-none space-y-2 p-0 text-sm text-dim">
            <li>No food database, ever</li>
            <li>No bank or social integrations</li>
            <li>Delete any entry anytime</li>
            <li>Nothing sold, nothing shared</li>
          </ul>
        </nav>
        <div>
          <p className="m-0 text-xs font-semibold uppercase tracking-wide text-faint">Share</p>
          <ul className="m-0 mt-3 list-none space-y-2 p-0">
            <li>
              <a
                href={`https://x.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-8 items-center text-sm text-dim no-underline hover:text-text"
              >
                Post on X
              </a>
            </li>
            <li>
              <a
                href={`https://www.reddit.com/submit?url=${encodeURIComponent(shareUrl)}&title=${encodeURIComponent(shareText)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-8 items-center text-sm text-dim no-underline hover:text-text"
              >
                Post on Reddit
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="mx-auto mt-8 w-full max-w-6xl border-t border-line pt-5">
        <p className="num m-0 text-xs text-faint">© 2026 physlane · two numbers a day</p>
      </div>
    </footer>
  )
}
