/** Pure waitlist email validation. No I/O, unit-tested. */

export type EmailCheck = { ok: true; email: string } | { ok: false; reason: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function checkEmail(raw: string): EmailCheck {
  const email = raw.trim().toLowerCase()
  if (email.length === 0) return { ok: false, reason: 'Enter your email address.' }
  if (email.length > 254) return { ok: false, reason: 'That address is too long.' }
  if (!EMAIL_RE.test(email))
    return { ok: false, reason: 'That does not look like an email address. Check the spelling.' }
  return { ok: true, email }
}
