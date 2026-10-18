import type { ReactNode } from 'react'
import { Link } from '@tanstack/react-router'
import { useTelegramMode } from '#/lib/telegram-mode'
import '../../styles/landing.css'

export type LandingPageKey = 'home' | 'guide' | 'glp-1' | 'analytics' | 'tracking'

const NAV: { key: LandingPageKey; to: string; label: string }[] = [
  { key: 'guide', to: '/guide', label: 'Guide' },
  { key: 'glp-1', to: '/glp-1', label: 'GLP-1' },
  { key: 'analytics', to: '/analytics', label: 'Analytics' },
  { key: 'tracking', to: '/tracking', label: 'Tracking' },
]

/**
 * Variant C "Editorial" shell for the public pages: ruled header nav,
 * content wrap, ruled mono footer. The dark app chrome (Header/Footer in
 * __root) is skipped on these routes; the signed-in app keeps its own.
 * landing.css is imported here only, so it reaches public routes only.
 */
export default function LandingShell({
  current,
  children,
}: {
  current: LandingPageKey
  children: ReactNode
}) {
  const tgMode = useTelegramMode()
  return (
    <div className="lp">
      <header>
        <nav className="nav wrap" aria-label="Main">
          <Link
            className="brand"
            to="/"
            aria-current={current === 'home' ? 'page' : undefined}
          >
            physlane
          </Link>
          {NAV.map((item) => (
            <Link
              key={item.key}
              to={item.to}
              aria-current={current === item.key ? 'page' : undefined}
            >
              {item.label}
            </Link>
          ))}
          <Link className="cta" to={tgMode ? '/dashboard' : '/sign-in'}>
            Open the app
          </Link>
        </nav>
      </header>
      <main>{children}</main>
      <footer>
        <div className="wrap">
          <span>physlane</span>
          <Link to="/guide">GUIDE</Link>
          <Link to={tgMode ? '/dashboard' : '/sign-in'}>APP</Link>
          <span className="spacer">FREE WHILE BETA · NOT MEDICAL ADVICE</span>
        </div>
      </footer>
    </div>
  )
}
