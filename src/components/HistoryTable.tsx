import { Fragment, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { deleteMeasurement, type MeasurementDTO } from '#/server/measurements.fns'
import {
  FIELD_LABELS,
  cmToIn,
  fmtLength,
  formatGirthDelta,
  formatWeightDelta,
  kgToLb,
  type MeasurementField,
  type UnitSystem,
} from '#/lib/units'

const DETAIL_FIELDS = [
  'neckCm',
  'chestCm',
  'hipsCm',
  'armLeftCm',
  'armRightCm',
  'thighLeftCm',
  'thighRightCm',
  'calfCm',
] as const satisfies readonly MeasurementField[]

const CURRENT_YEAR = new Date().getUTCFullYear()
const fullDate = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})
const shortDate = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})

/** Deterministic (UTC, fixed locale) so SSR and client render the same string. */
function fmtDate(iso: string): string {
  const d = new Date(iso)
  return d.getUTCFullYear() === CURRENT_YEAR ? shortDate.format(d) : fullDate.format(d)
}

type Props = {
  entries: MeasurementDTO[] // newest first
  units: UnitSystem
  onEdit: (entry: MeasurementDTO) => void
}

/** Dim signed delta vs the previous (older) row. Empty string when not computable. */
function deltaVs(
  entry: MeasurementDTO,
  prev: MeasurementDTO | undefined,
  field: MeasurementField,
  units: UnitSystem,
): string {
  if (!prev) return ''
  const cur = entry[field]
  const old = prev[field]
  if (cur == null || old == null) return ''
  const d = (cur as number) - (old as number)
  return field === 'weightKg' ? formatWeightDelta(d, units) : formatGirthDelta(d, units)
}

function Delta({ value }: { value: string }) {
  if (!value) return null
  return <span className="ml-1.5 whitespace-nowrap text-[0.6875rem] text-dim">{value}</span>
}

export default function HistoryTable({ entries, units, onEdit }: Props) {
  const router = useRouter()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete(id: string) {
    setDeleting(true)
    try {
      await deleteMeasurement({ data: { id } })
      await router.invalidate()
      setConfirming(null)
    } finally {
      setDeleting(false)
    }
  }

  if (entries.length === 0) {
    return (
      <div className="card mt-4 px-4 py-10 text-center">
        <p className="m-0 text-sm text-dim">
          No measurements yet. Log your first weigh-in above.
        </p>
      </div>
    )
  }

  const weightUnit = units === 'metric' ? 'kg' : 'lb'
  const lengthUnit = units === 'metric' ? 'cm' : 'in'

  return (
    <div className="card mt-4 overflow-hidden">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line text-left text-xs text-dim">
            <th scope="col" className="px-3 py-2 font-medium">
              Date
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Weight ({weightUnit})
            </th>
            <th scope="col" className="px-3 py-2 font-medium">
              Waist ({lengthUnit})
            </th>
            <th scope="col" className="px-2 py-2 text-right font-medium">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry, index) => {
            const prev = entries[index + 1]
            if (confirming === entry.id) {
              return (
                <tr key={entry.id} className="border-b border-line bg-rose/5">
                  <td colSpan={4} className="px-3 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="m-0 text-sm text-text">Delete this entry?</p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleDelete(entry.id)}
                          disabled={deleting}
                          className="inline-flex min-h-11 items-center rounded-lg border border-rose/60 bg-rose/15 px-4 text-sm font-medium text-rose hover:bg-rose/25"
                        >
                          {deleting ? 'Deleting…' : 'Delete'}
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirming(null)}
                          disabled={deleting}
                          className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm font-medium text-dim hover:text-text"
                        >
                          Keep
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              )
            }

            const hasDetail =
              DETAIL_FIELDS.some((f) => entry[f] != null) || Boolean(entry.notes?.trim())
            const isOpen = expanded === entry.id

            return (
              <Fragment key={entry.id}>
                <tr className="border-b border-line">
                  <td className="h-10 whitespace-nowrap px-3 text-xs text-dim">
                    {fmtDate(entry.takenAt)}
                  </td>
                  <td className="num h-10 whitespace-nowrap px-3">
                    {entry.weightKg != null
                      ? units === 'metric'
                        ? entry.weightKg.toFixed(1)
                        : kgToLb(entry.weightKg).toFixed(1)
                      : '—'}
                    <Delta value={deltaVs(entry, prev, 'weightKg', units)} />
                  </td>
                  <td className="num h-10 whitespace-nowrap px-3">
                    {entry.waistCm != null
                      ? units === 'metric'
                        ? entry.waistCm.toFixed(1)
                        : cmToIn(entry.waistCm).toFixed(1)
                      : '—'}
                    <Delta value={deltaVs(entry, prev, 'waistCm', units)} />
                  </td>
                  <td className="h-10 whitespace-nowrap px-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {hasDetail && (
                        <button
                          type="button"
                          onClick={() => setExpanded(isOpen ? null : entry.id)}
                          aria-expanded={isOpen}
                          aria-label={isOpen ? 'Hide extra fields' : 'Show extra fields'}
                          className="inline-flex min-h-11 -my-1 items-center rounded-md px-2 text-dim hover:text-text"
                        >
                          <svg
                            viewBox="0 0 16 16"
                            aria-hidden="true"
                            className={`h-3.5 w-3.5 transition-transform duration-200 ease-out ${isOpen ? 'rotate-90' : ''}`}
                          >
                            <path
                              d="M6 4l4 4-4 4"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => onEdit(entry)}
                        className="inline-flex min-h-11 -my-1 items-center rounded-md px-2 text-xs font-medium text-dim hover:text-text"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirming(entry.id)}
                        className="inline-flex min-h-11 -my-1 items-center rounded-md px-2 text-xs font-medium text-dim hover:text-rose"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
                {isOpen && (
                  <tr className="border-b border-line bg-surface2/40">
                    <td colSpan={4} className="px-3 py-3">
                      <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
                        {DETAIL_FIELDS.filter((f) => entry[f] != null).map((f) => (
                          <div key={f}>
                            <dt className="text-xs text-dim">{FIELD_LABELS[f]}</dt>
                            <dd className="num m-0 text-sm">
                              {fmtLength(entry[f] as number, units)}
                              <Delta value={deltaVs(entry, prev, f, units)} />
                            </dd>
                          </div>
                        ))}
                      </dl>
                      {entry.notes && (
                        <p className="m-0 mt-2 text-sm text-dim">Notes: {entry.notes}</p>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
