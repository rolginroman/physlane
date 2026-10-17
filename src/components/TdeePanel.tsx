import { useState } from 'react'
import { Link, useRouter } from '@tanstack/react-router'
import { saveSettings } from '#/lib/auth-guard.fns'
import { leanMassStatus } from '#/lib/lean-mass'
import { fmtKcal, tdeeEnergyCopy } from '#/lib/adherence'
import type { TdeeStatusResult } from '#/server/intake.fns'
import type { MeasurementDTO } from '#/server/measurements.fns'

type Props = {
  status: TdeeStatusResult
  streak: number
  plan: 'free' | 'pro'
  onGlp1: boolean
  targetKcalPerDay: number | null
  entries: MeasurementDTO[]
}

/** Shared streak chip: accent only once the habit milestone (7 days) is hit. */
export function StreakChip({ streak }: { streak: number }) {
  return (
    <span
      className={`num inline-flex min-h-8 items-center rounded-full border px-2.5 text-xs ${
        streak >= 7 ? 'border-accent/60 text-accent' : 'border-line text-dim'
      }`}
    >
      {streak > 0 ? `${streak}-day streak` : 'No streak yet'}
    </span>
  )
}

/** 44px-hit switch (visual track 24px, padded hit area via ::before). */
function Switch({
  checked,
  disabled,
  onToggle,
  label,
}: {
  checked: boolean
  disabled: boolean
  onToggle: () => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-150 ease-out before:absolute before:-inset-y-2.5 before:inset-x-0 before:content-[''] ${
        checked ? 'border-accent/60 bg-accent/15' : 'border-line bg-surface2'
      } ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
    >
      <span
        className={`ml-0.5 h-5 w-5 rounded-full transition-transform duration-150 ease-out ${
          checked ? 'translate-x-5 bg-accent' : 'translate-x-0 bg-dim'
        }`}
      />
    </button>
  )
}

function Glp1Row({ plan, onGlp1 }: { plan: 'free' | 'pro'; onGlp1: boolean }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function toggle() {
    if (plan !== 'pro' || pending) return
    setPending(true)
    try {
      await saveSettings({ data: { onGlp1: !onGlp1 } })
      await router.invalidate()
    } catch {
      // Settings write failed; the switch reflects the server state after reload.
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="mt-4 flex items-center gap-3 border-t border-line pt-3">
      <div className="min-w-0 flex-1">
        <p className="m-0 text-sm font-medium text-text">
          GLP-1 mode
          {plan !== 'pro' && (
            <span className="ml-2 rounded border border-line px-1 py-0.5 text-[0.6875rem] font-semibold tracking-wide text-dim">
              PRO
            </span>
          )}
        </p>
        <p className="m-0 mt-0.5 text-xs text-dim">
          Swaps deficit targets for protein-first guidance and lean-mass watch.
        </p>
      </div>
      {plan === 'pro' ? (
        <Switch checked={onGlp1} disabled={pending} onToggle={toggle} label="GLP-1 mode" />
      ) : (
        <Link
          to="/billing"
          className="inline-flex min-h-11 items-center rounded-md px-2.5 text-sm font-medium text-accent hover:text-accent-dim"
        >
          Upgrade
        </Link>
      )}
    </div>
  )
}

export default function TdeePanel({ status, streak, plan, onGlp1, targetKcalPerDay, entries }: Props) {
  const risk = leanMassStatus(entries)
  const energy = tdeeEnergyCopy({
    tdeeKcal: status.status === 'ready' ? (status.kcal ?? 0) : 0,
    targetKcalPerDay,
    onGlp1,
  })
  const wRate = risk.rates.weightKgPerWeek ?? 0

	return (
		<section className="card mt-4 p-4 sm:p-5" aria-label="Adaptive TDEE">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<h2 className="m-0 text-base font-semibold">Adaptive TDEE</h2>
				<StreakChip streak={streak} />
			</div>

			{status.status === 'collecting' && (
				<div className="mt-3">
					<div
						role="progressbar"
						aria-valuemin={0}
						aria-valuemax={status.needed}
						aria-valuenow={status.pairs}
						aria-label="Days of paired weight and intake data"
						className="h-1.5 w-full overflow-hidden rounded-full bg-surface2"
					>
						<div
							className="h-full rounded-full bg-accent"
							style={{ width: `${Math.max(4, Math.round((status.pairs / status.needed) * 100))}%` }}
						/>
					</div>
					<p className="num m-0 mt-2 text-sm text-text">
						Collecting data: {status.pairs} of {status.needed} days
					</p>
					<p className="m-0 mt-1 text-xs text-dim">
						Log intake and a same-day weight. The estimate builds from your own series, not a formula.
					</p>
				</div>
			)}

			{status.status === 'ready' && status.gated && (
				<div className="mt-3">
					<p className="m-0 text-sm font-medium text-text">Your burn-rate estimate is ready.</p>
					<p className="m-0 mt-1 text-sm text-dim">
						Built from {status.pairs} days of your own weight + intake pairs.
					</p>
					<Link to="/billing" className="btn-primary mt-3 no-underline">
						Unlock with Pro
					</Link>
					<p className="hint">Pro reveals the number, its spread, and how it moves week to week. $10/mo or $100/yr.</p>
				</div>
			)}

			{status.status === 'ready' && !status.gated && status.kcal != null && (
				<div className="mt-3">
					<div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
						<span className="num text-3xl font-semibold tracking-tight">{fmtKcal(status.kcal)}</span>
						<span className="text-sm text-dim">kcal per day</span>
						{status.spreadKcal != null && status.spreadKcal > 0 && (
							<span className="num text-sm text-dim">± {fmtKcal(status.spreadKcal)}</span>
						)}
					</div>
					<p className="m-0 mt-1.5 text-xs text-faint">
						Adaptive estimate from your last {status.pairs} days of same-day weight + intake. Smoothed
						weekly; the spread is half the range of the last 3 weeks.
					</p>
					{energy && (
						<div className="mt-3">
							<p className="m-0 text-sm text-text">{energy.headline}</p>
							{energy.body && <p className="m-0 mt-1 text-sm text-dim">{energy.body}</p>}
						</div>
					)}
					{onGlp1 && risk.atRisk && (
						<div role="status" className="mt-3 rounded-lg border border-rose/50 bg-rose/5 px-3 py-2.5">
							<p className="num m-0 text-sm text-rose">
								Losing {Math.abs(wRate).toFixed(1)} kg per week with a near-flat waist.
							</p>
							<p className="m-0 mt-1 text-xs text-dim">
								That pattern can mean muscle loss. Keep protein high and consider slowing the rate.
								Heuristic, not medical advice.
							</p>
						</div>
					)}
				</div>
			)}

			<Glp1Row plan={plan} onGlp1={onGlp1} />
		</section>
	)
}
