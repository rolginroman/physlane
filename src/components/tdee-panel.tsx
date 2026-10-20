import { useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { saveSettings } from "#/lib/auth-guard.fns";
import {
  applyMeasuredTarget,
  dismissTargetPrompt,
} from "#/server/target-prompt.fns";
import { daysToTight } from "#/lib/band";
import { normalizeTargetKcal } from "#/lib/kcal-start";
import { leanMassStatus } from "#/lib/lean-mass";
import { fmtKcal, tdeeEnergyCopy } from "#/lib/adherence";
import { verdictCopy } from "#/lib/projection";
import { fmtWeight, kgToLb, type UnitSystem } from "#/lib/units";
import type { ProjectionDTO, TdeeStatusResult } from "#/server/intake.fns";
import type { MeasurementDTO } from "#/server/measurements.fns";

type Props = {
  status: TdeeStatusResult;
  streak: number;
  plan: "free" | "pro";
  onGlp1: boolean;
  targetKcalPerDay: number | null;
  entries: MeasurementDTO[];
  units: UnitSystem;
};

const MINUS_SIGN = "−" as const;

/** Signed weight delta in display units, e.g. −1.8 kg / +4.0 lb. */
function fmtSignedDelta(kg: number, units: UnitSystem): string {
  const v = units === "metric" ? kg : kgToLb(kg);
  const sign = v > 0 ? "+" : v < 0 ? MINUS_SIGN : "";
  return `${sign}${Math.abs(v).toFixed(1)} ${units === "metric" ? "kg" : "lb"}`;
}

/** Verdict weight: text is the signal, color follows the chart semantics. */
const VERDICT_TEXT: Record<string, string> = {
  "on-pace": "text-text",
  "too-fast": "text-text",
  "too-slow": "text-text",
};

/** F11 (Pro): forward weight at current intake + pace verdict vs cycle target. */
function ProjectionBlock({
  p,
  units,
}: {
  p: ProjectionDTO;
  units: UnitSystem;
}) {
  const verdict = p.verdict ? verdictCopy(p.verdict, p.phase) : null;
  return (
    <div className="mt-3 border-t border-line pt-3">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className="text-xs text-dim">At current intake, in 4 weeks:</span>
        <span className="num text-lg font-medium">
          {fmtWeight(p.projectedWeightKg4w, units)}{" "}
          <span className="text-sm text-dim">
            ({fmtSignedDelta(p.projectedDeltaKg4w, units)})
          </span>
        </span>
      </div>
      {p.verdict && verdict && (
        <>
          <p
            className={`num m-0 mt-1.5 text-sm ${VERDICT_TEXT[p.verdict.kind]}`}
          >
            {verdict.headline}
          </p>
          {verdict.body && (
            <p className="m-0 mt-1 text-xs text-dim">{verdict.body}</p>
          )}
        </>
      )}
    </div>
  );
}

/** Shared streak chip: accent only once the habit milestone (7 days) is hit. */
export function StreakChip({ streak }: { streak: number }) {
  return (
    <span
      className={`num inline-flex min-h-8 items-center rounded-full border px-2.5 text-xs ${
        streak >= 7 ? "border-accent/60 text-accent" : "border-line text-dim"
      }`}
    >
      {streak > 0 ? `${streak}-day streak` : "No streak yet"}
    </span>
  );
}

/** 44px-hit switch (visual track 24px, padded hit area via ::before). */
function Switch({
  checked,
  disabled,
  onToggle,
  label,
}: {
  checked: boolean;
  disabled: boolean;
  onToggle: () => void;
  label: string;
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
        checked ? "border-accent/60 bg-accent/15" : "border-line bg-surface2"
      } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
    >
      <span
        className={`ml-0.5 h-5 w-5 rounded-full transition-transform duration-150 ease-out ${
          checked ? "translate-x-5 bg-accent" : "translate-x-0 bg-dim"
        }`}
      />
    </button>
  );
}

/**
 * G1.3: the band's narrowing bar. Width is the tightness percent; the label is
 * supplied by the caller because free and Pro frame it differently. Never
 * carries a kcal figure by itself.
 */
function BandBar({ confidence, label }: { confidence: number; label: string }) {
  const pct = Math.round(confidence * 100);
  return (
    <div className="mt-2.5">
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label="Estimate tightness"
        className="h-1.5 w-full overflow-hidden rounded-full bg-surface2"
      >
        <div
          className="h-full rounded-full bg-accent"
          style={{ width: `${Math.max(4, pct)}%` }}
        />
      </div>
      <p className="m-0 mt-1.5 text-xs text-dim">{label}</p>
    </div>
  );
}

