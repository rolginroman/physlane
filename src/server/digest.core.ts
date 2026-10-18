/**
 * Weekly digest — plain logic, no db/server-fn calls (G2.2). Composes from
 * the same reads the reminder batch already fetches: intake rows, weights,
 * and the active cycle's targets. Delivery cadence and copy rules:
 *
 * - one message a week, informative, no channel-growth framing (user
 *   directive: the digest is a summary, not a notification channel to grow)
 * - plain text: no emoji, no markdown, no em dashes, no exclamation marks
 * - free digest carries readiness only; Pro may include the measured number
 */

import { localDate, parseReminderMinute, REMINDER_BUCKET_MINUTES } from "#/lib/remind";
import { computeTdee, type TdeeEntry } from "#/lib/tdee";
import { estimateBand } from "#/lib/band";
import { paceVerdict, type PaceVerdict } from "#/lib/projection";
import { weeklyRates } from "#/lib/lean-mass";
import { fmtKcal } from "#/lib/adherence";
import { kgToLb, type UnitSystem } from "#/lib/units";

export const DIGEST_WINDOW_DAYS = 7;
export const DIGEST_MIN_HOURS = 168;

const DAY_MS = 86_400_000;
const MINUS = "−"; // U+2212, matches the app's signed numbers

export type DigestInput = {
	now: Date;
	timeZone: string;
	/** All intake rows, ascending; the window filters to the last 7 local days. */
	intake: Array<{ date: string; kcal: number | null }>;
	/** All weights, ascending; used for the week delta and the trend verdict. */
	weights: Array<{ takenAt: Date; weightKg: number }>;
	targetKcalPerDay: number | null;
	targetRateKgPerWeek: number | null;
};

export type DigestStats = {
	daysLogged: number;
	avgIntakeKcal: number | null;
	targetKcalPerDay: number | null;
	weightDeltaKg: number | null;
	verdict: PaceVerdict | null;
	/** Tightness percent from the band, whenever there is any pair data. */
	confidence: number | null;
	pairs: number;
	/** Pro only: measured burn when the estimator is ready, else null. */
	measuredKcal: number | null;
	bandKcal: number | null;
};

/** 'YYYY-MM-DD' → UTC weekday index, for the same-weekday cadence check. */
const weekday = (date: string): number => new Date(Date.parse(`${date}T00:00:00Z`)).getUTCDay();

const localDay = (d: Date, timeZone: string): string | null => localDate(d.getTime(), timeZone);

/**
 * The week in numbers, or null when there is nothing to say (no logged day
 * and no weight in the window): an empty week gets no message, only the
 * existing daily reminder.
 */
export function buildDigestStats(input: DigestInput): DigestStats | null {
	const { now, timeZone, intake, weights, targetKcalPerDay, targetRateKgPerWeek } = input;

	const todayLocal = localDay(now, timeZone);
	if (!todayLocal) return null;
	const windowStart = new Date(Date.parse(`${todayLocal}T00:00:00Z`) - (DIGEST_WINDOW_DAYS - 1) * DAY_MS)
		.toISOString()
		.slice(0, 10);

	const windowIntake = intake.filter((r) => r.date >= windowStart && r.date <= todayLocal);
	const logged = windowIntake.filter((r) => r.kcal != null);
	const daysLogged = logged.length;

	const windowWeights = weights.filter((w) => {
		const day = localDay(w.takenAt, timeZone);
		return day != null && day >= windowStart && day <= todayLocal;
	});
	const weightDeltaKg =
		windowWeights.length >= 2
			? windowWeights[windowWeights.length - 1].weightKg - windowWeights[0].weightKg
			: null;

	if (daysLogged === 0 && weightDeltaKg === null) return null;

	const avgIntakeKcal =
		daysLogged > 0
			? Math.round(logged.reduce((s, r) => s + (r.kcal as number), 0) / daysLogged)
			: null;

	// Observed trend over the whole weight series (rateFor needs a >=7-day span).
	const observedRateKgPerWeek = weeklyRates(
		weights.map((w) => ({ takenAt: w.takenAt.toISOString(), weightKg: w.weightKg, waistCm: null })),
	).weightKgPerWeek;
	const verdict =
		observedRateKgPerWeek != null && targetRateKgPerWeek != null
			? paceVerdict({ actualRateKgPerWeek: observedRateKgPerWeek, targetRateKgPerWeek })
			: null;

	// Readiness from the full paired series, exactly like tdeeStatus builds it.
	const byDate = new Map<string, TdeeEntry>();
	for (const r of intake) {
		if (r.kcal != null) byDate.set(r.date, { date: r.date, kcal: r.kcal, weightKg: null });
	}
	for (const w of weights) {
		const day = localDay(w.takenAt, timeZone);
		const entry = day != null ? byDate.get(day) : undefined;
		if (entry && entry.kcal != null) entry.weightKg = w.weightKg;
	}
	const entries = [...byDate.values()]
		.filter((e) => e.kcal != null)
		.sort((a, b) => (a.date < b.date ? -1 : 1));
	const tdee = computeTdee(entries);
	const pairs = tdee.pairs;
	if (tdee.status === "ready") {
		const band = estimateBand(tdee.pairs, tdee.spreadKcal);
		return {
			daysLogged,
			avgIntakeKcal,
			targetKcalPerDay,
			weightDeltaKg,
			verdict,
			confidence: band.confidence,
			pairs,
			measuredKcal: tdee.kcal,
			bandKcal: band.bandKcal,
		};
	}
	const band = estimateBand(pairs);
	return {
		daysLogged,
		avgIntakeKcal,
		targetKcalPerDay,
		weightDeltaKg,
		verdict,
		confidence: pairs > 0 ? band.confidence : null,
		pairs,
		measuredKcal: null,
		bandKcal: null,
	};
}

