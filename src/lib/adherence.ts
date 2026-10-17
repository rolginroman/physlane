/**
 * Pure intake adherence + streak logic (rule BR1: no I/O).
 *
 * Every function takes an explicit `today` ('YYYY-MM-DD') so tests are
 * deterministic and the server stays the single clock.
 *
 * GLP-1 note: copy functions suppress deficit/surplus framing when onGlp1 is
 * set (F13). Appetite is already suppressed by medication; the product voice
 * pivots to hitting the target and keeping protein high instead.
 */

export type Phase = "cut" | "bulk" | "maintain";

export type IntakeDay = {
	date: string; // canonical 'YYYY-MM-DD'
	kcal: number | null;
	proteinG: number | null;
};

export type StripState =
	| "hit" // logged, within tolerance of target
	| "off" // logged, off target (over for cut/maintain, under for bulk)
	| "logged" // logged, no target to compare against
	| "missed" // past day with no entry
	| "pending"; // today with no entry yet

export type StripDay = IntakeDay & {
	isToday: boolean;
	state: StripState;
};

export type WeekStats = {
	pct: number | null; // 0..100 adherence, null when no target
	avgKcal: number | null;
	loggedDays: number;
	proteinDays: number;
};

const DAY_MS = 86_400_000;

export const addDays = (date: string, n: number): string =>
	new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

/** The n dates ending at `today`, oldest first. */
export const lastNDates = (today: string, n: number): string[] =>
	Array.from({ length: n }, (_, i) => addDays(today, i - (n - 1)));

/**
 * Consecutive logged days ending today. An unlogged today does not break the
 * streak (the day is not over); the count then starts from yesterday.
 */
export function intakeStreak(dates: Iterable<string>, today: string): number {
	const logged = new Set(dates);
	const start = logged.has(today) ? today : addDays(today, -1);
	if (!logged.has(start)) return 0;
	let streak = 0;
	for (let d = start; logged.has(d); d = addDays(d, -1)) streak++;
	return streak;
}

/**
 * Exactly 7 strip cells (today and the 6 days before), oldest first, with a
 * state derived against the daily target. Bulk flips the tolerance direction:
 * eating too little is the off-target case when gaining is the goal.
 */
export function buildStrip(
	days: IntakeDay[],
	opts: { today: string; targetKcalPerDay: number | null; phase: Phase | null },
): StripDay[] {
	const byDate = new Map(days.map((d) => [d.date, d]));
	return lastNDates(opts.today, 7).map((date) => {
		const row = byDate.get(date);
		const isToday = date === opts.today;
		if (!row || row.kcal == null) {
			return { date, kcal: null, proteinG: null, isToday, state: isToday ? "pending" : "missed" };
		}
		const t = opts.targetKcalPerDay;
		let state: StripState = "logged";
		if (t != null && t > 0) {
			const ratio = row.kcal / t;
			state = opts.phase === "bulk" ? (ratio < 0.9 ? "off" : "hit") : ratio > 1.1 ? "off" : "hit";
		}
		return { date, kcal: row.kcal, proteinG: row.proteinG, isToday, state };
	});
}

/**
 * 7-day rolling adherence (F9). Each scored day counts min(kcal/target, 1):
 * overshoot earns no extra credit. Missed past days score 0; an unlogged today
 * is excluded because the day is not over. Null pct when there is no target.
 */
export function adherence7d(strip: StripDay[], targetKcalPerDay: number | null): WeekStats {
	const logged = strip.filter((d) => d.kcal != null);
	const proteinDays = strip.filter((d) => d.proteinG != null).length;
	if (logged.length === 0) {
		return { pct: null, avgKcal: null, loggedDays: 0, proteinDays };
	}
	const avgKcal = Math.round(logged.reduce((s, d) => s + (d.kcal ?? 0), 0) / logged.length);
	if (targetKcalPerDay == null || targetKcalPerDay <= 0) {
		return { pct: null, avgKcal, loggedDays: logged.length, proteinDays };
	}
	let score = 0;
	let denom = 0;
	for (const d of strip) {
		if (d.kcal == null && d.isToday) continue;
		denom++;
		score += d.kcal == null ? 0 : Math.min(d.kcal / targetKcalPerDay, 1);
	}
	return {
		pct: denom === 0 ? null : Math.round((score / denom) * 100),
		avgKcal,
		loggedDays: logged.length,
		proteinDays,
	};
}

export const fmtKcal = (n: number): string => n.toLocaleString("en-US");

export type EnergyCopy = { headline: string; body: string | null };

/**
 * Burn-vs-target copy for the TDEE panel. GLP-1 mode suppresses deficit and
 * surplus framing entirely: the copy reports the numbers plainly and pivots to
 * protein and muscle protection.
 */
export function tdeeEnergyCopy(opts: {
	tdeeKcal: number;
	targetKcalPerDay: number | null;
	onGlp1: boolean;
}): EnergyCopy | null {
	if (opts.onGlp1) {
		const target =
			opts.targetKcalPerDay != null ? ` Target: ${fmtKcal(opts.targetKcalPerDay)} kcal.` : "";
		return {
			headline: `Burn rate ${fmtKcal(opts.tdeeKcal)} kcal per day.${target}`,
			body: "GLP-1 mode: aim for your target, not under it. Keep protein high to protect muscle.",
		};
	}
	if (opts.targetKcalPerDay == null) return null;
	const diff = opts.targetKcalPerDay - opts.tdeeKcal;
	if (Math.abs(diff) < 50) {
		return { headline: `Target matches your burn rate (${fmtKcal(opts.tdeeKcal)} kcal).`, body: null };
	}
	if (diff < 0) {
		return {
			headline: `Target runs ${fmtKcal(-diff)} kcal under your burn.`,
			body: `Working deficit: ${fmtKcal(-diff)} kcal per day.`,
		};
	}
	return {
		headline: `Target runs ${fmtKcal(diff)} kcal over your burn.`,
		body: `Working surplus: ${fmtKcal(diff)} kcal per day.`,
	};
}

/** Weekly summary line for the intake page. GLP-1 mode drops deficit framing. */
export function intakeWeekCopy(opts: {
	stats: WeekStats;
	targetKcalPerDay: number | null;
	onGlp1: boolean;
}): { main: string; note: string | null } {
	const { stats } = opts;
	if (stats.loggedDays === 0) {
		return { main: "Nothing logged in the last 7 days.", note: null };
	}
	if (opts.onGlp1) {
		return {
			main: `Average ${fmtKcal(stats.avgKcal ?? 0)} kcal across ${stats.loggedDays} of 7 days.`,
			note:
				opts.targetKcalPerDay != null
					? `GLP-1 mode: aim for ${fmtKcal(opts.targetKcalPerDay)} kcal, not under. Protein first.`
					: "GLP-1 mode: protein first. Set a cycle target for a daily kcal goal.",
		};
	}
	if (opts.targetKcalPerDay == null) {
		return {
			main: `Average ${fmtKcal(stats.avgKcal ?? 0)} kcal across ${stats.loggedDays} of 7 days.`,
			note: "Set a cycle target to track adherence.",
		};
	}
	const diff = (stats.avgKcal ?? 0) - opts.targetKcalPerDay;
	if (Math.abs(diff) < 50) return { main: "On target for the week.", note: null };
	if (diff < 0) return { main: `Averaging ${fmtKcal(-diff)} kcal under target.`, note: null };
	return { main: `Averaging ${fmtKcal(diff)} kcal over target.`, note: null };
}
