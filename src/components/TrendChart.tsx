import { useEffect, useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from 'recharts'
import type { MeasurementDTO } from '#/server/measurements.fns'
import type { CycleDTO } from '#/server/cycles.fns'
import { fmtWeight, kgToLb, type UnitSystem } from '#/lib/units'

const DAY_MS = 86_400_000
const WEEK_MS = 7 * DAY_MS

const WEIGHT_COLOR = '#60a5fa'
const TARGET_COLOR = '#5b6475'
const GRID_COLOR = '#232936'
const AXIS_TICK_COLOR = '#8b94a7'

type RangeId = '14d' | '30d' | '90d' | 'all'

const RANGES: { id: RangeId; label: string; days: number | null; aria: string }[] = [
  { id: '14d', label: '14d', days: 14, aria: 'last 14 days' },
  { id: '30d', label: '30d', days: 30, aria: 'last 30 days' },
  { id: '90d', label: '90d', days: 90, aria: 'last 90 days' },
  { id: 'all', label: 'All', days: null, aria: 'all time' },
]

/** Deterministic (UTC, fixed locale) so SSR and client render the same string. */
const dayMonth = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})
const fmtDay = (ms: number) => dayMonth.format(new Date(ms))

type Row = { t: number; kg: number | null; target: number | null }

type Props = {
  entries: MeasurementDTO[] // oldest first
  cycle: CycleDTO | null
  units: UnitSystem
  plan: 'free' | 'pro'
}

