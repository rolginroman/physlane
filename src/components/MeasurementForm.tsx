import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useRouter } from '@tanstack/react-router'
import { saveMeasurement, type MeasurementDTO } from '#/server/measurements.fns'
import {
  FIELD_LABELS,
  lengthFromInput,
  lengthToInput,
  weightFromInput,
  weightToInput,
  type MeasurementField,
  type UnitSystem,
} from '#/lib/units'

type GirthField = Exclude<MeasurementField, 'weightKg' | 'waistCm'>

const GIRTH_FIELDS = [
  'neckCm',
  'chestCm',
  'hipsCm',
  'armLeftCm',
  'armRightCm',
  'thighLeftCm',
  'thighRightCm',
  'calfCm',
] as const satisfies readonly GirthField[]

const today = () => new Date().toISOString().slice(0, 10)

const emptyGirths = (): Record<GirthField, string> => ({
  neckCm: '',
  chestCm: '',
  hipsCm: '',
  armLeftCm: '',
  armRightCm: '',
  thighLeftCm: '',
  thighRightCm: '',
  calfCm: '',
})

type Props = {
  units: UnitSystem
  editing: MeasurementDTO | null
  onEditDone: () => void
  /** Fires after any successful save (used by the dashboard for Telegram feedback). */
  onSaved?: () => void
  lastWeightKg?: number | null
}