const fmtSignedWeight = (kg: number, unitSystem: UnitSystem): string => {
	const v = unitSystem === "metric" ? kg : kgToLb(kg);
	const sign = v > 0 ? "+" : v < 0 ? MINUS : "";
	return `${sign}${Math.abs(v).toFixed(1)} ${unitSystem === "metric" ? "kg" : "lb"}`;
};

const VERDICT_LINE: Record<PaceVerdict["kind"], string> = {
	"on-pace": "You are on pace.",
	"too-fast": "You are moving faster than your target.",
	"too-slow": "You are moving slower than your target.",
};

/**
 * One short plain-text message. Free: the week frame plus readiness only.
 * Pro: the week in numbers, including the measured burn.
 */
export function renderDigest(
	stats: DigestStats,
	opts: { plan: "free" | "pro"; unitSystem: UnitSystem; name: string | null },
): string {
	const who = (opts.name ?? "").trim();
	const parts: string[] = [`Your week${who ? `, ${who}` : ""}: ${stats.daysLogged} of ${DIGEST_WINDOW_DAYS} days logged.`];

	if (opts.plan === "pro") {
		if (stats.avgIntakeKcal != null) {
			parts.push(
				stats.targetKcalPerDay != null
					? `Average intake ${fmtKcal(stats.avgIntakeKcal)} kcal against a ${fmtKcal(stats.targetKcalPerDay)} kcal target.`
					: `Average intake ${fmtKcal(stats.avgIntakeKcal)} kcal.`,
			);
		}
		if (stats.weightDeltaKg != null) parts.push(`Weight ${fmtSignedWeight(stats.weightDeltaKg, opts.unitSystem)}.`);
		if (stats.verdict) parts.push(VERDICT_LINE[stats.verdict.kind]);
	}

	const pct = stats.confidence != null ? Math.round(stats.confidence * 100) : null;
	if (opts.plan === "pro" && stats.measuredKcal != null && stats.bandKcal != null) {
		parts.push(
			`Your measured burn is ${fmtKcal(stats.measuredKcal)} ± ${fmtKcal(stats.bandKcal)} kcal${pct != null ? `, ${pct}% tight` : ""}.`,
		);
	} else if (pct != null) {
		parts.push(`Your burn estimate is ${pct}% tight and keeps tightening as you log.`);
	}

	parts.push("The full picture is in the app.");
	return parts.join(" ");
}

/**
 * Fire at most once a week per user (G2.3): the reminder toggle is on, at
 * least 168 hours since the last digest, the local weekday matches the
 * cadence anchor (last send, else account creation), and the current run
 * sits inside the reminder time's 10-minute bucket so the digest arrives at
 * the hour the user chose.
 */
export function shouldSendDigest(input: {
	nowUtcMs: number;
	lastDigestAt: Date | null;
	/** Cadence anchor before the first digest: the account's createdAt. */
	anchorAt: Date | null;
	reminderTime: string | null;
	timeZone: string;
}): boolean {
	const { nowUtcMs, lastDigestAt, anchorAt, reminderTime, timeZone } = input;
	if (!reminderTime) return false; // reminder toggle off means digest off

	const nowLocal = localDate(nowUtcMs, timeZone);
	if (!nowLocal) return false;
	const anchorMs = (lastDigestAt ?? anchorAt)?.getTime();
	if (anchorMs == null || !Number.isFinite(anchorMs)) return false;
	const anchorLocal = localDate(anchorMs, timeZone);
	if (!anchorLocal) return false;

	if (lastDigestAt != null && nowUtcMs - lastDigestAt.getTime() < DIGEST_MIN_HOURS * 3_600_000) return false;
	if (weekday(nowLocal) !== weekday(anchorLocal)) return false;

	const reminderMinute = parseReminderMinute(reminderTime, timeZone, nowUtcMs);
	if (reminderMinute == null) return false;
	const utcMinute = ((Math.floor(nowUtcMs / 60_000) % 1440) + 1440) % 1440;
	return (
		Math.floor(utcMinute / REMINDER_BUCKET_MINUTES) ===
		Math.floor(reminderMinute / REMINDER_BUCKET_MINUTES)
	);
}