export default function TrendChart({ entries, cycle, units, plan }: Props) {
  const [rangeId, setRangeId] = useState<RangeId>('30d')
  const [mounted, setMounted] = useState(false)
  const [animate, setAnimate] = useState(true)

  useEffect(() => {
    setMounted(true)
    setAnimate(!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  }, [])

  const range = RANGES.find((r) => r.id === rangeId) ?? RANGES[1]

  const { rows, showTarget, targetAt, weightPts } = useMemo(() => {
    const weights = entries
      .filter((e) => e.weightKg != null)
      .map((e) => ({ t: new Date(e.takenAt).getTime(), kg: e.weightKg as number }))

    const now = Date.now()
    const cutoff = range.days != null ? now - range.days * DAY_MS : -Infinity
    const inRange = weights.filter((p) => p.t >= cutoff)

    // Target projection: y(t) = start + rate * (t - cycleStart) / week.
    const startKg = cycle?.startWeightKg
    const rate = cycle?.targetRateKgPerWeek
    const cycleStart =
      cycle?.startDate != null ? new Date(cycle.startDate).getTime() : null
    const canProject =
      startKg != null && rate != null && cycleStart != null && cycleStart <= now
    const targetAt = canProject
      ? (t: number) => (startKg as number) + ((rate as number) * (t - (cycleStart as number))) / WEEK_MS
      : null

    const dataEnd = Math.max(now, ...inRange.map((p) => p.t))
    const dataStart = Math.min(now, ...inRange.map((p) => p.t))
    const t0 = canProject ? Math.max(cycleStart as number, cutoff, dataStart) : null
    const t1 = canProject ? dataEnd : null
    const showTarget = canProject && t0 != null && t1 != null && t0 < t1

    const rows: Row[] = inRange.map((p) => ({ t: p.t, kg: p.kg, target: null }))
    if (showTarget && t0 != null && t1 != null && targetAt) {
      rows.push({ t: t0, kg: null, target: targetAt(t0) })
      rows.push({ t: t1, kg: null, target: targetAt(t1) })
      rows.sort((a, b) => a.t - b.t)
    }

    return { rows, showTarget, targetAt, weightPts: inRange }
  }, [entries, cycle, range.days])

  const kgValues = rows.filter((r) => r.kg != null).map((r) => r.kg as number)

  // Chart geometry (stable across renders; explicit domains keep dots unclipped).
  const { xDomain, yDomain } = useMemo(() => {
    if (rows.length === 0) return { xDomain: [0, 1] as [number, number], yDomain: [0, 1] as [number, number] }
    const ts = rows.map((r) => r.t)
    let tMin = Math.min(...ts)
    let tMax = Math.max(...ts)
    if (tMax - tMin < DAY_MS) {
      const mid = (tMin + tMax) / 2
      tMin = mid - DAY_MS / 2
      tMax = mid + DAY_MS / 2
    }
    const xPad = (tMax - tMin) * 0.03

    const vals = rows.filter((r) => r.target != null).map((r) => r.target as number).concat(kgValues)
    let yMin = Math.min(...vals)
    let yMax = Math.max(...vals)
    if (yMax - yMin < 0.5) {
      const mid = (yMin + yMax) / 2
      yMin = mid - 1
      yMax = mid + 1
    }
    const yPad = (yMax - yMin) * 0.12
    return {
      xDomain: [tMin - xPad, tMax + xPad] as [number, number],
      yDomain: [yMin - yPad, yMax + yPad] as [number, number],
    }
  }, [rows, kgValues])

  const summary = useMemo(() => {
    if (kgValues.length < 2) return `Weight trend, ${range.aria}`
    return `Weight trend, ${range.aria}, ${fmtWeight(Math.min(...kgValues), units)} to ${fmtWeight(Math.max(...kgValues), units)}`
  }, [kgValues, range.aria, units])

  const yTick = (v: number) => (units === 'metric' ? v : kgToLb(v)).toFixed(1)

  return (
    <div className="card mt-4 p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="m-0 text-sm font-semibold">Trend</h2>
        <p className="m-0 flex items-center gap-3 text-xs text-dim">
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="inline-block h-0.5 w-4 rounded-full" style={{ background: WEIGHT_COLOR }} />
            Weight
          </span>
          {showTarget && (
            <span className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block w-4 border-t-2 border-dashed"
                style={{ borderColor: TARGET_COLOR }}
              />
              Target
            </span>
          )}
        </p>
        <div
          role="group"
          aria-label="Trend range"
          className="ml-auto inline-flex items-center gap-1 rounded-full border border-line bg-surface p-1"
        >
          {RANGES.map((r) => {
            const active = r.id === rangeId
            return (
              <button
                key={r.id}
                type="button"
                aria-pressed={active}
                onClick={() => setRangeId(r.id)}
                className={`relative inline-flex h-9 items-center rounded-full px-3 text-xs font-medium transition-colors duration-150 ease-out after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] ${
                  active ? 'bg-surface2 text-text' : 'text-dim hover:text-text'
                }`}
              >
                {r.label}
              </button>
            )
          })}
        </div>
      </div>

      {/*
       * F12: the free plan's history is server-clamped to 90 days, so "All"
       * silently shows the same window as 90d for free users. Say why, and
       * where the full history lives, next to the chart where value is proven.
       */}
      {plan === 'free' && rangeId === 'all' && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-line bg-surface2 px-3 py-1">
          <p className="m-0 text-xs text-dim">
            Free plan sees the last 90 days here. Pro unlocks the full history.
          </p>
          <Link
            to="/billing"
            className="inline-flex min-h-11 items-center rounded-md px-1 text-sm font-medium text-accent hover:text-accent-dim"
          >
            Upgrade
          </Link>
        </div>
      )}

      <div className="mt-3" role="img" aria-label={summary} style={{ height: 260 }}>
        {!mounted ? null : kgValues.length < 2 ? (
          <div className="flex h-full items-center justify-center px-4 text-center">
            <p className="m-0 text-sm text-dim">Not enough data yet. Log weigh-ins to build your trend.</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke={GRID_COLOR} />
              <XAxis
                dataKey="t"
                type="number"
                domain={xDomain}
                tickFormatter={fmtDay}
                tick={{ fill: AXIS_TICK_COLOR, fontSize: 11 }}
                axisLine={{ stroke: GRID_COLOR }}
                tickLine={false}
                minTickGap={28}
              />
              <YAxis
                domain={yDomain}
                tickFormatter={yTick}
                tick={{ fill: AXIS_TICK_COLOR, fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={44}
              />
              <Tooltip
                cursor={{ stroke: '#2e3646', strokeDasharray: '3 3' }}
                isAnimationActive={false}
                content={(tip) => (
                  <TrendTip tip={tip} units={units} targetAt={targetAt} weightPts={weightPts} />
                )}
              />
              <Area
                dataKey="kg"
                stroke="none"
                fill={WEIGHT_COLOR}
                fillOpacity={0.08}
                isAnimationActive={false}
                dot={false}
                activeDot={false}
                connectNulls
                legendType="none"
              />
              <Line
                dataKey="kg"
                stroke={WEIGHT_COLOR}
                strokeWidth={2}
                dot={{ r: 2, fill: WEIGHT_COLOR, strokeWidth: 0 }}
                activeDot={{ r: 4, fill: WEIGHT_COLOR, strokeWidth: 0 }}
                connectNulls
                isAnimationActive={animate}
                animationDuration={200}
                legendType="none"
              />
              {showTarget && (
                <Line
                  dataKey="target"
                  stroke={TARGET_COLOR}
                  strokeWidth={1.5}
                  strokeDasharray="6 4"
                  dot={false}
                  activeDot={false}
                  connectNulls
                  isAnimationActive={false}
                  legendType="none"
                />
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

function TrendTip({
  tip,
  units,
  targetAt,
  weightPts,
}: {
  tip: TooltipContentProps
  units: UnitSystem
  targetAt: ((t: number) => number) | null
  weightPts: { t: number; kg: number }[]
}) {
  if (!tip.active || weightPts.length === 0) return null
  const activeRow = tip.payload?.find((p) => p.payload?.kg != null)?.payload as
    | { t: number; kg: number }
    | undefined
  // Hover can land on a target-only row (e.g. beyond the last weigh-in);
  // show the nearest weigh-in instead of nothing.
  const point =
    activeRow ??
    (weightPts.length === 1
      ? weightPts[0]
      : weightPts.reduce((best, p) =>
          Math.abs(p.t - (tip.label as number)) < Math.abs(best.t - (tip.label as number)) ? p : best,
        ))
  if (!point) return null
  const target = targetAt?.(point.t)
  return (
    <div className="rounded-lg border border-line bg-surface2 px-3 py-2 text-xs">
      <p className="m-0 text-dim">{fmtDay(point.t)}</p>
      <p className="num m-0 mt-1">{fmtWeight(point.kg, units)}</p>
      {targetAt && target != null && (
        <p className="num m-0 mt-0.5 text-dim">
          <span className="mr-1.5 inline-block w-3 border-t-2 border-dashed align-middle" style={{ borderColor: TARGET_COLOR }} aria-hidden="true" />
          {fmtWeight(target, units)}
        </p>
      )}
    </div>
  )
}