export default function MeasurementForm({ units, editing, onEditDone, onSaved, lastWeightKg }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(true)
  const [date, setDate] = useState(today)
  const [weight, setWeight] = useState('')
  const [waist, setWaist] = useState('')
  const [girths, setGirths] = useState<Record<GirthField, string>>(emptyGirths)
  const [notes, setNotes] = useState('')
  const [showMore, setShowMore] = useState(false)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [pending, setPending] = useState(false)
  const [saved, setSaved] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)
  const savedTimer = useRef<number | null>(null)

  const weightUnit = units === 'metric' ? 'kg' : 'lb'
  const lengthUnit = units === 'metric' ? 'cm' : 'in'

  // (Re)seed fields whenever edit target changes.
  useEffect(() => {
    setServerError(null)
    setTouched({})
    if (!editing) {
      setDate(today())
      setWeight('')
      setWaist('')
      setGirths(emptyGirths())
      setNotes('')
      setShowMore(false)
      return
    }
    setDate(editing.takenAt.slice(0, 10))
    setWeight(weightToInput(editing.weightKg, units))
    setWaist(lengthToInput(editing.waistCm, units))
    setGirths({
      neckCm: lengthToInput(editing.neckCm, units),
      chestCm: lengthToInput(editing.chestCm, units),
      hipsCm: lengthToInput(editing.hipsCm, units),
      armLeftCm: lengthToInput(editing.armLeftCm, units),
      armRightCm: lengthToInput(editing.armRightCm, units),
      thighLeftCm: lengthToInput(editing.thighLeftCm, units),
      thighRightCm: lengthToInput(editing.thighRightCm, units),
      calfCm: lengthToInput(editing.calfCm, units),
    })
    setNotes(editing.notes ?? '')
    setShowMore(
      GIRTH_FIELDS.some((f) => editing[f] != null) || Boolean(editing.notes?.trim()),
    )
    // `units` is stable for the life of the dashboard load; excluded on purpose.
  }, [editing]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (savedTimer.current != null) window.clearTimeout(savedTimer.current)
    }
  }, [])

  // Live validation: errors exist regardless of blur, but only render once touched.
  const dateError = !date
    ? 'Enter a date.'
    : date > today()
      ? 'Date cannot be in the future.'
      : undefined

  const weightError = (() => {
    if (!weight.trim()) return undefined
    const kg = weightFromInput(weight, units)
    if (kg == null) return `Enter a number in ${weightUnit}.`
    if (kg < 30 || kg > 350) {
      return units === 'metric'
        ? 'Enter a weight between 30 and 350 kg.'
        : 'Enter a weight between 66 and 770 lb.'
    }
    return undefined
  })()

  const lengthError = (raw: string): string | undefined => {
    if (!raw.trim()) return undefined
    const cm = lengthFromInput(raw, units)
    if (cm == null) return `Enter a number in ${lengthUnit}.`
    if (cm < 10 || cm > 250) {
      return units === 'metric'
        ? 'Enter a length between 10 and 250 cm.'
        : 'Enter a length between 4 and 98 in.'
    }
    return undefined
  }

  const waistError = lengthError(waist)
  const girthErrors: Partial<Record<GirthField, string>> = {}
  for (const f of GIRTH_FIELDS) {
    const err = lengthError(girths[f])
    if (err) girthErrors[f] = err
  }

  const hasAnyValue =
    Boolean(weight.trim()) ||
    Boolean(waist.trim()) ||
    Boolean(notes.trim()) ||
    GIRTH_FIELDS.some((f) => girths[f].trim())

  const hasError = Boolean(dateError || weightError || waistError) || GIRTH_FIELDS.some(
    (f) => girthErrors[f] != null,
  )

  const mark = (field: string) => setTouched((prev) => ({ ...prev, [field]: true }))
  const show = (field: string, error?: string) => (touched[field] ? error : undefined)

  function resetToMode() {
    setServerError(null)
    setTouched({})
    if (!editing) {
      setDate(today())
      setWeight('')
      setWaist('')
      setGirths(emptyGirths())
      setNotes('')
      setShowMore(false)
    } else {
      setDate(editing.takenAt.slice(0, 10))
      setWeight(weightToInput(editing.weightKg, units))
      setWaist(lengthToInput(editing.waistCm, units))
      setGirths({
        neckCm: lengthToInput(editing.neckCm, units),
        chestCm: lengthToInput(editing.chestCm, units),
        hipsCm: lengthToInput(editing.hipsCm, units),
        armLeftCm: lengthToInput(editing.armLeftCm, units),
        armRightCm: lengthToInput(editing.armRightCm, units),
        thighLeftCm: lengthToInput(editing.thighLeftCm, units),
        thighRightCm: lengthToInput(editing.thighRightCm, units),
        calfCm: lengthToInput(editing.calfCm, units),
      })
      setNotes(editing.notes ?? '')
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!hasAnyValue || hasError) return
    setPending(true)
    setServerError(null)
    const g = (f: GirthField) => lengthFromInput(girths[f], units)
    try {
      await saveMeasurement({
        data: {
          ...(editing ? { id: editing.id } : {}),
          takenAt: date,
          weightKg: weightFromInput(weight, units),
          waistCm: lengthFromInput(waist, units),
          neckCm: g('neckCm'),
          chestCm: g('chestCm'),
          hipsCm: g('hipsCm'),
          armLeftCm: g('armLeftCm'),
          armRightCm: g('armRightCm'),
          thighLeftCm: g('thighLeftCm'),
          thighRightCm: g('thighRightCm'),
          calfCm: g('calfCm'),
          notes: notes.trim() || null,
        },
      })
      await router.invalidate()
      setSaved(true)
      onSaved?.()
      if (savedTimer.current != null) window.clearTimeout(savedTimer.current)
      savedTimer.current = window.setTimeout(() => setSaved(false), 1500)
      if (editing) {
        onEditDone()
      } else {
        setWeight('')
        setWaist('')
        setGirths(emptyGirths())
        setNotes('')
        setTouched({})
      }
    } catch {
      setServerError('Could not save the entry. Try again.')
    } finally {
      setPending(false)
    }
  }

  const lastWeightHint =
    !editing && lastWeightKg != null
      ? `Last: ${weightToInput(lastWeightKg, units)} ${weightUnit}`
      : undefined

  return (
    <div className="card">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-t-xl px-4 py-2 text-left"
      >
        <span className="text-sm font-semibold">
          {editing ? 'Edit entry' : 'Quick log'}
        </span>
        <svg
          viewBox="0 0 16 16"
          aria-hidden="true"
          className={`h-4 w-4 shrink-0 text-dim transition-transform duration-200 ease-out ${open ? 'rotate-180' : ''}`}
        >
          <path
            d="M4 6l4 4 4-4"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <form onSubmit={handleSubmit} noValidate className="border-t border-line p-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <div>
              <label htmlFor="m-date" className="label">
                Date
              </label>
              <input
                id="m-date"
                type="date"
                className="input"
                max={today()}
                value={date}
                onChange={(e) => {
                  mark('date')
                  setDate(e.target.value)
                }}
                aria-invalid={touched.date && dateError ? true : undefined}
                aria-describedby={touched.date && dateError ? 'm-date-error' : undefined}
              />
              {show('date', dateError) && (
                <p id="m-date-error" className="field-error">
                  {dateError}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="m-weight" className="label">
                Weight ({weightUnit})
              </label>
              <input
                id="m-weight"
                type="text"
                inputMode="decimal"
                className="input num"
                placeholder={units === 'metric' ? '72.5' : '160'}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                onBlur={() => mark('weight')}
                aria-invalid={show('weight', weightError) ? true : undefined}
                aria-describedby={
                  show('weight', weightError)
                    ? 'm-weight-error'
                    : lastWeightHint
                      ? 'm-weight-hint'
                      : undefined
                }
              />
              {show('weight', weightError) ? (
                <p id="m-weight-error" className="field-error">
                  {weightError}
                </p>
              ) : (
                lastWeightHint && (
                  <p id="m-weight-hint" className="hint">
                    {lastWeightHint}
                  </p>
                )
              )}
            </div>

            <div>
              <label htmlFor="m-waist" className="label">
                Waist ({lengthUnit})
              </label>
              <input
                id="m-waist"
                type="text"
                inputMode="decimal"
                className="input num"
                placeholder={units === 'metric' ? '78' : '30.7'}
                value={waist}
                onChange={(e) => setWaist(e.target.value)}
                onBlur={() => mark('waist')}
                aria-invalid={show('waist', waistError) ? true : undefined}
                aria-describedby={show('waist', waistError) ? 'm-waist-error' : undefined}
              />
              {show('waist', waistError) && (
                <p id="m-waist-error" className="field-error">
                  {waistError}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowMore((prev) => !prev)}
            aria-expanded={showMore}
            className="mt-3 inline-flex min-h-11 items-center rounded-md px-1 text-sm font-medium text-dim hover:text-text"
          >
            {showMore ? 'Fewer fields' : 'More fields'}
          </button>

          {showMore && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {GIRTH_FIELDS.map((f) => {
                const error = girthErrors[f]
                return (
                  <div key={f}>
                    <label htmlFor={`m-${f}`} className="label">
                      {FIELD_LABELS[f]} ({lengthUnit})
                    </label>
                    <input
                      id={`m-${f}`}
                      type="text"
                      inputMode="decimal"
                      className="input num"
                      value={girths[f]}
                      onChange={(e) => setGirths((prev) => ({ ...prev, [f]: e.target.value }))}
                      onBlur={() => mark(f)}
                      aria-invalid={show(f, error) ? true : undefined}
                      aria-describedby={show(f, error) ? `m-${f}-error` : undefined}
                    />
                    {show(f, error) && (
                      <p id={`m-${f}-error`} className="field-error">
                        {error}
                      </p>
                    )}
                  </div>
                )
              })}

              <div className="col-span-2 sm:col-span-4">
                <label htmlFor="m-notes" className="label">
                  Notes
                </label>
                <textarea
                  id="m-notes"
                  className="input resize-y"
                  style={{ height: '4.5rem', paddingTop: '0.5rem', paddingBottom: '0.5rem' }}
                  placeholder="Optional. Training block, conditions, anything worth remembering."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>
            </div>
          )}

          {serverError && (
            <p role="alert" className="mt-3 rounded-lg border border-rose/40 bg-rose/10 px-3 py-2 text-sm text-rose">
              {serverError}
            </p>
          )}

          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={resetToMode}
              className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm font-medium text-dim hover:text-text"
            >
              Clear
            </button>
            <button
              type="submit"
              disabled={pending || !hasAnyValue || hasError}
              className="btn-primary px-5"
            >
              {saved
                ? 'Saved'
                : pending
                  ? 'Saving…'
                  : editing
                    ? 'Save changes'
                    : 'Log entry'}
            </button>
          </div>

          {!hasAnyValue && (
            <p className="hint">Log at least one number to save an entry.</p>
          )}
        </form>
      )}
    </div>
  )
}
