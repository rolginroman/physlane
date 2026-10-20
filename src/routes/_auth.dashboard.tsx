import { createFileRoute, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getActiveCycle, hasAnyCycle } from "#/server/cycles.fns";
import {
  latestMeasurement,
  listMeasurements,
  type MeasurementDTO,
} from "#/server/measurements.fns";
import { getIntakeStreak, intakeRange, tdeeStatus } from "#/server/intake.fns";
import { getViewer } from "#/lib/auth-guard.fns";
import { navyBodyFat } from "#/lib/navy-bf";
import {
  haptic,
  hideMainButton,
  isTelegram,
  showMainButton,
} from "#/lib/telegram-web";
import { useTelegramMode } from "#/lib/telegram-mode";
import MeasurementForm from "#/components/MeasurementForm";
import HistoryTable from "#/components/HistoryTable";
import TrendChart from "#/components/TrendChart";
import TdeePanel from "#/components/TdeePanel";
import PhaseLabel from "#/components/PhaseLabel";
import {
  fmtLength,
  fmtWeight,
  formatWeightRate,
  kgToLb,
  type UnitSystem,
} from "#/lib/units";

export const Route = createFileRoute("/_auth/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard · physlane" }] }),
  beforeLoad: async () => {
    const any = await hasAnyCycle();
    if (!any) throw redirect({ to: "/onboarding" });
  },
  loader: async () => {
    const today = new Date().toISOString().slice(0, 10);
    const [entries, latest, cycle, viewer, tdee, streak, intakeToday] =
      await Promise.all([
        listMeasurements(),
        latestMeasurement(),
        getActiveCycle(),
        getViewer(),
        tdeeStatus(),
        getIntakeStreak(),
        intakeRange({ data: { from: today, to: today } }),
      ]);
    const units: UnitSystem = viewer?.unitSystem ?? "metric";
    const heightCm = viewer?.heightCm ?? null;
    const sex = viewer?.sex ?? null;
    return {
      entries,
      latest,
      cycle,
      units,
      tdee,
      streak: streak.streak,
      plan: viewer?.plan ?? "free",
      onGlp1: viewer?.onGlp1 ?? false,
      heightCm,
      sex,
      today,
      kcalToday: intakeToday.find((d) => d.date === today)?.kcal ?? null,
    };
  },
  component: DashboardPage,
});

const WEEK_MS = 7 * 86_400_000;

function lastWhere(
  entries: MeasurementDTO[],
  pred: (e: MeasurementDTO) => boolean,
) {
  for (let i = entries.length - 1; i >= 0; i--) {
    if (pred(entries[i])) return entries[i];
  }
  return null;
}

/** Latest weight minus the newest weight at least 7 days older. Null when there is no pair. */
function delta7dKg(entries: MeasurementDTO[]): number | null {
  const cur = lastWhere(entries, (e) => e.weightKg != null);
  if (!cur || cur.weightKg == null) return null;
  const cutoff = new Date(cur.takenAt).getTime() - WEEK_MS;
  const ref = lastWhere(
    entries,
    (e) => e.weightKg != null && new Date(e.takenAt).getTime() <= cutoff,
  );
  if (!ref || ref.weightKg == null) return null;
  return cur.weightKg - ref.weightKg;
}

const SIGN = { minus: "−" as const, plus: "+" as const };

function fmtSignedWeight(kg: number | null, units: UnitSystem): string {
  if (kg == null) return "—";
  const v = units === "metric" ? kg : kgToLb(kg);
  const sign = v > 0 ? SIGN.plus : v < 0 ? SIGN.minus : "";
  return `${sign}${Math.abs(v).toFixed(1)} ${units === "metric" ? "kg" : "lb"}`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 bg-surface px-4 py-3">
      <p className="m-0 text-xs text-dim">{label}</p>
      <p className="num m-0 mt-1 truncate text-base font-medium">{value}</p>
    </div>
  );
}

