import { describe, expect, it } from "vitest";
import { buildDigestStats, renderDigest, shouldSendDigest, type DigestInput } from "./digest.core";

const DAY_MS = 86_400_000;
const TZ = "UTC";

/** Canonical local date n days after start. */
const day = (start: string, n: number): string =>
	new Date(Date.parse(`${start}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

/** Sunday 2026-10-18, 12:00 UTC — mid-day so local-date edges stay stable. */
const NOW = new Date("2026-10-18T12:00:00Z");
const TODAY = "2026-10-18";

const baseInput = (over: Partial<DigestInput> = {}): DigestInput => ({
	now: NOW,
	timeZone: TZ,
	intake: [],
	weights: [],
	targetKcalPerDay: 2400,
	targetRateKgPerWeek: -0.5,
	...over,
});

/** 21 days of clean pairs: flat weight, constant 2600 kcal → TDEE ready at 2600. */
const readySeries = (days = 21): DigestInput => {
	const intake: DigestInput["intake"] = [];
	const weights: DigestInput["weights"] = [];
	for (let i = 0; i < days; i++) {
		const d = day("2026-09-28", i);
		intake.push({ date: d, kcal: 2600 });
		weights.push({ takenAt: new Date(`${d}T08:00:00Z`), weightKg: 80 });
	}
	return baseInput({ intake, weights });
};

describe("buildDigestStats — math", () => {
	it("counts logged days in the last 7 local days, not older ones", () => {
		const intake = [
			{ date: day(TODAY, -30), kcal: 3000 }, // outside: ignored
			{ date: day(TODAY, -6), kcal: 2500 },
			{ date: day(TODAY, -5), kcal: 2600 },
			{ date: day(TODAY, -4), kcal: 2700 },
			{ date: day(TODAY, -3), kcal: 2400 },
			{ date: day(TODAY, -2), kcal: 2500 },
			{ date: day(TODAY, -1), kcal: 2600 },
			{ date: TODAY, kcal: 2500 },
		];
		const stats = buildDigestStats(baseInput({ intake }));
		expect(stats?.daysLogged).toBe(7);
		expect(stats?.avgIntakeKcal).toBe(Math.round((2500 + 2600 + 2700 + 2400 + 2500 + 2600 + 2500) / 7));
	});

	it("null-kcal rows are not logged days", () => {
		const intake = [
			{ date: day(TODAY, -1), kcal: 2500 },
			{ date: TODAY, kcal: null },
		];
		const stats = buildDigestStats(baseInput({ intake }));
		expect(stats?.daysLogged).toBe(1);
		expect(stats?.avgIntakeKcal).toBe(2500);
	});

	it("weight delta is last minus first weight inside the window", () => {
		const weights = [
			{ takenAt: new Date(`${day(TODAY, -6)}T08:00:00Z`), weightKg: 80.5 },
			{ takenAt: new Date(`${day(TODAY, -3)}T08:00:00Z`), weightKg: 80.0 },
			{ takenAt: new Date(`${day(TODAY, -1)}T08:00:00Z`), weightKg: 79.7 },
			{ takenAt: new Date(`${day(TODAY, -20)}T08:00:00Z`), weightKg: 82.0 }, // outside
		];
		const stats = buildDigestStats(baseInput({ weights }));
		expect(stats?.weightDeltaKg).toBeCloseTo(79.7 - 80.5, 6);
	});

	it("on-pace verdict from the observed trend vs the cycle target", () => {
		// Observed −0.52 kg/wk vs −0.5 target: inside the 0.1 tolerance.
		const weights = [0, 7, 14].map((d) => ({
			takenAt: new Date(`${day(TODAY, -16 + d)}T08:00:00Z`),
			weightKg: 80 - 0.52 * (d / 7),
		}));
		const intake = [{ date: TODAY, kcal: 2500 }]; // week activity, so the digest exists
		const stats = buildDigestStats(baseInput({ weights, intake }));
		expect(stats?.verdict?.kind).toBe("on-pace");
	});

	it("returns null for an empty week: no logs, no weights", () => {
		expect(buildDigestStats(baseInput())).toBeNull();
	});

	it("readiness comes from the full paired series", () => {
		const stats = buildDigestStats(readySeries());
		expect(stats?.pairs).toBe(21);
		expect(stats?.measuredKcal).toBe(2600);
		expect(stats?.confidence).toBe(1); // flat series: spread 0, schedule tight
		expect(stats?.bandKcal).toBe(80);
	});
});

describe("renderDigest — copy and gate", () => {
	it("free: readiness only, never the measured number or band", () => {
		const stats = buildDigestStats(readySeries());
		if (!stats) throw new Error("expected stats");
		const text = renderDigest(stats, { plan: "free", unitSystem: "metric", name: "Roman" });
		expect(text).toContain("7 of 7 days logged"); // the window holds the last 7 logged days
		expect(text).not.toContain("2,600");
		expect(text).not.toContain("±");
		expect(text).toContain("% tight");
		expect(text).toContain("Roman");
	});

	it("pro: the week in numbers, including the measured burn and band", () => {
		const stats = buildDigestStats(readySeries());
		if (!stats) throw new Error("expected stats");
		const text = renderDigest(stats, { plan: "pro", unitSystem: "metric", name: null });
		expect(text).toContain("7 of 7 days logged");
		expect(text).toContain("Average intake 2,600 kcal against a 2,400 kcal target");
		expect(text).toContain("Your measured burn is 2,600 ± 80 kcal, 100% tight");
	});

	it("imperial units render lb, and copy rules hold on both plans", () => {
		const stats = buildDigestStats(readySeries());
		if (!stats) throw new Error("expected stats");
		for (const plan of ["free", "pro"] as const) {
			const text = renderDigest(stats, { plan, unitSystem: "imperial", name: null });
			expect(text).not.toContain("!");
			expect(text).not.toContain("—");
			expect(text).not.toContain("*");
		}
	});

	it("weight delta line present for pro when measurable, with the right sign", () => {
		const input = readySeries();
		input.weights = input.weights.map((w, i) => ({ ...w, weightKg: 80 - i * 0.1 }));
		const stats = buildDigestStats(input);
		if (!stats) throw new Error("expected stats");
		const text = renderDigest(stats, { plan: "pro", unitSystem: "metric", name: null });
		expect(text).toContain("Weight −0.6 kg.");
	});
});

describe("shouldSendDigest — weekly cadence and dedupe", () => {
	// 2026-10-18 is a Sunday. Reminder 12:00 UTC → bucket 72.
	const SUNDAY_NOON = Date.parse("2026-10-18T12:04:00Z");
	const sundayBefore = (days: number, minutes = 0) =>
		new Date(SUNDAY_NOON - days * DAY_MS - minutes * 60_000);
	const opts = (over: Partial<Parameters<typeof shouldSendDigest>[0]> = {}) => ({
		nowUtcMs: SUNDAY_NOON,
		lastDigestAt: null,
		anchorAt: sundayBefore(21),
		reminderTime: "12:00",
		timeZone: TZ,
		...over,
	});

	it("fires on the anchor weekday inside the reminder bucket", () => {
		expect(shouldSendDigest(opts())).toBe(true);
	});

	it("wrong weekday never fires even past 168 hours", () => {
		expect(shouldSendDigest(opts({ anchorAt: sundayBefore(22) }))).toBe(false);
	});

	it("holds within 168 hours of the last digest", () => {
		expect(shouldSendDigest(opts({ lastDigestAt: sundayBefore(0, 10) }))).toBe(false); // 10 min ago
		expect(shouldSendDigest(opts({ lastDigestAt: sundayBefore(6, 30) }))).toBe(false); // 6.5 days ago
	});

	it("resends exactly one week later: same weekday, 168 hours elapsed", () => {
		expect(shouldSendDigest(opts({ lastDigestAt: sundayBefore(7, 10) }))).toBe(true); // 168h10m
		expect(shouldSendDigest(opts({ lastDigestAt: sundayBefore(7, -10) }))).toBe(false); // 167h50m
	});

	it("reminder toggle off means digest off", () => {
		expect(shouldSendDigest(opts({ reminderTime: null }))).toBe(false);
	});

	it("outside the reminder's 10-minute bucket it waits for the next run", () => {
		// 12:04 UTC is inside bucket 72 (12:00-12:09); 12:50 is bucket 77.
		expect(shouldSendDigest(opts({ nowUtcMs: Date.parse("2026-10-18T12:50:00Z") }))).toBe(false);
	});

	it("no anchor at all (no createdAt, no digest yet) never fires", () => {
		expect(shouldSendDigest(opts({ anchorAt: null }))).toBe(false);
	});

	it("timezone shifts the local weekday: a UTC-Sunday anchor is Sunday in +7 too", () => {
		// Anchor 2026-10-18 12:00 UTC is 19:00 local (+7): still Sunday there.
		// Reminder 19:00 Bangkok = 12:00 UTC, so the bucket still matches.
		expect(shouldSendDigest(opts({ timeZone: "Asia/Bangkok", reminderTime: "19:00" }))).toBe(true);
		// But 23:30 UTC Sunday is Monday in +7: weekday mismatch.
		expect(
			shouldSendDigest(
				opts({ nowUtcMs: Date.parse("2026-10-18T23:30:00Z"), timeZone: "Asia/Bangkok", reminderTime: "23:30" }),
			),
		).toBe(false);
	});
});
