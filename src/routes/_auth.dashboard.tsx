import { createFileRoute, Link, redirect, useRouter } from '@tanstack/react-router'
import { useCallback, useMemo, useRef, useState } from 'react'
import { getActiveCycle, hasAnyCycle } from '#/server/cycles.fns'
import {
  latestMeasurement,
  listMeasurements,
  type MeasurementDTO,
} from '#/server/measurements.fns'
import { getIntakeStreak, tdeeStatus } from '#/server/intake.fns'
import { getViewer, saveSettings } from '#/lib/auth-guard.fns'
import { navyBodyFat } from '#/lib/navy-bf'
import MeasurementForm from '#/components/MeasurementForm'
import HistoryTable from '#/components/HistoryTable'
import TrendChart from '#/components/TrendChart'
import TdeePanel from '#/components/TdeePanel'
import { fmtLength, fmtWeight, kgToLb, type UnitSystem } from '#/lib/units'

export const Route = createFileRoute('/_auth/dashboard')({
  head: () => ({ meta: [{ title: 'Dashboard · physlane' }] }),
  beforeLoad: async () => {
    const any = await hasAnyCycle()
    if (!any) throw redirect({ to: '/onboarding' })
  },
  loader: async () => {
    const [entries, latest, cycle, viewer, tdee, streak] = await Promise.all([
      listMeasurements(),
      latestMeasurement(),
      getActiveCycle(),
      getViewer(),
      tdeeStatus(),
      getIntakeStreak(),
    ])
    const units: UnitSystem = viewer?.unitSystem ?? 'metric'
    const heightCm = viewer?.heightCm ?? null
    const sex = viewer?.sex ?? null
    return {
      entries,
      latest,
      cycle,
      units,
      tdee,
      streak: streak.streak,
      plan: viewer?.plan ?? 'free',
      onGlp1: viewer?.onGlp1 ?? false,
      heightCm,
      sex,
    }
  },
  component: DashboardPage,
})

const WEEK_MS = 7 * 86_400_000

function lastWhere(entries: MeasurementDTO[], pred: (e: MeasurementDTO) => boolean) {
  for (let i = entries.length - 1; i >= 0; i--) {
    if (pred(entries[i])) return entries[i]
  }
  return null
}

/** Latest weight minus the newest weight at least 7 days older. Null when there is no pair. */
function delta7dKg(entries: MeasurementDTO[]): number | null {
  const cur = lastWhere(entries, (e) => e.weightKg != null)
  if (!cur || cur.weightKg == null) return null
  const cutoff = new Date(cur.takenAt).getTime() - WEEK_MS
  const ref = lastWhere(
    entries,
    (e) => e.weightKg != null && new Date(e.takenAt).getTime() <= cutoff,
  )
  if (!ref || ref.weightKg == null) return null
  return cur.weightKg - ref.weightKg
}

const SIGN = { minus: '−' as const, plus: '+' as const }

function fmtSignedWeight(kg: number | null, units: UnitSystem): string {
  if (kg == null) return '—'
  const v = units === 'metric' ? kg : kgToLb(kg)
  const sign = v > 0 ? SIGN.plus : v < 0 ? SIGN.minus : ''
  return `${sign}${Math.abs(v).toFixed(1)} ${units === 'metric' ? 'kg' : 'lb'}`
}

function fmtSignedRate(kgPerWeek: number): string {
  const sign = kgPerWeek > 0 ? SIGN.plus : kgPerWeek < 0 ? SIGN.minus : ''
  return `${sign}${parseFloat(Math.abs(kgPerWeek).toFixed(2))} kg/wk`
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 bg-surface px-4 py-3">
      <p className="m-0 text-xs text-dim">{label}</p>
      <p className="num m-0 mt-1 truncate text-base font-medium">{value}</p>
    </div>
  )
}

