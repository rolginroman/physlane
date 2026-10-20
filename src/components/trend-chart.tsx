import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
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
} from "recharts";
import type { MeasurementDTO } from "#/server/measurements.fns";
import type { CycleDTO } from "#/server/cycles.fns";
import {
  FIELD_LABELS,
  cmToIn,
  formatGirth,
  fmtWeight,
  kgToLb,
  type MeasurementField,
  type UnitSystem,
} from "#/lib/units";

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

const SERIES_COLOR = "var(--color-ink)";
const WAIST_OVERLAY_COLOR = "var(--color-chart-neutral)";
const SURFACE_COLOR = "var(--color-surface)";
const TARGET_COLOR = "var(--color-text-muted)";
const GRID_COLOR = "var(--color-chart-grid)";
const AXIS_TICK_COLOR = "var(--color-text-secondary)";
const CURSOR_COLOR = "var(--color-border)";

type RangeId = "14d" | "30d" | "90d" | "all";

const RANGES: {
  id: RangeId;
  label: string;
  days: number | null;
  aria: string;
}[] = [
  { id: "14d", label: "14d", days: 14, aria: "last 14 days" },
  { id: "30d", label: "30d", days: 30, aria: "last 30 days" },
  { id: "90d", label: "90d", days: 90, aria: "last 90 days" },
  { id: "all", label: "All", days: null, aria: "all time" },
];

function rangeForId(id: RangeId) {
  const found = RANGES.find((r) => r.id === id);
  if (found) return found;
  const fallback = RANGES.find((r) => r.id === "30d");
  if (fallback) return fallback;
  throw new Error("RANGES misconfigured");
}

function siteDefForId(id: SiteId) {
  const found = SITES.find((s) => s.id === id);
  if (found) return found;
  const fallback = SITES.find((s) => s.id === "weight");
  if (fallback) return fallback;
  throw new Error("SITES misconfigured");
}

/** Chartable sites. Weight keeps its special target projection; girths have none. */
type SiteId =
  | "weight"
  | "waist"
  | "neck"
  | "chest"
  | "hips"
  | "armL"
  | "armR"
  | "thighL"
  | "thighR"
  | "calf";

const SITES: { id: SiteId; field: MeasurementField; color: string }[] = [
  { id: "weight", field: "weightKg", color: SERIES_COLOR },
  { id: "waist", field: "waistCm", color: SERIES_COLOR },
  { id: "neck", field: "neckCm", color: SERIES_COLOR },
  { id: "chest", field: "chestCm", color: SERIES_COLOR },
  { id: "hips", field: "hipsCm", color: SERIES_COLOR },
  { id: "armL", field: "armLeftCm", color: SERIES_COLOR },
  { id: "armR", field: "armRightCm", color: SERIES_COLOR },
  { id: "thighL", field: "thighLeftCm", color: SERIES_COLOR },
  { id: "thighR", field: "thighRightCm", color: SERIES_COLOR },
  { id: "calf", field: "calfCm", color: SERIES_COLOR },
];

/** Deterministic (UTC, fixed locale) so SSR and client render the same string. */
const dayMonth = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});
const fmtDay = (ms: number) => dayMonth.format(new Date(ms));

type Row = {
  t: number;
  weight: number | null; // weight series (kg)
  waist: number | null; // waist series when shown alongside weight (cm)
  girth: number | null; // selected girth series (cm)
  target: number | null; // weight target projection (kg)
};

type SeriesKey = "weight" | "waist" | "girth";
type Series = {
  key: SeriesKey;
  label: string;
  color: string;
  kind: "weight" | "girth";
};

type Props = {
  entries: MeasurementDTO[]; // oldest first
  cycle: CycleDTO | null;
  units: UnitSystem;
  plan: "free" | "pro";
  /** Navy body-fat estimate for the latest measurement, precomputed by the page. Null → no chip. */
  bodyFatPercent?: number | null;
};

