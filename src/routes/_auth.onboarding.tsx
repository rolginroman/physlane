import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useState, useEffect, type FormEvent, type KeyboardEvent } from 'react'
import { hasAnyCycle, saveCycle } from '#/server/cycles.fns'
import { saveMeasurement } from '#/server/measurements.fns'
import { saveSettings } from '#/lib/auth-guard.fns'
import type { Sex } from '#/lib/navy-bf'
import { estimateStartingKcal, kcalPerKg, rateToDailyKcal } from '#/lib/kcal-start'
import { kgToLb, weightFromInput, lengthFromInput, type UnitSystem } from '#/lib/units'

export const Route = createFileRoute('/_auth/onboarding')({
  head: () => ({ meta: [{ title: 'Set up your tracker · physlane' }] }),
  beforeLoad: async () => {
    const any = await hasAnyCycle()
    if (any) throw redirect({ to: '/dashboard' })
  },
  component: OnboardingPage,
})

type Phase = 'cut' | 'bulk' | 'maintain'

const PHASES: { id: Phase; label: string; blurb: string; rate: string; hint: string }[] = [
  {
    id: 'cut',
    label: 'Cut',
    blurb: 'Lose fat, keep muscle.',
    rate: '-0.5',
    hint: 'Kg per week. Negative is loss.',
  },
  {
    id: 'bulk',
    label: 'Bulk',
    blurb: 'Add muscle, limit fat.',
    rate: '0.25',
    hint: 'Kg per week. Positive is gain.',
  },
  {
    id: 'maintain',
    label: 'Maintain',
    blurb: 'Hold weight, build the trend.',
    rate: '0',
    hint: 'Zero holds your weight steady.',
  },
]

const STEP_TITLES = ['Set your goal', 'Your body', 'Daily kcal target']
const STEP_LABELS = ['Goal', 'Body', 'Target']

const today = () => new Date().toISOString().slice(0, 10)

function rateError(phase: Phase, rate: string): string | undefined {
  const n = Number.parseFloat(rate)
  if (!Number.isFinite(n)) return 'Enter a number, like -0.5.'
  if (Math.abs(n) > 2) return 'Keep the rate between -2 and 2 kg per week.'
  if (phase === 'cut' && n >= 0) return 'Cut needs a negative rate, like -0.5.'
  if (phase === 'bulk' && n <= 0) return 'Bulk needs a positive rate, like 0.25.'
  if (phase === 'maintain' && n !== 0) return 'Maintain uses 0. Pick cut or bulk to chase a rate.'
  return undefined
}

function weightError(weight: string, units: UnitSystem): string | undefined {
  const kg = weightFromInput(weight, units)
  if (kg == null) return 'Enter your current weight.'
  if (kg < 30 || kg > 350) {
    return units === 'metric'
      ? 'Enter a weight between 30 and 350 kg.'
      : 'Enter a weight between 66 and 770 lb.'
  }
  return undefined
}

/** Height is optional — only a non-empty invalid entry blocks the step. */
function heightError(height: string, units: UnitSystem): string | undefined {
  if (!height.trim()) return undefined
  const cm = lengthFromInput(height, units)
  if (cm == null) return units === 'metric' ? 'Enter a number in cm.' : 'Enter a number in inches.'
  if (cm < 90 || cm > 250) {
    return units === 'metric'
      ? 'Enter a height between 90 and 250 cm.'
      : 'Enter a height between 36 and 98 in.'
  }
  return undefined
}

function kcalError(kcal: string): string | undefined {
  const n = Number.parseFloat(kcal)
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    return 'Enter a whole number of kcal, like 2000.'
  }
  if (n < 800 || n > 6000) return 'Enter a target between 800 and 6000 kcal.'
  return undefined
}

