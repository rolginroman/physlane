import { describe, expect, it } from "vitest";
import {
  isValidTimeZone,
  localDate,
  localMinuteOfDay,
  normalizeReminderTime,
  parseHhMm,
  parseReminderMinute,
  renderReminderText,
  REMINDER_BUCKET_MINUTES,
  shouldRemind,
  timingSafeEqual,
} from "./remind";

/* 2026 US DST: starts Sun Mar 8, ends Sun Nov 1. */
const WINTER = Date.UTC(2026, 0, 15, 12, 0, 0); // Jan 15 — EST in New York
const SUMMER = Date.UTC(2026, 6, 15, 12, 0, 0); // Jul 15 — EDT in New York

describe("parseHhMm / normalizeReminderTime", () => {
  it("accepts strict hh:mm", () => {
    expect(parseHhMm("00:00")).toEqual({ hour: 0, minute: 0 });
    expect(parseHhMm("23:59")).toEqual({ hour: 23, minute: 59 });
    expect(parseHhMm(" 09:05 ")).toEqual({ hour: 9, minute: 5 });
  });

  it("rejects loose or out-of-range values", () => {
    for (const bad of ["9:05", "24:00", "09:60", "095", "09:5", "ab:cd", ""]) {
      expect(parseHhMm(bad)).toBeNull();
    }
  });

  it("normalizes for the settings patch: canonical, invalid → null (clears)", () => {
    expect(normalizeReminderTime(" 07:30 ")).toBe("07:30");
    expect(normalizeReminderTime("7:30")).toBeNull();
    expect(normalizeReminderTime(null)).toBeNull();
    expect(normalizeReminderTime(undefined)).toBeNull();
  });

  it("validates IANA zones", () => {
    expect(isValidTimeZone("Europe/Kyiv")).toBe(true);
    expect(isValidTimeZone("America/New_York")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
  });
});

describe("parseReminderMinute (local hh:mm → UTC minute-of-day)", () => {
  it("is the identity in UTC", () => {
    expect(parseReminderMinute("09:00", "UTC", WINTER)).toBe(540);
    expect(parseReminderMinute("00:00", "UTC", WINTER)).toBe(0);
    expect(parseReminderMinute("23:59", "UTC", WINTER)).toBe(1439);
  });

  it("shifts with the zone and its DST state", () => {
    expect(parseReminderMinute("09:00", "America/New_York", WINTER)).toBe(840); // EST = UTC−5 → 14:00
    expect(parseReminderMinute("09:00", "America/New_York", SUMMER)).toBe(780); // EDT = UTC−4 → 13:00
    expect(parseReminderMinute("09:00", "Asia/Tokyo", WINTER)).toBe(0); // UTC+9 → 00:00 next UTC day
  });

  it("wraps past midnight into 0–1439", () => {
    expect(parseReminderMinute("00:30", "Asia/Tokyo", WINTER)).toBe(930); // 15:30 UTC previous day
    expect(parseReminderMinute("23:30", "America/New_York", WINTER)).toBe(270); // 04:30 UTC next day
  });

  it("returns null on bad input", () => {
    expect(parseReminderMinute("9:00", "UTC", WINTER)).toBeNull();
    expect(parseReminderMinute("09:00", "Not/AZone", WINTER)).toBeNull();
  });
});

describe("localMinuteOfDay / localDate", () => {
  it("reads the wall clock in the zone", () => {
    const t = Date.UTC(2026, 0, 15, 14, 5); // 09:05 in New York (EST)
    expect(localMinuteOfDay(t, "America/New_York")).toBe(545);
    expect(localDate(t, "America/New_York")).toBe("2026-01-15");
    expect(localDate(t, "Asia/Tokyo")).toBe("2026-01-15"); // 23:05 JST, same date here
  });

  it("local day differs across the date line", () => {
    const t = Date.UTC(2026, 0, 15, 20, 0); // 15:00 Jan 15 in New York, 05:00 Jan 16 in Tokyo
    expect(localDate(t, "America/New_York")).toBe("2026-01-15");
    expect(localDate(t, "Asia/Tokyo")).toBe("2026-01-16");
  });

  it("returns null on an invalid zone", () => {
    expect(localMinuteOfDay(WINTER, "Nope/Nope")).toBeNull();
    expect(localDate(WINTER, "Nope/Nope")).toBeNull();
  });
});

describe("shouldRemind", () => {
  const bucket = (m: number) => Math.floor(m / REMINDER_BUCKET_MINUTES);

  it("fires inside the matching UTC bucket (UTC zone)", () => {
    const now = Date.UTC(2026, 0, 15, 9, 0);
    expect(shouldRemind(now, "09:00", null, false, "UTC")).toBe(true);
    const late = Date.UTC(2026, 0, 15, 9, REMINDER_BUCKET_MINUTES - 1);
    expect(shouldRemind(late, "09:00", null, false, "UTC")).toBe(true);
  });

  it("does not fire outside the bucket", () => {
    const now = Date.UTC(2026, 0, 15, 9, REMINDER_BUCKET_MINUTES + 2);
    expect(bucket(540 + REMINDER_BUCKET_MINUTES + 2)).not.toBe(bucket(540)); // sanity: buckets differ
    expect(shouldRemind(now, "09:00", null, false, "UTC")).toBe(false);
    expect(
      shouldRemind(Date.UTC(2026, 0, 15, 10, 0), "09:00", null, false, "UTC"),
    ).toBe(false);
  });

  it("honours the user's zone", () => {
    // 09:00 New York (EST, winter) = 14:00 UTC.
    expect(
      shouldRemind(
        Date.UTC(2026, 0, 15, 14, 3),
        "09:00",
        null,
        false,
        "America/New_York",
      ),
    ).toBe(true);
    // 09:00 UTC is 04:00 in New York — wrong bucket for the same stored time.
    expect(
      shouldRemind(
        Date.UTC(2026, 0, 15, 9, 3),
        "09:00",
        null,
        false,
        "America/New_York",
      ),
    ).toBe(false);
  });

  it("skips when no reminder, already logged, or already notified today", () => {
    const now = Date.UTC(2026, 0, 15, 9, 0);
    expect(shouldRemind(now, null, null, false, "UTC")).toBe(false);
    expect(shouldRemind(now, "09:00", null, true, "UTC")).toBe(false);
    // Notified earlier the same local day → suppress.
    expect(
      shouldRemind(
        now,
        "09:00",
        new Date(Date.UTC(2026, 0, 15, 8, 0)),
        false,
        "UTC",
      ),
    ).toBe(false);
    // Notified yesterday → allowed again.
    expect(
      shouldRemind(
        now,
        "09:00",
        new Date(Date.UTC(2026, 0, 14, 23, 0)),
        false,
        "UTC",
      ),
    ).toBe(true);
  });

  it("compares 'today' in the user's zone, not UTC", () => {
    // 15:31 UTC Jan 15 = 00:31 Jan 16 in Tokyo. Reminder 00:30 JST → bucket fires.
    const now = Date.UTC(2026, 0, 15, 15, 31);
    // Notified 11:00 JST Jan 15 (02:00 UTC) — a different local day → allowed.
    expect(
      shouldRemind(
        now,
        "00:30",
        new Date(Date.UTC(2026, 0, 15, 2, 0)),
        false,
        "Asia/Tokyo",
      ),
    ).toBe(true);
    // Notified 01:00 JST Jan 16 (16:00 UTC Jan 15) — same local day → suppressed.
    expect(
      shouldRemind(
        now,
        "00:30",
        new Date(Date.UTC(2026, 0, 15, 16, 0)),
        false,
        "Asia/Tokyo",
      ),
    ).toBe(false);
  });
});

describe("renderReminderText", () => {
  it("matches the base copy with and without a name", () => {
    expect(renderReminderText("Roman", null, "metric", null)).toBe(
      "Morning, Roman. Two numbers when you are ready: weight and yesterday's calories.",
    );
    expect(renderReminderText(null, null, "metric", null)).toBe(
      "Morning. Two numbers when you are ready: weight and yesterday's calories.",
    );
    expect(renderReminderText("   ", null, "metric", null)).toBe(
      "Morning. Two numbers when you are ready: weight and yesterday's calories.",
    );
  });

  it("adds the streak line only above 1", () => {
    expect(renderReminderText("Roman", 12, "metric", null)).toBe(
      "Morning, Roman. Two numbers when you are ready: weight and yesterday's calories. Day 12 in a row.",
    );
    expect(renderReminderText("Roman", 1, "metric", null)).not.toContain(
      "in a row",
    );
    expect(renderReminderText("Roman", 0, "metric", null)).not.toContain(
      "in a row",
    );
    expect(renderReminderText("Roman", null, "metric", null)).not.toContain(
      "in a row",
    );
  });

  it("adds the latest weight per unit system", () => {
    expect(renderReminderText("Roman", 12, "metric", 84.2)).toBe(
      "Morning, Roman. Two numbers when you are ready: weight and yesterday's calories. Day 12 in a row. Last: 84.2 kg.",
    );
    expect(renderReminderText("Roman", null, "imperial", 84.2)).toBe(
      "Morning, Roman. Two numbers when you are ready: weight and yesterday's calories. Last: 185.6 lb.",
    );
    expect(renderReminderText("Roman", null, "metric", null)).not.toContain(
      "Last:",
    );
  });
});

describe("timingSafeEqual", () => {
  it("compares equal strings as equal, including empty", () => {
    expect(timingSafeEqual("secret", "secret")).toBe(true);
    expect(timingSafeEqual("", "")).toBe(true);
  });

  it("rejects mismatches of content or length", () => {
    expect(timingSafeEqual("secret", "secreT")).toBe(false);
    expect(timingSafeEqual("secret", "secrets")).toBe(false);
    expect(timingSafeEqual("secrets", "secret")).toBe(false);
    expect(timingSafeEqual("", "x")).toBe(false);
  });
});