function domainOf(vals: number[]): [number, number] {
  if (vals.length === 0) return [0, 1];
  let min = Math.min(...vals);
  let max = Math.max(...vals);
  if (max - min < 0.5) {
    const mid = (min + max) / 2;
    min = mid - 1;
    max = mid + 1;
  }
  const pad = (max - min) * 0.12;
  return [min - pad, max + pad];
}

/**
 * One-row horizontal chip scroller. The scrollbar is hidden, the edge that
 * still has chips beyond it fades out, and the pressed chip is kept in view.
 */
function ChipScroller({
  label,
  activeKey,
  children,
}: {
  label: string;
  activeKey: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const firstScroll = useRef(true);
  const [edges, setEdges] = useState({ start: false, end: false });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () =>
      setEdges({
        start: el.scrollLeft > 1,
        end: el.scrollLeft + el.clientWidth < el.scrollWidth - 1,
      });
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    const el = ref.current;
    const chip = el?.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!el || !chip) return;
    // scrollTo on the row only: scrollIntoView would also move the page.
    const reduced = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    el.scrollTo({
      left: chip.offsetLeft - (el.clientWidth - chip.offsetWidth) / 2,
      behavior: firstScroll.current || reduced ? "auto" : "smooth",
    });
    firstScroll.current = false;
  }, [activeKey]);

  const fade = "1.5rem";
  const mask =
    edges.start || edges.end
      ? `linear-gradient(to right, ${edges.start ? "transparent" : "#000"}, #000 ${fade}, #000 calc(100% - ${fade}), ${edges.end ? "transparent" : "#000"})`
      : undefined;

  return (
    <div className="min-w-0 max-w-full overflow-hidden rounded-full border border-border bg-card">
      <div
        ref={ref}
        role="group"
        aria-label={label}
        className="relative flex snap-x snap-proximity scroll-px-1 items-center gap-1 overflow-x-auto p-1 [scrollbar-width:none]! [&::-webkit-scrollbar]:hidden"
        style={{ maskImage: mask, WebkitMaskImage: mask }}
      >
        {children}
      </div>
    </div>
  );
}

