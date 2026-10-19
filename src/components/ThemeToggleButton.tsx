import { useEffect, useSyncExternalStore } from 'react'
import {
  applyThemePreference,
  readThemePreference,
  resolveTheme,
  setThemePreference,
  subscribeThemePreference,
  type ThemePreference,
} from '#/lib/theme'

/**
 * One-click theme flip for the site header: switches to the opposite of the
 * currently resolved theme and persists it as an explicit preference.
 */
export default function ThemeToggleButton({ className = '' }: { className?: string }) {
  const preference = useSyncExternalStore(
    subscribeThemePreference,
    readThemePreference,
    () => 'system' as ThemePreference,
  )

  useEffect(() => {
    applyThemePreference(preference)
  }, [preference])

  return (
    <button
      type="button"
      className={className}
      aria-label="Switch theme"
      onClick={() => setThemePreference(resolveTheme(preference) === 'dark' ? 'light' : 'dark')}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
        <circle cx="12" cy="12" r="8" />
        <path d="M12 4a8 8 0 0 0 0 16z" fill="currentColor" />
      </svg>
    </button>
  )
}
