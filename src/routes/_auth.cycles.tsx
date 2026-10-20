import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState, type FormEvent, type KeyboardEvent } from "react";
import {
  endActiveCycle,
  getActiveCycle,
  listCycles,
  saveCycle,
  type CycleDTO,
} from "#/server/cycles.fns";
import {
  listMeasurements,
  type MeasurementDTO,
} from "#/server/measurements.fns";
import { getViewer } from "#/lib/auth-guard.fns";
import {
  fmtWeight,
  formatWeightRate,
  kgToLb,
  rateFromInput,
  rateLimitInput,
  rateToInput,
  weightFromInput,
  type UnitSystem,
} from "#/lib/units";
import { PhaseLabel } from "#/components/phase-label";

export const Route = createFileRoute("/_auth/cycles")({
  head: () => ({ meta: [{ title: "Cycles · physlane" }] }),
  loader: async () => {
    const [active, cycles, entries, viewer] = await Promise.all([
      getActiveCycle(),
      listCycles(),
      listMeasurements(),
      getViewer(),
    ]);
    return {
      active,
      cycles,
      entries,
      units: (viewer?.unitSystem ?? "metric") as UnitSystem,
    };
  },
  component: CyclesPage,
});

type Phase = "cut" | "bulk" | "maintain";

const PHASES: { id: Phase; label: string; blurb: string; rateKg: number }[] = [
  { id: "cut", label: "Cut", blurb: "Lose fat, keep muscle.", rateKg: -0.5 },
  { id: "bulk", label: "Bulk", blurb: "Add muscle, limit fat.", rateKg: 0.25 },
  {
    id: "maintain",
    label: "Maintain",
    blurb: "Hold weight steady.",
    rateKg: 0,
  },
];

const MAX_RATE_KG_PER_WEEK = 2;

const SIGN = { minus: "−" as const, plus: "+" as const };

function fmtSignedKg(kg: number | null, units: UnitSystem): string {
  if (kg == null) return "—";
  const v = units === "metric" ? kg : kgToLb(kg);
  const sign = v > 0 ? SIGN.plus : v < 0 ? SIGN.minus : "";
  return `${sign}${Math.abs(v).toFixed(1)} ${units === "metric" ? "kg" : "lb"}`;
}

const CURRENT_YEAR = new Date().getUTCFullYear();
const fullDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});
const shortDate = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

/** Deterministic (UTC, fixed locale) so SSR and client render the same string. */
function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.getUTCFullYear() === CURRENT_YEAR
    ? shortDate.format(d)
    : fullDate.format(d);
}

const today = () => new Date().toISOString().slice(0, 10);

function CyclesPage() {
  const { active, cycles, entries, units } = Route.useLoaderData();

  const history = cycles.filter((c) => c.endDate != null);
  let latestWeightKg: number | null = null;
  for (const e of entries) {
    if (e.weightKg != null) latestWeightKg = e.weightKg;
  }

  return (
    <section className="pt-8">
      <h1 className="m-0 text-xl font-semibold tracking-tight">Cycles</h1>
      <p className="m-0 mt-1 text-xs text-faint">
        Units, profile, reminders, sharing and exports live in Settings, top
        right.
      </p>

      {active ? (
        <ActiveCycleCard cycle={active} units={units} />
      ) : (
        <div className="card mt-4 px-4 py-3">
          <p className="m-0 text-sm text-dim">
            No active cycle. Start one below.
          </p>
        </div>
      )}

      <NewPhaseCard
        hasActive={active != null}
        units={units}
        latestWeightKg={latestWeightKg}
      />

      <HistoryCard history={history} entries={entries} units={units} />
    </section>
  );
}

