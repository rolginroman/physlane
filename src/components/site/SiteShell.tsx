import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { useTelegramMode } from '#/lib/telegram-mode'
import ThemeSwitch from '#/components/ThemeSwitch'
import ThemeToggleButton from '#/components/ThemeToggleButton'
import '../../styles/site.css'

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <>
      <Link to="/" hash="method" activeOptions={{ exact: true, includeHash: true }} onClick={onNavigate}>
        Method
      </Link>
      <Link to="/analytics" onClick={onNavigate}>
        Analytics
      </Link>
      <Link to="/blog" onClick={onNavigate}>
        Blog
      </Link>
      <Link to="/glp-1" onClick={onNavigate}>
        GLP-1
      </Link>
      <Link to="/" hash="pricing" activeOptions={{ exact: true, includeHash: true }} onClick={onNavigate}>
        Pricing
      </Link>
    </>
  )
}

export function Arrow() {
  return (
    <svg className="arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

/**
 * v2 public-site shell (DESIGN.md v2): wordmark header with nav, theme
 * toggle, app access and a mobile menu disclosure; footer with the theme
 * switch. site.css is imported here only, so it reaches public routes only.
 */
export default function SiteShell({ children }: { children: ReactNode }) {
  const tgMode = useTelegramMode()
  const appHref = tgMode ? '/dashboard' : '/sign-in'
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButton = useRef<HTMLButtonElement>(null)
  const href = useRouterState({ select: (s) => s.location.href })

  useEffect(() => setMenuOpen(false), [href])

  useEffect(() => {
    if (!menuOpen) return undefined
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setMenuOpen(false)
      menuButton.current?.focus()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [menuOpen])

  const closeMenu = () => setMenuOpen(false)

  return (
    <div className="site">
      <header>
        <div className="wrap nav">
          <Link className="wordmark" to="/" activeOptions={{ exact: true }}>
            physlane
          </Link>
          <nav className="nav-links" aria-label="Primary">
            <NavLinks />
          </nav>
          <div className="nav-end">
            <ThemeToggleButton className="icon-btn" />
            <Link className="link login" to="/sign-in" style={{ border: 0 }}>
              Log in
            </Link>
            <Link className="btn btn-ink" to={appHref}>
              Open app <Arrow />
            </Link>
            <button
              ref={menuButton}
              className="icon-btn menu-btn"
              type="button"
              aria-label="Menu"
              aria-expanded={menuOpen}
              aria-controls="site-menu"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
          </div>
        </div>
        <nav id="site-menu" className="menu-panel" aria-label="Menu" hidden={!menuOpen}>
          <NavLinks onNavigate={closeMenu} />
          <Link to="/sign-in" onClick={closeMenu}>
            Log in
          </Link>
          <Link className="btn btn-ink" to={appHref} onClick={closeMenu}>
            Open app <Arrow />
          </Link>
        </nav>
      </header>

      <main>{children}</main>

      <footer>
        <div className="wrap">
          <p className="site-label tagline">Simple inputs. Real insights. Built on your data.</p>
          <div className="foot">
            <div className="foot-start">
              <span className="caption">physlane · Estimates, not medical advice.</span>
              <nav className="foot-links" aria-label="Footer">
                <Link to="/guide">Guide</Link>
                <Link to="/tracking">Tracking</Link>
              </nav>
            </div>
            <ThemeSwitch variant="segmented" />
          </div>
        </div>
      </footer>
    </div>
  )
}