export function TrendChart({
  entries,
  cycle,
  units,
  plan,
  bodyFatPercent,
}: Props) {
  const [rangeId, setRangeId] = useState<RangeId>("30d");
  const [siteId, setSiteId] = useState<SiteId>("weight");
  const [mounted, setMounted] = useState(false);
  const [animate, setAnimate] = useState(true);

  useEffect(() => {
    setMounted(true);
    setAnimate(
      !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    );
  }, []);

  const range = rangeForId(rangeId);

  // Logged-point counts per site (all time) — a site needs ≥2 points to chart.
  const siteCounts = useMemo(() => {
    const counts = new Map<MeasurementField, number>();
    for (const site of SITES) {
      counts.set(
        site.field,
        entries.filter((e) => e[site.field] != null).length,
      );
    }
    return counts;
  }, [entries]);

  const enabled = useMemo(() => {
    const map = new Map<SiteId, boolean>();
    for (const site of SITES)
      map.set(site.id, (siteCounts.get(site.field) ?? 0) >= 2);
    return map;
  }, [siteCounts]);

  // Selection can only move to enabled pills; fall back off a disabled default.
  const site = useMemo(() => {
    if (enabled.get(siteId)) return siteId;
    return SITES.find((s) => enabled.get(s.id))?.id ?? "weight";
  }, [siteId, enabled]);

  const siteDef = siteDefForId(site);
  const isWeight = site === "weight";
  // Weight view keeps the dual render: weight plus waist once waist is chartable.
  const dualWaist = isWeight && (enabled.get("waist") ?? false);

  const { rows, showTarget, targetAt, series } = useMemo(() => {
    const now = Date.now();
    const cutoff = range.days != null ? now - range.days * DAY_MS : -Infinity;
    const inRange = entries.filter(
      (e) => new Date(e.takenAt).getTime() >= cutoff,
    );

    const series: Series[] = isWeight
      ? [
          {
            key: "weight",
            label: "Weight",
            color: SERIES_COLOR,
            kind: "weight",
          },
        ]
      : [
          {
            key: "girth",
            label: FIELD_LABELS[siteDef.field],
            color: siteDef.color,
            kind: "girth",
          },
        ];

    let rows: Row[] = [];
    let showTarget = false;
    let targetAt: ((t: number) => number) | null = null;

    if (isWeight) {
      // Target projection: y(t) = start + rate * (t - cycleStart) / week.
      const startKg = cycle?.startWeightKg;
      const rate = cycle?.targetRateKgPerWeek;
      const cycleStart =
        cycle?.startDate != null ? new Date(cycle.startDate).getTime() : null;
      const canProject =
        startKg != null &&
        rate != null &&
        cycleStart != null &&
        cycleStart <= now;
      targetAt = canProject
        ? (t: number) =>
            (startKg as number) +
            ((rate as number) * (t - (cycleStart as number))) / WEEK_MS
        : null;

      rows = inRange
        .filter((e) => e.weightKg != null || e.waistCm != null)
        .map((e) => ({
          t: new Date(e.takenAt).getTime(),
          weight: e.weightKg,
          waist: dualWaist ? e.waistCm : null,
          girth: null,
          target: null,
        }));

      if (dualWaist) {
        series.push({
          key: "waist",
          label: "Waist",
          color: WAIST_OVERLAY_COLOR,
          kind: "girth",
        });
      }

      if (targetAt) {
        const dataEnd = Math.max(now, ...rows.map((r) => r.t));
        const dataStart = Math.min(now, ...rows.map((r) => r.t));
        const t0 = Math.max(cycleStart as number, cutoff, dataStart);
        if (t0 < dataEnd) {
          showTarget = true;
          rows.push({
            t: t0,
            weight: null,
            waist: null,
            girth: null,
            target: targetAt(t0),
          });
          rows.push({
            t: dataEnd,
            weight: null,
            waist: null,
            girth: null,
            target: targetAt(dataEnd),
          });
          rows.sort((a, b) => a.t - b.t);
        }
      }
    } else {
      rows = inRange
        .filter((e) => e[siteDef.field] != null)
        .map((e) => ({
          t: new Date(e.takenAt).getTime(),
          weight: null,
          waist: null,
          girth: e[siteDef.field] as number,
          target: null,
        }));
    }

    return { rows, showTarget, targetAt, series };
  }, [entries, cycle, range.days, isWeight, dualWaist, siteDef]);

  const primaryVals = isWeight
    ? rows.filter((r) => r.weight != null).map((r) => r.weight as number)
    : rows.filter((r) => r.girth != null).map((r) => r.girth as number);
  const waistVals = rows
    .filter((r) => r.waist != null)
    .map((r) => r.waist as number);
  const targetVals = rows
    .filter((r) => r.target != null)
    .map((r) => r.target as number);

  // Chart geometry (stable across renders; explicit domains keep dots unclipped).
  const { xDomain, yDomain, waistDomain } = useMemo(() => {
    if (rows.length === 0) {
      return {
        xDomain: [0, 1] as [number, number],
        yDomain: [0, 1] as [number, number],
        waistDomain: [0, 1] as [number, number],
      };
    }
    const ts = rows.map((r) => r.t);
    let tMin = Math.min(...ts);
    let tMax = Math.max(...ts);
    if (tMax - tMin < DAY_MS) {
      const mid = (tMin + tMax) / 2;
      tMin = mid - DAY_MS / 2;
      tMax = mid + DAY_MS / 2;
    }
    const xPad = (tMax - tMin) * 0.03;
    return {
      xDomain: [tMin - xPad, tMax + xPad] as [number, number],
      yDomain: domainOf(primaryVals.concat(isWeight ? targetVals : [])),
      waistDomain: dualWaist
        ? domainOf(waistVals)
        : ([0, 1] as [number, number]),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, isWeight, dualWaist]);

  const enough = primaryVals.length >= 2;

  const summary = useMemo(() => {
    const label = FIELD_LABELS[siteDef.field];
    if (!enough) return `${label} trend, ${range.aria}`;
    const fmt = isWeight ? fmtWeight : formatGirth;
    return `${label} trend, ${range.aria}, ${fmt(Math.min(...primaryVals), units)} to ${fmt(
      Math.max(...primaryVals),
      units,
    )}${dualWaist && waistVals.length >= 2 ? `, waist ${formatGirth(Math.min(...waistVals), units)} to ${formatGirth(Math.max(...waistVals), units)}` : ""}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    enough,
    primaryVals,
    waistVals,
    range.aria,
    units,
    isWeight,
    dualWaist,
    siteDef,
  ]);

  const weightTick = (v: number) =>
    (units === "metric" ? v : kgToLb(v)).toFixed(1);
  const girthTick = (v: number) =>
    (units === "metric" ? v : cmToIn(v)).toFixed(1);
  const tickStyle = { fill: AXIS_TICK_COLOR, fontSize: 11, className: "num" };

  return (
    <div className="card mt-4 p-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="m-0 text-sm font-semibold">Trend</h2>
        {bodyFatPercent != null && (
          <>
            <span className="num inline-flex items-center rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              Body fat ~{bodyFatPercent.toFixed(1)}% (estimate)
            </span>
            <details className="text-xs text-muted-foreground">
              <summary className="inline-flex min-h-9 cursor-pointer select-none items-center hover:text-foreground">
                How is this estimated?
              </summary>
              <div className="mt-1 max-w-2xl rounded-lg border border-border bg-muted px-3 py-2">
                <p className="m-0">
                  Estimated with the US Navy circumference method. It turns your
                  height and the latest neck, waist and hips measurements into
                  body density, then body fat percent with the Siri equation:
                  495 / density − 450. All measurements in centimetres.
                </p>
                <p className="m-0 mt-1.5">
                  Density for men: 1.0324 − 0.19077 × log10(waist − neck) +
                  0.15456 × log10(height).
                </p>
                <p className="m-0 mt-1">
                  Density for women: 1.29579 − 0.35004 × log10(waist + hips −
                  neck) + 0.221 × log10(height).
                </p>
                <p className="m-0 mt-1.5 text-muted-foreground">
                  A rough estimate from tape measurements, not a
                  body-composition scan.
                </p>
              </div>
            </details>
          </>
        )}
        <p className="m-0 flex items-center gap-3 text-xs text-muted-foreground">
          {series.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block h-0.5 w-4 rounded-full"
                style={{ background: s.color }}
              />
              {s.label}
            </span>
          ))}
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
        <div className="flex w-full min-w-0 flex-col gap-2 sm:ml-auto sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          <ChipScroller label="Chart site" activeKey={site}>
            {SITES.map((s) => {
              const active = s.id === site;
              const isEnabled = enabled.get(s.id) ?? false;
              return (
                <button
                  key={s.id}
                  type="button"
                  aria-pressed={active}
                  disabled={!isEnabled}
                  title={
                    isEnabled
                      ? undefined
                      : `Needs at least two logged ${FIELD_LABELS[s.field].toLowerCase()} entries`
                  }
                  onClick={() => setSiteId(s.id)}
                  className={`relative inline-flex h-9 shrink-0 snap-start items-center whitespace-nowrap rounded-full px-3 text-xs font-medium transition-colors duration-150 ease-out after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] sm:h-7 sm:px-2 ${
                    active
                      ? "bg-muted text-foreground"
                      : isEnabled
                        ? "text-muted-foreground hover:text-foreground"
                        : "cursor-not-allowed text-muted-foreground opacity-50"
                  }`}
                >
                  {FIELD_LABELS[s.field]}
                </button>
              );
            })}
          </ChipScroller>
          <div
            role="group"
            aria-label="Trend range"
            className="grid w-full grid-cols-4 items-center gap-1 rounded-full border border-border bg-card p-1 sm:inline-flex sm:w-auto"
          >
            {RANGES.map((r) => {
              const active = r.id === rangeId;
              return (
                <button
                  key={r.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setRangeId(r.id)}
                  className={`relative inline-flex h-9 items-center justify-center rounded-full px-3 text-xs font-medium transition-colors duration-150 ease-out after:absolute after:inset-x-0 after:-inset-y-1 after:content-[''] ${
                    active
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/*
       * F12: the free plan's history is server-clamped to 90 days, so "All"
       * silently shows the same window as 90d for free users. Say why, and
       * where the full history lives, next to the chart where value is proven.
       */}
      {plan === "free" && rangeId === "all" && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-border bg-muted px-3 py-1">
          <p className="m-0 text-xs text-muted-foreground">
            Free plan sees the last 90 days here. Pro unlocks the full history.
          </p>
          <Link
            to="/billing"
            className="inline-flex min-h-11 items-center rounded-md px-1 text-sm font-medium text-brand-text hover:text-brand-hover"
          >
            Upgrade
          </Link>
        </div>
      )}

      <div
        className="mt-3"
        role="img"
        aria-label={summary}
        style={{ height: 260 }}
      >
        {!mounted ? (
          // Recharts renders client-only; hold the plot area until hydration.
          <div
            aria-hidden="true"
            className="h-full rounded-lg bg-muted motion-safe:animate-pulse"
          />
        ) : !enough ? (
          <div className="flex h-full items-center justify-center px-4 text-center">
            <p className="m-0 text-sm text-muted-foreground">
              {isWeight
                ? "Not enough data in this range. Log weigh-ins to build your trend."
                : `Not enough ${FIELD_LABELS[siteDef.field].toLowerCase()} entries in this range yet.`}
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart
              data={rows}
              margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
            >
              <CartesianGrid vertical={false} stroke={GRID_COLOR} />
              <XAxis
                dataKey="t"
                type="number"
                domain={xDomain}
                tickFormatter={fmtDay}
                tick={tickStyle}
                axisLine={{ stroke: GRID_COLOR }}
                tickLine={false}
                minTickGap={28}
              />
              {isWeight ? (
                <>
                  <YAxis
                    yAxisId="w"
                    domain={yDomain}
                    tickFormatter={weightTick}
                    tick={tickStyle}
                    axisLine={false}
                    tickLine={false}
                    width={44}
                  />
                  {dualWaist && (
                    <YAxis
                      yAxisId="g"
                      orientation="right"
                      domain={waistDomain}
                      tickFormatter={girthTick}
                      tick={tickStyle}
                      axisLine={false}
                      tickLine={false}
                      width={40}
                    />
                  )}
                </>
              ) : (
                <YAxis
                  yAxisId="g"
                  domain={yDomain}
                  tickFormatter={girthTick}
                  tick={tickStyle}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                />
              )}
              <Tooltip
                cursor={{ stroke: CURSOR_COLOR, strokeDasharray: "3 3" }}
                isAnimationActive={false}
                content={(tip) => (
                  <TrendTip
                    tip={tip}
                    units={units}
                    series={series}
                    targetAt={targetAt}
                    rows={rows}
                  />
                )}
              />
              {isWeight ? (
                <>
                  <Area
                    yAxisId="w"
                    dataKey="weight"
                    stroke="none"
                    fill={SERIES_COLOR}
                    fillOpacity={0.08}
                    isAnimationActive={false}
                    dot={false}
                    activeDot={false}
                    connectNulls
                    legendType="none"
                  />
                  <Line
                    yAxisId="w"
                    dataKey="weight"
                    stroke={SERIES_COLOR}
                    strokeWidth={2}
                    dot={{ r: 2, fill: SERIES_COLOR, strokeWidth: 0 }}
                    activeDot={{ r: 4, fill: SERIES_COLOR, strokeWidth: 0 }}
                    connectNulls
                    isAnimationActive={animate}
                    animationDuration={200}
                    legendType="none"
                  />
                  {dualWaist && (
                    <Line
                      yAxisId="g"
                      dataKey="waist"
                      stroke={WAIST_OVERLAY_COLOR}
                      strokeWidth={1.5}
                      dot={{
                        r: 2,
                        fill: SURFACE_COLOR,
                        stroke: WAIST_OVERLAY_COLOR,
                        strokeWidth: 1.5,
                      }}
                      activeDot={{
                        r: 4,
                        fill: SURFACE_COLOR,
                        stroke: WAIST_OVERLAY_COLOR,
                        strokeWidth: 1.5,
                      }}
                      connectNulls
                      isAnimationActive={animate}
                      animationDuration={200}
                      legendType="none"
                    />
                  )}
                  {showTarget && (
                    <Line
                      yAxisId="w"
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
                </>
              ) : (
                <>
                  <Area
                    yAxisId="g"
                    dataKey="girth"
                    stroke="none"
                    fill={siteDef.color}
                    fillOpacity={0.08}
                    isAnimationActive={false}
                    dot={false}
                    activeDot={false}
                    connectNulls
                    legendType="none"
                  />
                  <Line
                    yAxisId="g"
                    dataKey="girth"
                    stroke={siteDef.color}
                    strokeWidth={2}
                    dot={{ r: 2, fill: siteDef.color, strokeWidth: 0 }}
                    activeDot={{ r: 4, fill: siteDef.color, strokeWidth: 0 }}
                    connectNulls
                    isAnimationActive={animate}
                    animationDuration={200}
                    legendType="none"
                  />
                </>
              )}
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function TrendTip({
  tip,
  units,
  series,
  targetAt,
  rows,
}: {
  tip: TooltipContentProps;
  units: UnitSystem;
  series: Series[];
  targetAt: ((t: number) => number) | null;
  rows: Row[];
}) {
  if (!tip.active) return null;
  const label = tip.label as number;
  let row = tip.payload?.[0]?.payload as Row | undefined;
  // Hover can land on a target-only row (e.g. beyond the last weigh-in);
  // show the nearest row with real values instead of nothing.
  if (!row || (row.weight == null && row.waist == null && row.girth == null)) {
    const candidates = rows.filter(
      (r) => r.weight != null || r.waist != null || r.girth != null,
    );
    if (candidates.length === 0) return null;
    row = candidates.reduce((best, r) =>
      Math.abs(r.t - label) < Math.abs(best.t - label) ? r : best,
    );
  }
  const shown = series.filter((s) => row[s.key] != null);
  if (shown.length === 0) return null;
  const target = targetAt?.(row.t);
  return (
    <div className="rounded-lg border border-border bg-muted px-3 py-2 text-xs">
      <p className="m-0 text-muted-foreground">{fmtDay(row.t)}</p>
      {shown.map((s) => (
        <p key={s.key} className="num m-0 mt-1 flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="inline-block h-0.5 w-3 rounded-full"
            style={{ background: s.color }}
          />
          <span className="text-muted-foreground">{s.label}</span>
          {s.kind === "weight"
            ? fmtWeight(row[s.key] as number, units)
            : formatGirth(row[s.key] as number, units)}
        </p>
      ))}
      {targetAt && target != null && (
        <p className="num m-0 mt-0.5 flex items-center gap-1.5 text-muted-foreground">
          <span
            className="inline-block w-3 border-t-2 border-dashed"
            style={{ borderColor: TARGET_COLOR }}
            aria-hidden="true"
          />
          <span>Target</span>
          {fmtWeight(target, units)}
        </p>
      )}
    </div>
  );
}