function ActiveCycleCard({
  cycle,
  units,
}: {
  cycle: CycleDTO;
  units: UnitSystem;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleEnd() {
    setPending(true);
    setError(null);
    try {
      await endActiveCycle({ data: { id: cycle.id } });
      await router.invalidate();
    } catch {
      setError("Could not end the cycle. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="card mt-4 p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="m-0 text-sm font-semibold">Active phase</h2>
        <PhaseLabel phase={cycle.phase} />
        {!confirming && (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="ml-auto inline-flex min-h-11 items-center rounded-lg border border-danger/40 px-4 text-sm font-medium text-danger hover:bg-danger/10"
          >
            End cycle
          </button>
        )}
      </div>

      <dl className="m-0 mt-3 grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        <div>
          <dt className="text-xs text-dim">Start date</dt>
          <dd className="m-0 mt-0.5 text-sm">{fmtDate(cycle.startDate)}</dd>
        </div>
        <div>
          <dt className="text-xs text-dim">Start weight</dt>
          <dd className="num m-0 mt-0.5 text-sm">
            {fmtWeight(cycle.startWeightKg, units)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-dim">Target rate</dt>
          <dd className="num m-0 mt-0.5 text-sm">
            {formatWeightRate(cycle.targetRateKgPerWeek, units)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-dim">Kcal target</dt>
          <dd className="num m-0 mt-0.5 text-sm">
            {cycle.kcalTargetPerDay != null
              ? `${cycle.kcalTargetPerDay} kcal`
              : "—"}
          </dd>
        </div>
      </dl>

      {confirming && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-danger/40 bg-danger/5 px-3 py-2">
          <p className="m-0 text-sm">End this cycle? History is kept.</p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleEnd}
              disabled={pending}
              className="inline-flex min-h-11 items-center rounded-lg border border-danger/60 bg-danger/15 px-4 text-sm font-medium text-danger hover:bg-danger/25"
            >
              {pending ? "Ending…" : "End"}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={pending}
              className="inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm font-medium text-dim hover:text-text"
            >
              Keep
            </button>
          </div>
        </div>
      )}

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      )}
    </div>
  );
}

function rateError(
  phase: Phase,
  rate: string,
  units: UnitSystem,
): string | undefined {
  const n = rateFromInput(rate, units);
  const cut = rateToInput(-0.5, units);
  const bulk = rateToInput(0.25, units);
  if (n == null) return `Enter a number, like ${cut}.`;
  if (Math.abs(n) > MAX_RATE_KG_PER_WEEK) {
    const max = rateLimitInput(MAX_RATE_KG_PER_WEEK, units);
    return `Keep the rate between -${max} and ${max} ${units === "metric" ? "kg" : "lb"} per week.`;
  }
  if (phase === "cut" && n >= 0)
    return `Cut needs a negative rate, like ${cut}.`;
  if (phase === "bulk" && n <= 0)
    return `Bulk needs a positive rate, like ${bulk}.`;
  if (phase === "maintain" && n !== 0)
    return "Maintain uses 0. Pick cut or bulk to chase a rate.";
  return undefined;
}

function optionalKcalError(kcal: string): string | undefined {
  if (!kcal.trim()) return undefined;
  const n = Number.parseFloat(kcal);
  if (!Number.isFinite(n) || !Number.isInteger(n))
    return "Enter a whole number of kcal, like 2000.";
  if (n < 800 || n > 6000) return "Enter a target between 800 and 6000 kcal.";
  return undefined;
}

function optionalWeightError(
  weight: string,
  units: UnitSystem,
): string | undefined {
  if (!weight.trim()) return undefined;
  const kg = weightFromInput(weight, units);
  if (kg == null) {
    return units === "metric"
      ? "Enter a number in kg."
      : "Enter a number in lb.";
  }
  if (kg < 30 || kg > 350) {
    return units === "metric"
      ? "Enter a weight between 30 and 350 kg."
      : "Enter a weight between 66 and 770 lb.";
  }
  return undefined;
}

function NewPhaseCard({
  hasActive,
  units,
  latestWeightKg,
}: {
  hasActive: boolean;
  units: UnitSystem;
  latestWeightKg: number | null;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("cut");
  const [rate, setRate] = useState(() => rateToInput(PHASES[0].rateKg, units));
  const [kcal, setKcal] = useState("");
  const [weight, setWeight] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [pending, setPending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const liveRate = rateError(phase, rate, units);
  const liveKcal = optionalKcalError(kcal);
  const liveWeight = optionalWeightError(weight, units);
  const hasError = Boolean(liveRate || liveKcal || liveWeight);

  const mark = (field: string) =>
    setTouched((prev) => ({ ...prev, [field]: true }));
  const show = (field: string, error?: string) =>
    touched[field] ? error : undefined;

  function selectPhase(id: Phase) {
    setPhase(id);
    const preset = PHASES.find((p) => p.id === id);
    if (preset) {
      setRate(rateToInput(preset.rateKg, units));
      setTouched((prev) => ({ ...prev, rate: false }));
    }
  }

  /** Radiogroup arrow keys: left/up selects the previous phase, right/down the next. */
  function handlePhaseKeys(event: KeyboardEvent<HTMLDivElement>) {
    const keys = ["ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const radios = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'),
    );
    const index = radios.findIndex(
      (r) => r.getAttribute("aria-checked") === "true",
    );
    const dir = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
    const nextIndex = (index + dir + radios.length) % radios.length;
    const target = radios[nextIndex];
    if (target) {
      target.focus();
      target.click();
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (hasError || pending) return;
    setPending(true);
    setServerError(null);
    try {
      await saveCycle({
        data: {
          phase,
          startDate: today(),
          startWeightKg:
            weightFromInput(weight, units) ?? latestWeightKg ?? null,
          targetRateKgPerWeek: rateFromInput(rate, units),
          kcalTargetPerDay: kcal.trim() ? Number.parseInt(kcal, 10) : null,
        },
      });
      await router.invalidate();
      setKcal("");
      setWeight("");
      setTouched({});
    } catch {
      setServerError("Could not start the cycle. Try again.");
    } finally {
      setPending(false);
    }
  }

  const weightUnit = units === "metric" ? "kg" : "lb";

  return (
    <form onSubmit={handleSubmit} noValidate className="card mt-4 p-4">
      <h2 className="m-0 text-sm font-semibold">Start a new phase</h2>
      <p className="m-0 mt-1 text-xs text-dim">
        {hasActive
          ? "Starting a new phase ends the current one. History is kept."
          : "Set the phase and rate for your next block."}
      </p>

      <div
        role="radiogroup"
        aria-label="Phase"
        onKeyDown={handlePhaseKeys}
        className="mt-3 grid gap-2 sm:grid-cols-3"
      >
        {PHASES.map((p) => {
          const selected = phase === p.id;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => selectPhase(p.id)}
              className={`flex min-h-11 w-full flex-col items-start gap-1 rounded-lg border p-3 text-left ${
                selected
                  ? "border-accent bg-surface2"
                  : "border-line bg-surface hover:border-line2"
              }`}
            >
              <span className="text-sm font-semibold">{p.label}</span>
              <span className="text-xs text-dim">{p.blurb}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <label htmlFor="cyc-rate" className="label">
            Target rate ({weightUnit}/wk)
          </label>
          <input
            id="cyc-rate"
            type="text"
            inputMode="decimal"
            className="input num"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            onBlur={() => mark("rate")}
            aria-invalid={show("rate", liveRate) ? true : undefined}
            aria-describedby={
              show("rate", liveRate) ? "cyc-rate-error" : "cyc-rate-hint"
            }
          />
          {show("rate", liveRate) ? (
            <p id="cyc-rate-error" className="field-error">
              {liveRate}
            </p>
          ) : (
            <p id="cyc-rate-hint" className="hint">
              {units === "metric" ? "Kg" : "Lb"} per week. Negative is loss.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="cyc-kcal" className="label">
            Daily kcal target
          </label>
          <input
            id="cyc-kcal"
            type="text"
            inputMode="numeric"
            className="input num"
            placeholder="2000"
            value={kcal}
            onChange={(e) => setKcal(e.target.value)}
            onBlur={() => mark("kcal")}
            aria-invalid={show("kcal", liveKcal) ? true : undefined}
            aria-describedby={
              show("kcal", liveKcal) ? "cyc-kcal-error" : "cyc-kcal-hint"
            }
          />
          {show("kcal", liveKcal) ? (
            <p id="cyc-kcal-error" className="field-error">
              {liveKcal}
            </p>
          ) : (
            <p id="cyc-kcal-hint" className="hint">
              Optional. Your daily goal.
            </p>
          )}
        </div>

        <div>
          <label htmlFor="cyc-weight" className="label">
            Start weight ({weightUnit})
          </label>
          <input
            id="cyc-weight"
            type="text"
            inputMode="decimal"
            className="input num"
            placeholder={units === "metric" ? "72.5" : "160"}
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            onBlur={() => mark("weight")}
            aria-invalid={show("weight", liveWeight) ? true : undefined}
            aria-describedby={
              show("weight", liveWeight)
                ? "cyc-weight-error"
                : "cyc-weight-hint"
            }
          />
          {show("weight", liveWeight) ? (
            <p id="cyc-weight-error" className="field-error">
              {liveWeight}
            </p>
          ) : (
            <p id="cyc-weight-hint" className="hint">
              {latestWeightKg != null
                ? `Leave blank to use your latest weigh-in (${fmtWeight(latestWeightKg, units)}).`
                : "Leave blank to start without a start weight."}
            </p>
          )}
        </div>
      </div>

      {serverError && (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {serverError}
        </p>
      )}

      <div className="mt-4">
        <button
          type="submit"
          disabled={pending || hasError}
          className="btn-primary px-5"
        >
          {pending ? "Starting…" : "Start cycle"}
        </button>
      </div>
    </form>
  );
}

/** Last logged weight at or before the cycle's end date, or null. */
function endWeightKg(
  cycle: CycleDTO,
  entries: MeasurementDTO[],
): number | null {
  const endMs = cycle.endDate
    ? new Date(cycle.endDate).getTime()
    : Number.POSITIVE_INFINITY;
  let weight: number | null = null;
  for (const e of entries) {
    if (new Date(e.takenAt).getTime() > endMs) break;
    if (e.weightKg != null) weight = e.weightKg;
  }
  return weight;
}

function HistoryCard({
  history,
  entries,
  units,
}: {
  history: CycleDTO[];
  entries: MeasurementDTO[];
  units: UnitSystem;
}) {
  return (
    <div className="card mt-4">
      <h2 className="m-0 px-4 pt-4 text-sm font-semibold">History</h2>
      {history.length === 0 ? (
        <p className="m-0 px-4 pb-4 pt-3 text-sm text-dim">
          Previous phases will appear here.
        </p>
      ) : (
        <ul className="m-0 mt-3 list-none p-0">
          {history.map((c) => {
            const deltaKg =
              c.startWeightKg != null
                ? (endWeightKg(c, entries) ?? Number.NaN) - c.startWeightKg
                : Number.NaN;
            return (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-line px-4 py-2.5 last:border-b-0"
              >
                <PhaseLabel phase={c.phase} />
                <span className="text-xs text-dim">
                  {fmtDate(c.startDate)} – {fmtDate(c.endDate ?? c.startDate)}
                </span>
                <span className="num ml-auto text-sm">
                  {fmtSignedKg(Number.isNaN(deltaKg) ? null : deltaKg, units)}
                </span>
                <span className="num text-xs text-dim">
                  {c.kcalTargetPerDay != null
                    ? `${c.kcalTargetPerDay} kcal`
                    : "—"}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