function OnboardingPage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [phase, setPhase] = useState<Phase>('cut')
  const [rate, setRate] = useState('-0.5')
  const [units, setUnits] = useState<UnitSystem>('metric')
  const [weight, setWeight] = useState('')
  const [height, setHeight] = useState('')
  const [sex, setSex] = useState<Sex | ''>('')
  const [kcal, setKcal] = useState('')
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [pending, setPending] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const liveRate = rateError(phase, rate)
  const liveWeight = weightError(weight, units)
  const liveHeight = heightError(height, units)
  const liveKcal = kcalError(kcal)

  const stepValid =
    step === 1 ? !liveRate : step === 2 ? !liveWeight && !liveHeight : !liveKcal

  const mark = (field: string) => setTouched((prev) => ({ ...prev, [field]: true }))
  const show = (field: string, error?: string) => (touched[field] ? error : undefined)

  function selectPhase(id: Phase) {
    setPhase(id)
    const preset = PHASES.find((p) => p.id === id)
    if (preset) {
      setRate(preset.rate)
      setTouched((prev) => ({ ...prev, rate: false }))
    }
  }

  /** Radiogroup arrow keys: left/up selects the previous phase, right/down the next. */
  function handlePhaseKeys(event: KeyboardEvent<HTMLDivElement>) {
    const keys = ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown']
    if (!keys.includes(event.key)) return
    event.preventDefault()
    const radios = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'),
    )
    const index = radios.findIndex((r) => r.getAttribute('aria-checked') === 'true')
    const dir = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1
    const nextIndex = (index + dir + radios.length) % radios.length
    const target = radios[nextIndex]
    if (target) {
      target.focus()
      target.click()
    }
  }

  /** Convert the entered weight and height when switching unit systems, so nothing is retyped. */
  function switchUnits(next: UnitSystem) {
    if (next === units) return
    setWeight((prev) => {
      const kg = weightFromInput(prev, units)
      if (kg == null) return prev
      return next === 'metric' ? kg.toFixed(1) : kgToLb(kg).toFixed(1)
    })
    setHeight((prev) => {
      const cm = lengthFromInput(prev, units)
      if (cm == null) return prev
      return next === 'metric' ? cm.toFixed(1) : (cm / 2.54).toFixed(1)
    })
    setUnits(next)
  }

  async function handleFinish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!stepValid || pending) return
    setPending(true)
    setServerError(null)
    const startWeightKg = weightFromInput(weight, units)
    const targetRate = Number.parseFloat(rate)
    const kcalTarget = Number.parseInt(kcal, 10)
    const start = today()
    try {
      await saveCycle({
        data: {
          phase,
          startDate: start,
          startWeightKg,
          targetRateKgPerWeek: targetRate,
          kcalTargetPerDay: kcalTarget,
        },
      })
      await saveMeasurement({ data: { takenAt: start, weightKg: startWeightKg } })
      await saveSettings({
        data: {
          unitSystem: units,
          heightCm: lengthFromInput(height, units),
          sex: sex === '' ? null : sex,
        },
      })
      await navigate({ to: '/dashboard' })
    } catch {
      setServerError('Could not save your setup. Check your connection and try again.')
      setPending(false)
    }
  }

  const activePhase = PHASES.find((p) => p.id === phase) ?? PHASES[0]

  // Day-one target suggestion from steps 1-2 (population heuristic, see /guide).
  const parsedRate = Number.parseFloat(rate)
  const startKcal = estimateStartingKcal({
    weightKg: weightFromInput(weight, units),
    sex: sex === '' ? null : sex,
    phase,
    targetRateKgPerWeek: Number.isFinite(parsedRate) ? parsedRate : null,
  })
  const whyKcal = (() => {
    const kgNow = weightFromInput(weight, units)
    if (kgNow == null) return null
    const perKg = kcalPerKg(sex === '' ? null : sex)
    const parts = [
      `${kgNow} kg × ${perKg} kcal/kg ≈ ${Math.round(kgNow * perKg)} to hold weight (population average).`,
    ]
    if (phase !== 'maintain' && Number.isFinite(parsedRate)) {
      const delta = Math.round(rateToDailyKcal(parsedRate))
      const dir = phase === 'cut' ? 'below' : 'above'
      parts.push(`Your ${Math.abs(parsedRate)} kg/wk goal is ${delta} kcal/day ${dir} that.`)
    }
    parts.push('physlane replaces this guess with your measured burn after ~14 days of logs.')
    return parts.join(' ')
  })()

  useEffect(() => {
    if (step === 3 && !kcal.trim() && startKcal != null) setKcal(String(startKcal))
    // Prefill once when entering step 3; later edits are the user's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step])

  const weightDisplay =
    weight.trim() && !liveWeight ? `${weight.trim()} ${units === 'metric' ? 'kg' : 'lb'}` : ''

  return (
    <section className="mx-auto w-full max-w-md pt-8">
      <div>
        <div className="flex items-center justify-between">
          <ol className="m-0 flex list-none items-center gap-3 p-0 text-xs">
            {STEP_LABELS.map((label, i) => (
              <li
                key={label}
                className={
                  step === i + 1
                    ? 'font-medium text-text'
                    : step > i + 1
                      ? 'text-accent'
                      : 'text-dim'
                }
              >
                {label}
              </li>
            ))}
          </ol>
          <p className="m-0 text-xs text-dim">
            Step {step} of 3
          </p>
        </div>
        <div className="mt-2 h-0.5 overflow-hidden rounded-full bg-line">
          <div
            className="h-full origin-left bg-accent transition-transform duration-200 ease-out"
            style={{ transform: `scaleX(${step / 3})` }}
          />
        </div>
      </div>

      <h1 className="mt-6 mb-0 text-xl font-semibold tracking-tight">
        {STEP_TITLES[step - 1]}
      </h1>

      <form onSubmit={handleFinish} noValidate>
        <div className="card mt-4 p-4">
          {step === 1 && (
            <>
              <p className="m-0 mb-4 text-sm text-dim">
                Pick a phase and a weekly rate. You can change both later.
              </p>
              <div
                role="radiogroup"
                aria-label="Goal"
                onKeyDown={handlePhaseKeys}
                className="grid gap-2 sm:grid-cols-3"
              >
                {PHASES.map((p) => {
                  const selected = phase === p.id
                  return (
                    <div key={p.id}>
                      <button
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => selectPhase(p.id)}
                        className={`flex min-h-11 w-full flex-col items-start gap-1 rounded-lg border p-3 text-left ${
                          selected
                            ? 'border-accent bg-surface2'
                            : 'border-line bg-surface hover:border-line2'
                        }`}
                      >
                        <span className="text-sm font-semibold">{p.label}</span>
                        <span className="text-xs text-dim">{p.blurb}</span>
                      </button>
                      {selected && (
                        <div className="mt-2">
                          <label htmlFor="onb-rate" className="label">
                            Target rate (kg/wk)
                          </label>
                          <input
                            id="onb-rate"
                            type="text"
                            inputMode="decimal"
                            className="input num"
                            value={rate}
                            onChange={(e) => setRate(e.target.value)}
                            onBlur={() => mark('rate')}
                            aria-invalid={show('rate', liveRate) ? true : undefined}
                            aria-describedby={
                              show('rate', liveRate) ? 'onb-rate-error' : 'onb-rate-hint'
                            }
                          />
                          {show('rate', liveRate) ? (
                            <p id="onb-rate-error" className="field-error">
                              {liveRate}
                            </p>
                          ) : (
                            <p id="onb-rate-hint" className="hint">
                              {p.hint}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <p className="m-0 mb-4 text-sm text-dim">
                Where you start today. This seeds your trend line.
              </p>
              <div className="mb-4">
                <span className="label" id="onb-units-label">
                  Units
                </span>
                <div
                  role="radiogroup"
                  aria-labelledby="onb-units-label"
                  className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-surface2 p-1"
                >
                  {(['metric', 'imperial'] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      role="radio"
                      aria-checked={units === u}
                      onClick={() => switchUnits(u)}
                      className={`min-h-11 rounded-md px-3 text-sm font-medium ${
                        units === u ? 'bg-surface text-text' : 'text-dim hover:text-text'
                      }`}
                    >
                      {u === 'metric' ? 'Metric (kg, cm)' : 'Imperial (lb, in)'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label htmlFor="onb-weight" className="label">
                  Current weight ({units === 'metric' ? 'kg' : 'lb'})
                </label>
                <input
                  id="onb-weight"
                  type="text"
                  inputMode="decimal"
                  className="input num"
                  placeholder={units === 'metric' ? '72.5' : '160'}
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  onBlur={() => mark('weight')}
                  aria-invalid={show('weight', liveWeight) ? true : undefined}
                  aria-describedby={
                    show('weight', liveWeight) ? 'onb-weight-error' : 'onb-weight-hint'
                  }
                />
                {show('weight', liveWeight) ? (
                  <p id="onb-weight-error" className="field-error">
                    {liveWeight}
                  </p>
                ) : (
                  <p id="onb-weight-hint" className="hint">
                    Your day one baseline weigh-in.
                  </p>
                )}
              </div>

              <div className="mt-4">
                <label htmlFor="onb-height" className="label">
                  Height ({units === 'metric' ? 'cm' : 'in'})
                </label>
                <input
                  id="onb-height"
                  type="text"
                  inputMode="decimal"
                  className="input num"
                  placeholder={units === 'metric' ? '180' : '71'}
                  value={height}
                  onChange={(e) => setHeight(e.target.value)}
                  onBlur={() => mark('height')}
                  aria-invalid={show('height', liveHeight) ? true : undefined}
                  aria-describedby={
                    show('height', liveHeight) ? 'onb-height-error' : 'onb-height-hint'
                  }
                />
                {show('height', liveHeight) ? (
                  <p id="onb-height-error" className="field-error">
                    {liveHeight}
                  </p>
                ) : (
                  <p id="onb-height-hint" className="hint">
                    Used to estimate body fat from your measurements. Optional.
                  </p>
                )}
              </div>

              <div className="mt-4">
                <span className="label" id="onb-sex-label">
                  Sex
                </span>
                <div
                  role="radiogroup"
                  aria-labelledby="onb-sex-label"
                  className="grid grid-cols-2 gap-1 rounded-lg border border-line bg-surface2 p-1"
                >
                  {(['male', 'female'] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      role="radio"
                      aria-checked={sex === s}
                      onClick={() => setSex(sex === s ? '' : s)}
                      className={`min-h-11 rounded-md px-3 text-sm font-medium capitalize ${
                        sex === s ? 'bg-surface text-text' : 'text-dim hover:text-text'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <p className="hint">Used to estimate body fat from your measurements. Optional.</p>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <p className="m-0 mb-4 text-sm text-dim">
                {activePhase.label} at {rate} kg/wk
                {weightDisplay ? `, starting at ${weightDisplay}` : ', starting today'}.
              </p>
              <div>
                <label htmlFor="onb-kcal" className="label">
                  Daily kcal target
                </label>
                <input
                  id="onb-kcal"
                  type="text"
                  inputMode="numeric"
                  className="input num"
                  placeholder="2000"
                  value={kcal}
                  onChange={(e) => setKcal(e.target.value)}
                  onBlur={() => mark('kcal')}
                  aria-invalid={show('kcal', liveKcal) ? true : undefined}
                  aria-describedby={show('kcal', liveKcal) ? 'onb-kcal-error' : 'onb-kcal-hint'}
                />
                {show('kcal', liveKcal) ? (
                  <p id="onb-kcal-error" className="field-error">
                    {liveKcal}
                  </p>
                ) : (
                  <p id="onb-kcal-hint" className="hint">
                    Prefilled with a population guess from your step 1-2 answers. Edit freely,
                    or leave it: a target is optional until the engine suggests one from your
                    real data.
                  </p>
                )}
                {whyKcal && (
                  <details className="mt-2 rounded-lg border border-line bg-surface2 px-3 py-2 text-sm text-dim">
                    <summary className="cursor-pointer select-none font-medium text-text">
                      Why this number?
                    </summary>
                    <p className="mt-2">{whyKcal}</p>
                  </details>
                )}
                <p className="mt-2 text-xs text-faint">
                  New to tracking, or want the research behind these numbers?{' '}
                  <a
                    href="/guide"
                    target="_blank"
                    rel="noopener"
                    className="underline underline-offset-4 hover:text-dim"
                  >
                    Read the short guide
                  </a>
                  .
                </p>
              </div>
            </>
          )}

          {serverError && (
            <p
              role="alert"
              className="mt-4 rounded-lg border border-rose/40 bg-rose/10 px-3 py-2 text-sm text-rose"
            >
              {serverError}
            </p>
          )}

          <div className="mt-6 flex items-center justify-between gap-3">
            {step > 1 ? (
              <button
                type="button"
                onClick={() => setStep((prev) => Math.max(1, prev - 1))}
                className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm font-medium text-dim hover:text-text"
              >
                Back
              </button>
            ) : (
              <span aria-hidden="true" />
            )}
            {step < 3 ? (
              <button
                type="button"
                disabled={!stepValid}
                onClick={() => setStep((prev) => Math.min(3, prev + 1))}
                className="btn-primary px-5"
              >
                Continue
              </button>
            ) : (
              <button type="submit" disabled={!stepValid || pending} className="btn-primary px-5">
                {pending ? 'Saving…' : 'Start tracking'}
              </button>
            )}
          </div>
        </div>
      </form>
    </section>
  )
}
