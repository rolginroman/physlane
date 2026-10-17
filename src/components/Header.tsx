import { Link, useMatchRoute, useRouter } from '@tanstack/react-router'
import { signOut, useSession } from '#/lib/auth-client'
import { useTelegramMode } from '#/lib/telegram-mode'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/intake', label: 'Intake' },
  { to: '/cycles', label: 'Cycles' },
] as const

const navLinkBase =
  'inline-flex min-h-11 items-center rounded-md px-2.5 text-sm font-medium'

export default function Header() {
  const { data: session, isPending } = useSession()
  const router = useRouter()
  const matchRoute = useMatchRoute()
  // Telegram mode: slim the header — no marketing CTAs, no billing/avatar cluster.
  const tgMode = useTelegramMode()

  const user = session?.user
  const displayName = user?.name?.trim() || user?.email || ''
  const initial = displayName ? (displayName[0] ?? '').toUpperCase() : ''

  async function handleSignOut() {
    await signOut()
    await router.navigate({ to: '/' })
    void router.invalidate()
  }

  return (
    <header
      className={`sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur ${
        tgMode ? 'min-h-14' : 'h-14'
      }`}
      style={tgMode ? { paddingTop: 'var(--tg-safe-top, 0px)' } : undefined}
    >
      <div className="mx-auto flex h-full max-w-5xl items-center gap-3 px-4">
        <Link
          to="/"
          aria-label="physlane home"
          className="text-base font-semibold tracking-tight text-text no-underline"
        >
          phys<span className="text-accent">lane</span>
        </Link>

        <nav aria-label="App" className="ml-auto flex items-center gap-1 sm:gap-2">
          {isPending ? null : user ? (
            <>
              {NAV_ITEMS.map((item) => {
                const active = Boolean(matchRoute({ to: item.to, fuzzy: true }))
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={
                      active ? navLinkBase : `${navLinkBase} hidden sm:inline-flex`
                    }
                    activeProps={{ className: 'text-accent' }}
                    inactiveProps={{ className: 'text-dim hover:text-text' }}
                  >
                    {item.label}
                  </Link>
                )
              })}
              {!tgMode && (
                <Link
                  to="/billing"
                  className={navLinkBase}
                  activeProps={{ className: 'text-accent' }}
                  inactiveProps={{ className: 'text-dim hover:text-text' }}
                >
                  Billing
                </Link>
              )}
              {!tgMode && (
                <div
                  className="mx-1 hidden h-5 w-px bg-line sm:block"
                  aria-hidden="true"
                />
              )}
              {!tgMode && (
                <span className="hidden items-center gap-2 sm:flex">
                  <span
                    title={displayName}
                    className="flex h-7 w-7 items-center justify-center rounded-full border border-line bg-surface2 text-xs font-semibold text-dim"
                  >
                    {initial}
                  </span>
                  <span className="inline-block max-w-28 truncate text-xs text-dim">
                    {displayName}
                  </span>
                </span>
              )}
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex min-h-11 items-center rounded-md px-2.5 text-sm font-medium text-dim hover:text-text"
              >
                Sign out
              </button>
            </>
          ) : tgMode ? null : (
            <>
              <Link
                to="/sign-in"
                className={`${navLinkBase} text-dim hover:text-text`}
              >
                Sign in
              </Link>
              <Link to="/sign-up" className="btn-primary px-3">
                Create account
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  )
}