/** Tightness copy shared by both plans: percent now, days left to full precision. */
function tightnessLabel(
  confidence: number,
  pairs: number,
  prefix: "pro" | "free",
): string {
  const pct = Math.round(confidence * 100);
  const remaining = daysToTight(pairs);
  if (prefix === "pro") {
    return remaining > 0
      ? `Your estimate is ${pct}% tight · measured from your logs, ${pairs} days · ${remaining} more days to full precision`
      : `Your estimate is ${pct}% tight · measured from your logs, ${pairs} days`;
  }
  return remaining > 0
    ? `Your estimate is ${pct}% tight · ${remaining} more days to full precision`
    : `Your estimate is ${pct}% tight and keeps refining with every log`;
}

/** G3.2 (Pro): the day-14 follow-the-measurement card. */
function TargetPromptCard({
  measuredKcal,
  targetKcalPerDay,
  onDone,
}: {
  measuredKcal: number;
  targetKcalPerDay: number | null;
  onDone: () => Promise<void>;
}) {
  const [pending, setPending] = useState<"apply" | "dismiss" | null>(null);
  const applied = normalizeTargetKcal(measuredKcal);

  async function act(kind: "apply" | "dismiss") {
    if (pending) return;
    setPending(kind);
    try {
      if (kind === "apply") await applyMeasuredTarget();
      else await dismissTargetPrompt();
      await onDone();
    } catch {
      // Write failed; the card re-renders from server state after reload.
    } finally {
      setPending(null);
    }
  }

  return (
    <div
      role="status"
      className="mt-3 rounded-lg border border-accent/50 bg-accent/5 px-3 py-2.5"
    >
      <p className="num m-0 text-sm text-text">
        Your logs say you burn about {fmtKcal(measuredKcal)}
        {targetKcalPerDay != null ? (
          <> a day. Your target assumes {fmtKcal(targetKcalPerDay)}.</>
        ) : (
          <> a day.</>
        )}{" "}
        Follow the measurement?
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => act("apply")}
          disabled={pending != null}
          className="btn-primary inline-flex min-h-9 items-center rounded-md px-3 text-sm disabled:opacity-60"
        >
          {pending === "apply" ? "Applying" : `Apply ${fmtKcal(applied)}`}
        </button>
        <button
          type="button"
          onClick={() => act("dismiss")}
          disabled={pending != null}
          className="inline-flex min-h-9 items-center rounded-md border border-line px-3 text-sm font-medium text-dim hover:text-text disabled:opacity-60"
        >
          Keep mine
        </button>
      </div>
    </div>
  );
}

