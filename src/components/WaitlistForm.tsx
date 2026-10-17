import { useState } from 'react'
import { joinWaitlist } from '#/server/waitlist.fns'

type State =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'done'; again: boolean }
  | { kind: 'error'; reason: string }

/**
 * Landing email capture: one field, inline result, no page change.
 * Convert moment: accent submit, accent success line.
 */
export default function WaitlistForm({ source = 'landing' }: { source?: string }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<State>({ kind: 'idle' })

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (state.kind === 'busy') return
    setState({ kind: 'busy' })
    try {
      const res = await joinWaitlist({ data: { email, source } })
      if (res.status === 'joined' || res.status === 'already') {
        setState({ kind: 'done', again: res.status === 'already' })
      } else {
        setState({ kind: 'error', reason: res.reason })
      }
    } catch {
      setState({ kind: 'error', reason: 'Network hiccup. Try again in a minute.' })
    }
  }

  if (state.kind === 'done') {
    return (
      <p role="status" className="m-0 min-h-11 py-3 text-sm text-accent">
        {state.again
          ? 'That address is already on the list. Nothing else to do.'
          : 'On the list. You will get the walkthrough when the first cohort reports.'}
      </p>
    )
  }

  const busy = state.kind === 'busy'
  return (
    <form onSubmit={submit} className="m-0">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="waitlist-email" className="sr-only">
          Email address
        </label>
        <input
          id="waitlist-email"
          type="email"
          name="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (state.kind === 'error') setState({ kind: 'idle' })
          }}
          disabled={busy}
          className="input min-h-11 flex-1 sm:max-w-72"
        />
        <button type="submit" disabled={busy} className="btn-primary min-h-11 whitespace-nowrap">
          {busy ? 'Saving…' : 'Email me the walkthrough'}
        </button>
      </div>
      {state.kind === 'error' && (
        <p role="alert" className="field-error mt-2">
          {state.reason}
        </p>
      )}
      <p className="hint">One email when the founding cohort reports, then silence. Your address is never shared.</p>
    </form>
  )
}
