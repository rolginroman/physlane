import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { getActiveCycle } from "#/server/cycles.fns";
import {
  getIntakeStreak,
  intakeRange,
  upsertIntake,
  type DailyIntakeDTO,
} from "#/server/intake.fns";
import { getViewer } from "#/lib/auth-guard.fns";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { Button } from "#/components/ui/button";
import { StreakChip } from "#/components/tdee-panel";
import {
  addDays,
  adherence7d,
  buildStrip,
  fmtKcal,
  intakeWeekCopy,
  type Phase,
} from "#/lib/adherence";
import { isAppErrorCode } from "#/lib/app-error";
import {
  KCAL_MAX,
  KCAL_MIN,
  PROTEIN_MAX,
  PROTEIN_MIN,
} from "#/lib/intake-logic";

export const Route = createFileRoute("/_auth/intake")({
  head: () => ({ meta: [{ title: "Intake · physlane" }] }),
  loader: async () => {
    const today = new Date().toISOString().slice(0, 10);
    const [week, cycle, viewer, streak] = await Promise.all([
      intakeRange({ data: { from: addDays(today, -6), to: today } }),
      getActiveCycle(),
      getViewer(),
      getIntakeStreak(),
    ]);
    return {
      today,
      week,
      targetKcalPerDay: cycle?.kcalTargetPerDay ?? null,
      phase: (cycle?.phase ?? null) as Phase | null,
      onGlp1: viewer?.onGlp1 ?? false,
      streak: streak.streak,
    };
  },
  component: IntakePage,
});

const weekday = (date: string, style: "short" | "long") =>
  new Intl.DateTimeFormat("en-US", { weekday: style, timeZone: "UTC" }).format(
    Date.parse(`${date}T00:00:00Z`),
  );

const monthDay = (date: string) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(Date.parse(`${date}T00:00:00Z`));

const INTAKE_SAVE_FALLBACK = "Could not save. Check the numbers and try again.";

function intakeSaveErrorCopy(err: unknown): string {
  const message = err instanceof Error ? err.message : "";
  if (!isAppErrorCode(message)) {
    return INTAKE_SAVE_FALLBACK;
  }
  if (message === "INVALID_KCAL") {
    return "Enter calories as a whole number from 0 to 20000.";
  }
  if (message === "INVALID_PROTEIN") {
    return "Enter protein as whole grams, from 0 to 600.";
  }
  if (message === "INVALID_DATE") {
    return INTAKE_SAVE_FALLBACK;
  }
  return INTAKE_SAVE_FALLBACK;
}

const CELL_VALUE: Record<string, string> = {
  hit: "text-foreground",
  off: "text-secondary",
  logged: "text-foreground",
  missed: "text-muted-foreground",
  pending: "text-brand-text",
};