function Glp1Row({ plan, onGlp1 }: { plan: "free" | "pro"; onGlp1: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (plan !== "pro" || pending) return;
    setPending(true);
    try {
      await saveSettings({ data: { onGlp1: !onGlp1 } });
      await router.invalidate();
    } catch {
      // Settings write failed; the switch reflects the server state after reload.
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-4 flex items-center gap-3 border-t border-line pt-3">
      <div className="min-w-0 flex-1">
        <p className="m-0 text-sm font-medium text-text">
          GLP-1 mode
          {plan !== "pro" && (
            <span className="ml-2 rounded border border-line px-1 py-0.5 text-[0.6875rem] font-semibold tracking-wide text-dim">
              PRO
            </span>
          )}
        </p>
        <p className="m-0 mt-0.5 text-xs text-dim">
          Swaps deficit targets for protein-first guidance and lean-mass watch.
        </p>
      </div>
      {plan === "pro" ? (
        <Switch
          checked={onGlp1}
          disabled={pending}
          onToggle={toggle}
          label="GLP-1 mode"
        />
      ) : (
        <Link
          to="/billing"
          className="inline-flex min-h-11 items-center rounded-md px-2.5 text-sm font-medium text-accent hover:text-accent-dim"
        >
          Upgrade
        </Link>
      )}
    </div>
  );
}

export function TdeePanel({
  status,
  streak,
  plan,
  onGlp1,
  targetKcalPerDay,
  entries,
  units,
}: Props) {
  const router = useRouter();
  const risk = leanMassStatus(entries);
  const energy = tdeeEnergyCopy({
    tdeeKcal: status.status === "ready" ? (status.kcal ?? 0) : 0,
    targetKcalPerDay,
    onGlp1,
  });
  const wRate = risk.rates.weightKgPerWeek ?? 0;
  const refresh = async () => {
    await router.invalidate();
  };

  return (
    <section className="card mt-4 p-4 sm:p-5" aria-label="Adaptive TDEE">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-base font-semibold">Adaptive TDEE</h2>
        <StreakChip streak={streak} />
      </div>

      {status.status === "collecting" && (
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
              style={{
                width: `${Math.max(4, Math.round((status.pairs / status.needed) * 100))}%`,
              }}
            />
          </div>
          <p className="num m-0 mt-2 text-sm text-text">
            Collecting data: {status.pairs} of {status.needed} days
          </p>
          <p className="m-0 mt-1 text-xs text-dim">
            Log intake and a same-day weight. The estimate builds from your own
            series, not a formula.
          </p>
        </div>
      )}

      {status.status === "ready" && status.gated && (
        <div className="mt-3">
          <p className="m-0 text-sm font-medium text-text">
            Your burn-rate estimate is ready.
          </p>
          <p className="m-0 mt-1 text-sm text-dim">
            Built from {status.pairs} days of your own weight + intake pairs.
            The 4-week projection and pace verdict are ready too.
          </p>
          <BandBar
            confidence={status.confidence}
            label={tightnessLabel(status.confidence, status.pairs, "free")}
          />
          {status.driftFired && (
            <p className="m-0 mt-3 rounded-lg border border-line bg-surface2 px-3 py-2.5 text-sm text-dim">
              Your weight trend and your logged intake disagree. Logs may be
              missing bites.
            </p>
          )}
          {status.targetPrompt.eligible && (
            <p className="m-0 mt-3 rounded-lg border border-line bg-surface2 px-3 py-2.5 text-sm text-dim">
              Your logs and your daily target have drifted apart. Pro shows the
              measured number and realigns your target in one tap.
            </p>
          )}
          <Link to="/billing" className="btn-primary mt-3 no-underline">
            Unlock with Pro
          </Link>
          <p className="hint">
            Pro reveals the number, its spread, the projection, and the verdict.
            $10/mo or $100/yr.
          </p>
        </div>
      )}

      {status.status === "ready" && !status.gated && status.kcal != null && (
        <div className="mt-3">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="num text-3xl font-semibold tracking-tight">
              {fmtKcal(status.kcal)}{" "}
              <span className="text-xl">± {fmtKcal(status.bandKcal)}</span>
            </span>
            <span className="text-sm text-dim">kcal per day</span>
          </div>
          <BandBar
            confidence={status.confidence}
            label={tightnessLabel(status.confidence, status.pairs, "pro")}
          />
          <p className="m-0 mt-1.5 text-xs text-faint">
            Adaptive estimate from your same-day weight + intake, smoothed
            weekly. The band narrows as the weeks agree.
          </p>
          {status.drift != null && (
            <div
              role="status"
              className="mt-3 rounded-lg border border-line bg-surface2 px-3 py-2.5"
            >
              <p className="num m-0 text-sm text-text">
                {status.drift.direction === "under"
                  ? `Your weight trend says the deficit is about ${fmtKcal(status.drift.impliedKcalPerDay)} kcal a day bigger than your logs do.`
                  : `Your weight trend says the surplus is about ${fmtKcal(status.drift.impliedKcalPerDay)} kcal a day bigger than your logs do.`}
              </p>
              <p className="m-0 mt-1 text-xs text-dim">
                {status.drift.direction === "under"
                  ? "Logs and scale cannot both be right. Some days are probably going unlogged; weigh what you eat for a week."
                  : "Logs and scale cannot both be right. More is going in than the logs show; weigh what you eat for a week."}
              </p>
            </div>
          )}
          {energy && (
            <div className="mt-3">
              <p className="m-0 text-sm text-text">{energy.headline}</p>
              {energy.body && (
                <p className="m-0 mt-1 text-sm text-dim">{energy.body}</p>
              )}
            </div>
          )}
          {status.targetPrompt.eligible &&
            status.targetPrompt.measuredKcal != null && (
              <TargetPromptCard
                measuredKcal={status.targetPrompt.measuredKcal}
                targetKcalPerDay={targetKcalPerDay}
                onDone={refresh}
              />
            )}
          {status.projection && (
            <ProjectionBlock p={status.projection} units={units} />
          )}
          {onGlp1 && risk.atRisk && (
            <div
              role="status"
              className="mt-3 rounded-lg border border-danger/50 bg-danger/5 px-3 py-2.5"
            >
              <p className="num m-0 text-sm text-danger">
                Losing {Math.abs(wRate).toFixed(1)} kg per week with a near-flat
                waist.
              </p>
              <p className="m-0 mt-1 text-xs text-dim">
                That pattern can mean muscle loss. Keep protein high and
                consider slowing the rate. Heuristic, not medical advice.
              </p>
            </div>
          )}
        </div>
      )}

      <Glp1Row plan={plan} onGlp1={onGlp1} />
    </section>
  );
}
