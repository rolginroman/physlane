/** Line icons shared by the public pages. currentColor, decorative. */

export function LogIcon() {
  return (
    <svg viewBox="0 0 44 44" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="4" y="4" width="36" height="36" rx="6" />
      <circle cx="22" cy="14" r="3" />
    </svg>
  )
}

export function LearnIcon() {
  return (
    <svg viewBox="0 0 44 44" fill="currentColor" aria-hidden="true">
      <rect x="6" y="24" width="7" height="14" rx="1" />
      <rect x="18" y="16" width="7" height="22" rx="1" />
      <rect x="30" y="6" width="7" height="32" rx="1" />
    </svg>
  )
}

export function AdjustIcon() {
  return (
    <svg viewBox="0 0 44 44" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M6 12h32M6 22h32M6 32h32" />
      <circle cx="28" cy="12" r="3.5" fill="var(--color-canvas)" />
      <circle cx="14" cy="22" r="3.5" fill="var(--color-canvas)" />
      <circle cx="24" cy="32" r="3.5" fill="var(--color-canvas)" />
    </svg>
  )
}

export function TrendIcon() {
  return (
    <svg viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M3 16c4-8 7 4 11-4s7 4 11-2" />
    </svg>
  )
}

/** Tape measure: case and a ticked strip. */
export function TapeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <circle cx="9" cy="11" r="6" />
      <circle cx="9" cy="11" r="1.6" />
      <path d="M9 17h12v-3h-6.5M17.5 14v1.5M20 14v1.5" />
    </svg>
  )
}

/** Open: arrow out of a window. */
export function OpenIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M14 4h6v6M20 4l-9 9" />
      <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  )
}
