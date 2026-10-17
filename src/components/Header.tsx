import { useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useSession } from '#/lib/auth-client'
import { useTelegramMode } from '#/lib/telegram-mode'
import SettingsDrawer from '#/components/SettingsDrawer'

const NAV_ITEMS = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/intake', label: 'Intake' },
  { to: '/cycles', label: 'Cycles' },
] as const

const navLinkBase =
  'inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium sm:px-2.5'

export default function Header() {
  const { data: session, isPending } = useSession()
  // Telegram mode: slim the header, no marketing CTAs.
  const tgMode = useTelegramMode()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const gearRef = useRef<HTMLButtonElement>(null)

  const user = session?.user

  return (
    <>
      <header
        className={`sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur ${
          tgMode ? 'min-h-14' : 'h-14'
        }`}
        style={tgMode ? { paddingTop: 'var(--tg-safe-top, 0px)' } : undefined}
      >
        <div className="mx-auto flex h-full max-w-5xl items-center gap-2 px-3 sm:gap-3 sm:px-4">
          <Link
            to="/"
            aria-label="physlane home"
            className="shrink-0 text-base font-semibold tracking-tight text-text no-underline"
          >
            phys<span className="text-accent">lane</span>
          </Link>

          <nav aria-label="App" className="ml-auto flex items-center gap-0.5 sm:gap-1">
            {isPending ? null : user ? (
              <>
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={navLinkBase}
                    activeProps={{ className: 'text-accent' }}
                    inactiveProps={{ className: 'text-dim hover:text-text' }}
                  >
                    {item.label}
                  </Link>
                ))}
                {!tgMode && (
                  <Link
                    to="/billing"
                    className="hidden min-h-11 items-center rounded-md px-2 text-sm font-medium sm:inline-flex sm:px-2.5"
                    activeProps={{ className: 'text-accent' }}
                    inactiveProps={{ className: 'text-dim hover:text-text' }}
                  >
                    Billing
                  </Link>
                )}
                <button
                  ref={gearRef}
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  aria-label="Settings"
                  aria-haspopup="dialog"
                  className="ml-1 inline-flex size-11 shrink-0 items-center justify-center rounded-md text-dim hover:text-text"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 18 18"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M2.5 5h13M2.5 9h13M2.5 13h13"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                    <circle cx="6.5" cy="5" r="1.75" fill="var(--color-bg)" />
                    <circle cx="12" cy="9" r="1.75" fill="var(--color-bg)" />
                    <circle cx="5" cy="13" r="1.75" fill="var(--color-bg)" />
                    <circle
                      cx="6.5"
                      cy="5"
                      r="1.75"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <circle
                      cx="12"
                      cy="9"
                      r="1.75"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <circle
                      cx="5"
                      cy="13"
                      r="1.75"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                  </svg>
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
      <SettingsDrawer
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false)
          gearRef.current?.focus()
        }}
      />
    </>
  )
}
