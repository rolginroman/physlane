import { useState } from 'react'
import { joinWaitlist } from '#/server/waitlist.fns'

type State =
  | { kind: 'idle' }
  | { kind: 'busy' }
  | { kind: 'done'; again: boolean }
  | { kind: 'error'; reason: string }

/**
 * Landing email capture: one field, inline result, no page change.
 * Editorial restyle only: the server fn and the state machine are untouched.
 * Renders inside the .lp namespace (landing.css), so it inherits the paper
 * and ink palette with red as the sole accent.
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
      <p role="status" className="wl-done">
        {state.again
          ? 'That address is already on the list. Nothing else to do.'
          : 'On the list. You will get the walkthrough when the first cohort reports.'}
      </p>
    )
  }

  const busy = state.kind === 'busy'
  return (
    <form onSubmit={submit}>
      <div className="wl">
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
        />
        <button type="submit" disabled={busy} className="btn btn-ink">
          {busy ? 'Saving…' : 'Email me the walkthrough'}
        </button>
      </div>
      {state.kind === 'error' && (
        <p role="alert" className="wl-error">
          {state.reason}
        </p>
      )}
      <p className="fine">Your address is never shared. One email, no follow-ups.</p>
    </form>
  )
}