function IntakePage() {
  const { today, week, targetKcalPerDay, phase, onGlp1, streak } =
    Route.useLoaderData();
  const router = useRouter();

  // Strip mirrors the loader data; saves update it instantly, then invalidate refreshes the rest.
  const [rows, setRows] = useState<DailyIntakeDTO[]>(week);
  useEffect(() => setRows(week), [week]);

  const [selected, setSelected] = useState(today);
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [touched, setTouched] = useState({ kcal: false, protein: false });
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const savedTimer = useRef<number | null>(null);

  const row = rows.find((r) => r.date === selected) ?? null;

  // Seed the form whenever the selected day (or its saved row) changes.
  useEffect(() => {
    setKcal(row?.kcal != null ? String(row.kcal) : "");
    setProtein(row?.proteinG != null ? String(row.proteinG) : "");
    setTouched({ kcal: false, protein: false });
    setServerError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, row]);

  useEffect(() => {
    return () => {
      if (savedTimer.current != null) window.clearTimeout(savedTimer.current);
    };
  }, []);

  const strip = useMemo(
    () => buildStrip(rows, { today, targetKcalPerDay, phase }),
    [rows, today, targetKcalPerDay, phase],
  );
  const stats = useMemo(
    () => adherence7d(strip, targetKcalPerDay),
    [strip, targetKcalPerDay],
  );
  const copy = intakeWeekCopy({ stats, targetKcalPerDay, onGlp1 });

  const kcalError = (() => {
    if (kcal.trim() === "")
      return "Enter calories, a whole number from 0 to 20000.";
    const n = Number(kcal);
    if (!Number.isInteger(n) || n < KCAL_MIN || n > KCAL_MAX) {
      return "Enter calories as a whole number from 0 to 20000.";
    }
    return undefined;
  })();

  const proteinError = (() => {
    if (protein.trim() === "") return undefined;
    const n = Number(protein);
    if (!Number.isInteger(n) || n < PROTEIN_MIN || n > PROTEIN_MAX) {
      return "Enter protein as whole grams, from 0 to 600.";
    }
    return undefined;
  })();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setTouched({ kcal: true, protein: true });
    if (kcalError || proteinError) return;
    setPending(true);
    setServerError(null);
    try {
      const kcalNum = Number(kcal);
      const proteinG = protein.trim() === "" ? null : Number(protein);
      await upsertIntake({ data: { date: selected, kcal: kcalNum, proteinG } });
      setRows((rs) => {
        const next = rs.filter((r) => r.date !== selected);
        next.push({ date: selected, kcal: kcalNum, proteinG });
        return next.sort((a, b) => (a.date < b.date ? -1 : 1));
      });
      setSaved(true);
      if (savedTimer.current != null) window.clearTimeout(savedTimer.current);
      savedTimer.current = window.setTimeout(() => setSaved(false), 2000);
      void router.invalidate();
    } catch (err) {
      setServerError(intakeSaveErrorCopy(err));
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="pt-8">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h1 className="m-0 text-xl font-semibold tracking-tight">Intake</h1>
        <StreakChip streak={streak} />
        {targetKcalPerDay != null && (
          <span className="num inline-flex min-h-8 items-center rounded-full border border-border bg-card px-3 py-1 text-xs text-secondary">
            Target {fmtKcal(targetKcalPerDay)} kcal
          </span>
        )}
        {onGlp1 && (
          <span className="inline-flex min-h-8 items-center rounded-full border border-border bg-card px-3 py-1 text-xs text-secondary">
            GLP-1 mode
          </span>
        )}
      </div>

      <form onSubmit={onSubmit} noValidate className="card mt-4 p-4 sm:p-5">
        <div className="flex min-h-11 flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 text-base font-semibold">
            {selected === today
              ? `Today, ${monthDay(selected)}`
              : `${weekday(selected, "long")}, ${monthDay(selected)}`}
          </h2>
          {selected !== today && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setSelected(today)}
              className="min-h-11 px-2.5"
            >
              Jump to today
            </Button>
          )}
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="intake-kcal">Calories (kcal)</Label>
            <Input
              id="intake-kcal"
              className="num"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="e.g. 2150"
              value={kcal}
              onChange={(e) => setKcal(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, kcal: true }))}
              aria-invalid={touched.kcal && kcalError ? true : undefined}
            />
            {touched.kcal && kcalError && (
              <p className="field-error" role="alert">
                {kcalError}
              </p>
            )}
          </div>
          <div>
            <Label htmlFor="intake-protein">Protein (g, optional)</Label>
            <Input
              id="intake-protein"
              className="num"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="e.g. 140"
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, protein: true }))}
              aria-invalid={touched.protein && proteinError ? true : undefined}
            />
            {touched.protein && proteinError && (
              <p className="field-error" role="alert">
                {proteinError}
              </p>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            className="min-h-11 font-semibold"
            disabled={pending}
          >
            {pending ? "Saving…" : row?.kcal != null ? "Update day" : "Log day"}
          </Button>
          {saved && !pending && (
            <span role="status" className="text-sm text-brand-text">
              Saved
            </span>
          )}
          {serverError && (
            <p className="m-0 text-sm text-danger" role="alert">
              {serverError}
            </p>
          )}
        </div>
      </form>

      <div className="mt-4">
        <div className="flex items-baseline justify-between">
          <h2 className="m-0 text-base font-semibold">Last 7 days</h2>
          {stats.pct != null && (
            <p className="num m-0 text-sm text-secondary">
              {stats.pct}% adherence
            </p>
          )}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-px rounded-xl border border-border bg-border">
          {strip.map((d) => {
            const isSelected = d.date === selected;
            const label = `${weekday(d.date, "long")} ${Number(d.date.slice(8, 10))}: ${
              d.kcal != null
                ? `${fmtKcal(d.kcal)} kcal`
                : d.isToday
                  ? "not logged yet"
                  : "missed"
            }${d.proteinG != null ? `, ${d.proteinG} g protein` : ""}`;
            return (
              <button
                key={d.date}
                type="button"
                onClick={() => setSelected(d.date)}
                aria-pressed={isSelected}
                aria-label={label}
                className={`flex min-h-[4.25rem] flex-col items-center justify-center gap-0.5 bg-card px-0.5 py-2 text-center transition-colors duration-150 ease-out first:rounded-l-[11px] last:rounded-r-[11px] ${
                  d.isToday ? "bg-muted" : ""
                } ${isSelected ? "ring-1 ring-inset ring-brand-text" : "hover:bg-muted"}`}
              >
                <span className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground">
                  {weekday(d.date, "short")}
                </span>
                <span className={`num text-sm ${CELL_VALUE[d.state]}`}>
                  {d.kcal != null ? fmtKcal(d.kcal) : d.isToday ? "Log" : "—"}
                </span>
                {d.proteinG != null ? (
                  <span className="num text-[0.625rem] text-muted-foreground">
                    {d.proteinG}g
                  </span>
                ) : (
                  <span
                    aria-hidden="true"
                    className="text-[0.625rem] text-transparent"
                  >
                    ·
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <p className="mt-3 mb-0 text-sm text-foreground">{copy.main}</p>
        {copy.note && (
          <p className="mt-1 mb-0 text-xs text-muted-foreground">{copy.note}</p>
        )}
      </div>

      <p className="mt-6 mb-0 text-xs text-muted-foreground">
        One number a day. No food database, no barcode, ever.
      </p>
    </section>
  );
}
