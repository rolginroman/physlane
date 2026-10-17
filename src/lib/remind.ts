/**
 * Daily Telegram reminder — pure logic only (G2.5).
 *
 * No Date.now() / fetch / db here: every function is a function of its
 * arguments so the cron endpoint, the settings patch and the tests all share
 * one deterministic core. Timezone math uses Intl only (built-in, no deps).
 */

import { kgToLb, type UnitSystem } from "./units";

/** Cron granularity: a run inside the same bucket as the reminder fires it. */
export const REMINDER_BUCKET_MINUTES = 10;

const HH_MM = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Strict 'hh:mm' (00:00–23:59) → parts; anything else → null. */
export function parseHhMm(value: string): { hour: number; minute: number } | null {
	const m = HH_MM.exec(value.trim());
	if (!m) return null;
	return { hour: Number(m[1]), minute: Number(m[2]) };
}

/** Settings normalization: valid 'hh:mm' stays canonicalized, else null (clears). */
export function normalizeReminderTime(value: string | null | undefined): string | null {
	if (value == null) return null;
	const parsed = parseHhMm(value);
	if (!parsed) return null;
	return `${String(parsed.hour).padStart(2, "0")}:${String(parsed.minute).padStart(2, "0")}`;
}

/** True when the string is a supported IANA time zone name. */
export function isValidTimeZone(tz: string): boolean {
	try {
		new Intl.DateTimeFormat("en-US", { timeZone: tz });
		return true;
	} catch {
		return false;
	}
}

const offsetFormatters = new Map<string, Intl.DateTimeFormat>();

function offsetFormat(timeZone: string): Intl.DateTimeFormat {
	let f = offsetFormatters.get(timeZone);
	if (!f) {
		f = new Intl.DateTimeFormat("en-US", {
			timeZone,
			hourCycle: "h23",
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			second: "2-digit",
		});
		offsetFormatters.set(timeZone, f);
	}
	return f;
}

const mod = (n: number, m: number) => ((n % m) + m) % m;

/** tz offset in minutes east of UTC at the given instant; invalid tz → null. */
function tzOffsetMinutes(utcMs: number, timeZone: string): number | null {
	let parts: Intl.DateTimeFormatPart[];
	try {
		parts = offsetFormat(timeZone).formatToParts(new Date(utcMs));
	} catch {
		return null;
	}
	const get = (type: Intl.DateTimeFormatPartTypes) =>
		Number(parts.find((p) => p.type === type)?.value ?? Number.NaN);
	const asUTC = Date.UTC(
		get("year"),
		get("month") - 1,
		get("day"),
		get("hour"),
		get("minute"),
		get("second"),
	);
	if (!Number.isFinite(asUTC)) return null;
	return Math.round((asUTC - Math.floor(utcMs / 1000) * 1000) / 60_000);
}

/**
 * Local wall-clock 'hh:mm' in `tz` → the UTC minute-of-day (0–1439) it falls
 * on, for the calendar day containing `anchorUtcMs`. DST-aware via the offset
 * at the anchor instant — callers pass the current run time so each cron run
 * re-derives today's offset. Invalid 'hh:mm' or tz → null.
 */
export function parseReminderMinute(
	hhMm: string,
	timeZone: string,
	anchorUtcMs = 0,
): number | null {
	const parsed = parseHhMm(hhMm);
	if (!parsed) return null;
	const offset = tzOffsetMinutes(anchorUtcMs, timeZone);
	if (offset == null) return null;
	return mod(parsed.hour * 60 + parsed.minute - offset, 1440);
}

/** Wall-clock minute-of-day (0–1439) of a UTC instant in `tz`; invalid tz → null. */
export function localMinuteOfDay(utcMs: number, timeZone: string): number | null {
	let parts: Intl.DateTimeFormatPart[];
	try {
		parts = offsetFormat(timeZone).formatToParts(new Date(utcMs));
	} catch {
		return null;
	}
	const h = Number(parts.find((p) => p.type === "hour")?.value ?? Number.NaN);
	const m = Number(parts.find((p) => p.type === "minute")?.value ?? Number.NaN);
	if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
	return mod(h * 60 + m, 1440);
}

/** Wall-clock 'YYYY-MM-DD' of a UTC instant in `tz`; invalid tz → null. */
export function localDate(utcMs: number, timeZone: string): string | null {
	let parts: Intl.DateTimeFormatPart[];
	try {
		parts = new Intl.DateTimeFormat("en-CA", {
			timeZone,
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
		}).formatToParts(new Date(utcMs));
	} catch {
		return null;
	}
	const get = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((p) => p.type === type)?.value ?? "";
	const y = get("year");
	const mo = get("month");
	const d = get("day");
	return y && mo && d ? `${y}-${mo}-${d}` : null;
}

/**
 * Fire at most once per local day: the reminder is set, the current UTC
 * minute bucket equals the reminder's bucket, nothing was sent yet today
 * (local day in `tz`) and the user has not logged today.
 */
export function shouldRemind(
	nowUtcMs: number,
	reminderTime: string | null,
	lastNotified: Date | null,
	alreadyLoggedToday: boolean,
	timeZone = "UTC",
): boolean {
	if (!reminderTime || alreadyLoggedToday) return false;
	const today = localDate(nowUtcMs, timeZone);
	if (!today) return false;
	if (lastNotified && localDate(lastNotified.getTime(), timeZone) === today) return false;
	const reminderMinute = parseReminderMinute(reminderTime, timeZone, nowUtcMs);
	if (reminderMinute == null) return false;
	const utcMinute = mod(Math.floor(nowUtcMs / 60_000), 1440);
	const bucket = (m: number) => Math.floor(m / REMINDER_BUCKET_MINUTES);
	return bucket(utcMinute) === bucket(reminderMinute);
}

/** One short plain-text message. No emoji, no markdown. */
export function renderReminderText(
	userName: string | null,
	streak: number | null,
	unitSystem: UnitSystem,
	latestWeightKg: number | null,
): string {
	const who = (userName ?? "").trim();
	const parts: string[] = [
		`Morning${who ? `, ${who}` : ""}. Two numbers when you are ready: weight and yesterday's calories.`,
	];
	if (streak != null && streak > 1) parts.push(`Day ${streak} in a row.`);
	if (latestWeightKg != null) {
		const v = unitSystem === "metric" ? latestWeightKg : kgToLb(latestWeightKg);
		parts.push(`Last: ${v.toFixed(1)} ${unitSystem === "metric" ? "kg" : "lb"}.`);
	}
	return parts.join(" ");
}

/** Constant-time string compare for secrets: no early exit on length or byte. */
export function timingSafeEqual(a: string, b: string): boolean {
	const len = Math.max(a.length, b.length);
	let mismatch = a.length ^ b.length;
	for (let i = 0; i < len; i++) {
		mismatch |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
	}
	return mismatch === 0;
}
