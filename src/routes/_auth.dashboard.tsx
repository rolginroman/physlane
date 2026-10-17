import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useCallback, useMemo, useRef, useState } from 'react'
import { getActiveCycle, hasAnyCycle } from '#/server/cycles.fns'
import {
  latestMeasurement,
  listMeasurements,
  type MeasurementDTO,
} from '#/server/measurements.fns'
import { getViewer } from '#/lib/auth-guard.fns'
import MeasurementForm from '#/components/MeasurementForm'
import HistoryTable from '#/components/HistoryTable'
import { fmtLength, fmtWeight, kgToLb, type UnitSystem } from '#/lib/units'

export const Route = createFileRoute('/_auth/dashboard')({
  head: () => ({ meta: [{ title: 'Dashboard · physlane' }] }),
  beforeLoad: async () => {
    const any = await hasAnyCycle()
    if (!any) throw redirect({ to: '/onboarding' })
  },
  loader: async () => {
    const [entries, latest, cycle, viewer] = await Promise.all([
      listMeasurements(),
      latestMeasurement(),
      getActiveCycle(),
      getViewer(),
    ])
    const units: UnitSystem = viewer?.unitSystem ?? 'metric'
    return { entries, latest, cycle, units }
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

function DashboardPage() {
  const { entries, latest, cycle, units } = Route.useLoaderData()
  const [editing, setEditing] = useState<MeasurementDTO | null>(null)
  const formRef = useRef<HTMLDivElement>(null)

  const newestFirst = useMemo(() => [...entries].reverse(), [entries])
  const latestWeight = lastWhere(entries, (e) => e.weightKg != null)
  const latestWaist = lastWhere(entries, (e) => e.waistCm != null)
  const delta = delta7dKg(entries)

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
