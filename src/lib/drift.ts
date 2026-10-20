/**
 * Pure reporting-drift detector (rule BR1: no I/O).
 *
 * Catches the classic underreporting signature: the weight trend implies a
 * bigger deficit (or surplus) than the logs do. To stay decoupled, the burn
 * anchor is the median of the OLDER weekly estimates, excluding the newest
 * few — recent windows are contaminated by exactly the drift being measured.
 * Fires when the scale-implied and log-implied deficits disagree by more
 * than 15% of that anchor, in the same direction, two weeks running.
 */

import type { WeeklyEstimate } from "./tdee";

export type DriftWindow = {
  avgReportedKcal: number;
  rateKgPerWeek: number; // signed: negative = losing
};

export type DriftSignal = {
  direction: "under" | "over"; // under = eating less than logged, over = more
  impliedKcalPerDay: number; // magnitude of the log-vs-scale disagreement
} | null;

export const DRIFT_BURN_FRACTION = 0.15;
export const KCAL_PER_KG_PER_WEEK = 1100;
/** Newest weekly estimates excluded from the anchor: they cover the drift window. */
export const DRIFT_ANCHOR_SKIP = 2;

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

type WindowVerdict = {
  direction: "under" | "over";
  impliedKcalPerDay: number;
} | null;

const windowVerdict = (anchorKcal: number, w: DriftWindow): WindowVerdict => {
  const impliedDeficit = -w.rateKgPerWeek * KCAL_PER_KG_PER_WEEK; // positive = losing
  const reportedDeficit = anchorKcal - w.avgReportedKcal; // what the logs claim
  const gap = impliedDeficit - reportedDeficit; // >0: logs understate the deficit
  const threshold = DRIFT_BURN_FRACTION * anchorKcal;
  if (gap > threshold) return { direction: "under", impliedKcalPerDay: gap };
  if (-gap > threshold) return { direction: "over", impliedKcalPerDay: -gap };
  return null;
};

export function detectReportingDrift(
  weekly: WeeklyEstimate[],
  windows: DriftWindow[],
): DriftSignal {
  if (windows.length < 2) return null;
  const anchorCount = weekly.length - DRIFT_ANCHOR_SKIP;
  if (anchorCount < 3) return null;
  const anchor = median(weekly.slice(0, anchorCount).map((w) => w.kcal));
  if (!(anchor > 0)) return null;

  const first = windowVerdict(anchor, windows[windows.length - 2]);
  if (first === null) return null;
  const second = windowVerdict(anchor, windows[windows.length - 1]);
  if (second === null || second.direction !== first.direction) return null;
  return {
    direction: second.direction,
    impliedKcalPerDay: Math.round(
      (first.impliedKcalPerDay + second.impliedKcalPerDay) / 2,
    ),
  };
}

/**
 * Builds the two consecutive 7-day windows ending at `today` from a paired
 * day series (the same rows computeTdee consumes). A window needs at least
 * one logged kcal day and two weights >=3 days apart; anything less returns
 * null so the detector stays quiet instead of guessing.
 */
export type DriftDay = { date: string; kcal: number; weightKg: number | null };

const DAY_MS = 86_400_000;

const isoDay = (utcMs: number): string =>
  new Date(utcMs).toISOString().slice(0, 10);

export function driftWindows(
  days: DriftDay[],
  today: string,
): DriftWindow[] | null {
  const by = new Map(days.map((d) => [d.date, d]));
  const t = Date.parse(`${today}T00:00:00Z`);
  if (!Number.isFinite(t)) return null;
  const windows: DriftWindow[] = [];
  for (let h = 0; h < 2; h++) {
    const startMs = t - (13 - 7 * h) * DAY_MS;
    let kcalSum = 0;
    let loggedDays = 0;
    const weightPts: Array<{ offset: number; weightKg: number }> = [];
    for (let off = 0; off < 7; off++) {
      const e = by.get(isoDay(startMs + off * DAY_MS));
      if (!e) continue;
      if (Number.isFinite(e.kcal)) {
        kcalSum += e.kcal;
        loggedDays++;
      }
      if (e.weightKg !== null && Number.isFinite(e.weightKg)) {
        weightPts.push({ offset: off, weightKg: e.weightKg });
      }
    }
    if (loggedDays === 0 || weightPts.length < 2) return null;
    const first = weightPts[0];
    const last = weightPts[weightPts.length - 1];
    const span = last.offset - first.offset;
    if (span < 3) return null;
    windows.push({
      avgReportedKcal: kcalSum / loggedDays,
      rateKgPerWeek: ((last.weightKg - first.weightKg) / span) * 7,
    });
  }
  return windows;
}