/** Metric/imperial segmented control. Persists via settings, then invalidates so every formatted number flips. */
function UnitToggle({ units }: { units: UnitSystem }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  async function pick(next: UnitSystem) {
    if (next === units || pending) return
    setPending(true)
    try {
      await saveSettings({ data: { unitSystem: next } })
      await router.invalidate()
    } catch {
      // Stays on the current units; tapping again retries.
    } finally {
      setPending(false)
    }
  }

  const options: { id: UnitSystem; label: string }[] = [
    { id: 'metric', label: 'kg' },
    { id: 'imperial', label: 'lb' },
  ]
  return (
    <div
      role="group"
      aria-label="Units"
      className="inline-flex items-center gap-0.5 rounded-full border border-line bg-surface p-0.5"
    >
      {options.map((o) => {
        const active = units === o.id
        return (
          <button
            key={o.id}
            type="button"
            aria-pressed={active}
            disabled={pending}
            onClick={() => pick(o.id)}
            className={`relative inline-flex h-9 items-center rounded-full px-3 text-xs font-medium transition-colors duration-150 ease-out after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] ${
              active ? 'bg-surface2 text-text' : 'text-dim hover:text-text'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

function DashboardPage() {
  const { entries, latest, cycle, units, tdee, streak, plan, onGlp1, heightCm, sex } =
    Route.useLoaderData()
  const [editing, setEditing] = useState<MeasurementDTO | null>(null)
  const formRef = useRef<HTMLDivElement>(null)

  const newestFirst = useMemo(() => [...entries].reverse(), [entries])
  const latestWeight = lastWhere(entries, (e) => e.weightKg != null)
  const latestWaist = lastWhere(entries, (e) => e.waistCm != null)
  const delta = delta7dKg(entries)

  // Navy estimate from the LATEST entry only: no cherry-picking older sites.
  // navyBodyFat returns null for missing sex/height/sites — chip never renders then.
  const bodyFat = useMemo(
    () =>
      latest && heightCm != null
        ? navyBodyFat({
            sex,
            heightCm,
            neckCm: latest.neckCm,
            waistCm: latest.waistCm,
            hipsCm: latest.hipsCm,
          })
        : null,
    [latest, heightCm, sex],
  )

  const handleEdit = useCallback((entry: MeasurementDTO) => {
    setEditing(entry)
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    formRef.current?.scrollIntoView({
      behavior: prefersReduced ? 'auto' : 'smooth',
      block: 'start',
    })
  }, [])

  return (
    <section className="pt-8">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="m-0 text-xl font-semibold tracking-tight">Dashboard</h1>
        {cycle ? (
          <span className="inline-flex min-h-8 flex-wrap items-center gap-2 rounded-full border border-line bg-surface px-2 py-1 text-xs text-dim">
            <span className="rounded border border-accent px-1.5 py-0.5 text-[0.6875rem] font-semibold tracking-wide text-accent">
              {cycle.phase.toUpperCase()}
            </span>
            {cycle.targetRateKgPerWeek != null && (
              <span className="num">{fmtSignedRate(cycle.targetRateKgPerWeek)}</span>
            )}
            {cycle.kcalTargetPerDay != null && (
              <>
                <span aria-hidden="true">·</span>
                <span className="num">{cycle.kcalTargetPerDay} kcal</span>
              </>
            )}
          </span>
        ) : (
          <span className="inline-flex min-h-8 items-center rounded-full border border-line bg-surface px-3 py-1 text-xs text-dim">
            No active cycle
          </span>
        )}
        <UnitToggle units={units} />
        <Link
          to="/cycles"
          className="ml-auto inline-flex min-h-11 items-center rounded-md px-2.5 text-sm font-medium text-dim hover:text-text"
        >
          Cycles
        </Link>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
        <Stat
          label="Latest weight"
          value={fmtWeight(latestWeight?.weightKg ?? null, units)}
        />
        <Stat label="Δ 7d" value={fmtSignedWeight(delta, units)} />
        <Stat label="Latest waist" value={fmtLength(latestWaist?.waistCm ?? null, units)} />
        <Stat label="Measurements" value={String(entries.length)} />
      </div>

      <TdeePanel
        status={tdee}
        streak={streak}
        plan={plan}
        onGlp1={onGlp1}
        targetKcalPerDay={cycle?.kcalTargetPerDay ?? null}
        entries={entries}
        units={units}
      />

      <TrendChart
        entries={entries}
        cycle={cycle}
        units={units}
        plan={plan}
        bodyFatPercent={bodyFat?.bfPercent ?? null}
      />

      <div ref={formRef} className="mt-4 scroll-mt-20">
        <MeasurementForm
          units={units}
          editing={editing}
          onEditDone={() => setEditing(null)}
          lastWeightKg={latest?.weightKg ?? null}
        />
      </div>

      <HistoryTable entries={newestFirst} units={units} onEdit={handleEdit} />

      <p className="mt-6 mb-0 text-xs text-faint">
        Only manual numbers are stored. No integrations, ever.
      </p>
    </section>
  )
}