function DashboardPage() {
  const {
    entries,
    latest,
    cycle,
    units,
    tdee,
    streak,
    plan,
    onGlp1,
    heightCm,
    sex,
    today,
    kcalToday,
  } = Route.useLoaderData();
  const [editing, setEditing] = useState<MeasurementDTO | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const tgMode = useTelegramMode();
  // Set after a successful save inside Telegram: hides the MainButton for
  // this visit so it does not nag while the day's second number is pending.
  const [tgLogged, setTgLogged] = useState(false);
  const [loggedFlash, setLoggedFlash] = useState(false);

  const newestFirst = useMemo(() => [...entries].reverse(), [entries]);
  const latestWeight = lastWhere(entries, (e) => e.weightKg != null);
  const latestWaist = lastWhere(entries, (e) => e.waistCm != null);
  const delta = delta7dKg(entries);
  const weightLoggedToday = entries.some(
    (e) => e.takenAt.slice(0, 10) === today && e.weightKg != null,
  );
  const bothLoggedToday = weightLoggedToday && kcalToday != null;

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
  );

  const handleEdit = useCallback((entry: MeasurementDTO) => {
    setEditing(entry);
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    formRef.current?.scrollIntoView({
      behavior: prefersReduced ? "auto" : "smooth",
      block: "start",
    });
  }, []);

  /** Telegram MainButton tap: bring the quick-log form into view and focus weight. */
  const focusQuickLog = useCallback(() => {
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    formRef.current?.scrollIntoView({
      behavior: prefersReduced ? "auto" : "smooth",
      block: "start",
    });
    // MeasurementForm's weight input has a stable id; focusing also scrolls.
    document.getElementById("m-weight")?.focus();
  }, []);

  // Telegram 'Log today' MainButton while today's weight or kcal is still
  // missing. Subscribe/unsubscribe via the returned cleanup (hides + unregs).
  useEffect(() => {
    if (!tgMode || bothLoggedToday || tgLogged) return;
    return showMainButton("Log today", focusQuickLog);
  }, [tgMode, bothLoggedToday, tgLogged, focusQuickLog]);

  /** Any successful save from the quick-log form, Telegram side effects only. */
  const handleLogged = useCallback(() => {
    if (!isTelegram()) return;
    haptic("success");
    hideMainButton();
    setTgLogged(true);
    setLoggedFlash(true);
    window.setTimeout(() => setLoggedFlash(false), 2000);
  }, []);

  return (
    <section className="pt-8">
      {/* Title row, then cycle summary row; side by side from sm up. */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-x-4">
        <h1 className="m-0 text-xl font-semibold tracking-tight">Dashboard</h1>
        {cycle ? (
          <p className="m-0 flex flex-wrap items-baseline gap-x-2 text-sm text-text-muted">
            <PhaseLabel phase={cycle.phase} />
            {cycle.targetRateKgPerWeek != null && (
              <span className="num whitespace-nowrap">
                {formatWeightRate(cycle.targetRateKgPerWeek, units)}
              </span>
            )}
            {cycle.kcalTargetPerDay != null && (
              <>
                <span aria-hidden="true">·</span>
                <span className="num whitespace-nowrap">
                  {cycle.kcalTargetPerDay} kcal
                </span>
              </>
            )}
          </p>
        ) : (
          <p className="m-0 text-sm text-text-muted">No active cycle</p>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
        <Stat
          label="Latest weight"
          value={fmtWeight(latestWeight?.weightKg ?? null, units)}
        />
        <Stat label="Δ 7d" value={fmtSignedWeight(delta, units)} />
        <Stat
          label="Latest waist"
          value={fmtLength(latestWaist?.waistCm ?? null, units)}
        />
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
        {loggedFlash && (
          <p role="status" className="m-0 mb-2 text-xs text-dim">
            Logged.
          </p>
        )}
        <MeasurementForm
          units={units}
          editing={editing}
          onEditDone={() => setEditing(null)}
          onSaved={handleLogged}
          lastWeightKg={latest?.weightKg ?? null}
        />
      </div>

      <HistoryTable entries={newestFirst} units={units} onEdit={handleEdit} />

      <p className="mt-6 mb-0 text-xs text-faint">
        Only manual numbers are stored. No integrations, ever.
      </p>
    </section>
  );
}
