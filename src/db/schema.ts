import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

/* ── better-auth core tables ─────────────────────────────────────────── */

export const user = sqliteTable(
	"user",
	{
		id: text("id").primaryKey(),
		name: text("name").notNull(),
		email: text("email").notNull(),
		emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
		image: text("image"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		/* physlane fields */
		unitSystem: text("unit_system", { enum: ["metric", "imperial"] }).notNull().default("metric"),
		plan: text("plan", { enum: ["free", "pro"] }).notNull().default("free"),
		onGlp1: integer("on_glp1", { mode: "boolean" }).notNull().default(false),
		/* optional profile fields for the Navy body-fat estimate (G1.4) */
		heightCm: real("height_cm"),
		sex: text("sex", { enum: ["male", "female"] }),
		/* tele-better-auth: server-owned identity fields (migration 0004) */
		telegramId: text("telegram_id"),
		telegramUsername: text("telegram_username"),
		telegramPhoneNumber: text("telegram_phone_number"),
		/* daily Telegram reminder (migration 0005): local 'hh:mm' + its IANA zone */
		reminderTime: text("reminder_time"),
		reminderTz: text("reminder_tz"),
		/* last day a reminder was sent (timestamp; compared per local day) */
		telegramNotifiedAt: integer("telegram_notified_at", { mode: "timestamp" }),
		/* weekly digest (migration 0006): last send; also the cadence anchor */
		lastDigestAt: integer("last_digest_at", { mode: "timestamp" }),
		/* day-14 target prompt (migration 0006): apply/dismiss state machine */
		targetPromptLastAppliedAt: integer("target_prompt_last_applied_at", { mode: "timestamp" }),
		targetPromptLastDismissedAt: integer("target_prompt_last_dismissed_at", { mode: "timestamp" }),
		/** measured kcal at the last Apply, for the >10% re-prompt rule */
		targetPromptAppliedKcal: integer("target_prompt_applied_kcal"),
		/* public read-only progress card (migration 0005); rotating revokes links */
		shareToken: text("share_token"),
		stripeCustomerId: text("stripe_customer_id"),
		stripeSubscriptionId: text("stripe_subscription_id"),
		planCurrentPeriodEnd: integer("plan_current_period_end", { mode: "timestamp" }),
	},
	(t) => [
		uniqueIndex("user_email_idx").on(t.email),
		uniqueIndex("user_share_token_idx").on(t.shareToken), // SQLite: multiple NULLs allowed
	],
);

export const session = sqliteTable("session", {
	id: text("id").primaryKey(),
	expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
	token: text("token").notNull(),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
	updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
	ipAddress: text("ip_address"),
	userAgent: text("user_agent"),
	userId: text("user_id").notNull(),
});

export const account = sqliteTable(
	"account",
	{
		id: text("id").primaryKey(),
		accountId: text("account_id").notNull(),
		providerId: text("provider_id").notNull(),
		userId: text("user_id").notNull(),
		accessToken: text("access_token"),
		refreshToken: text("refresh_token"),
		idToken: text("id_token"),
		accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
		refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
		scope: text("scope"),
		password: text("password"),
		/* tele-better-auth (migration 0004) */
		telegramId: text("telegram_id"),
		telegramUsername: text("telegram_username"),
		createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
	},
	(t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = sqliteTable("verification", {
	id: text("id").primaryKey(),
	identifier: text("identifier").notNull(),
	value: text("value").notNull(),
	expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
	createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
	updatedAt: integer("updated_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
});

/* ── physlane domain ─────────────────────────────────────────────────── */

/**
 * One row per measurement session. Canonical units: cm + kg.
 * All girth fields optional — log what you measured.
 */
export const measurements = sqliteTable(
	"measurements",
	{
		id: text("id").primaryKey(), // crypto.randomUUID()
		userId: text("user_id").notNull(),
		takenAt: integer("taken_at", { mode: "timestamp" }).notNull(),
		weightKg: real("weight_kg"),
		neckCm: real("neck_cm"),
		chestCm: real("chest_cm"),
		waistCm: real("waist_cm"),
		hipsCm: real("hips_cm"),
		armLeftCm: real("arm_left_cm"),
		armRightCm: real("arm_right_cm"),
		thighLeftCm: real("thigh_left_cm"),
		thighRightCm: real("thigh_right_cm"),
		calfCm: real("calf_cm"),
		notes: text("notes"),
		createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
	},
	(t) => [index("measurements_user_taken_idx").on(t.userId, t.takenAt)],
);

/**
 * Cut/bulk/maintain phase with target rate. One active cycle per user
 * (endDate null = active), enforced in app logic.
 */
export const cycles = sqliteTable(
	"cycles",
	{
		id: text("id").primaryKey(),
		userId: text("user_id").notNull(),
		phase: text("phase", { enum: ["cut", "bulk", "maintain"] }).notNull(),
		startDate: integer("start_date", { mode: "timestamp" }).notNull(),
		endDate: integer("end_date", { mode: "timestamp" }),
		startWeightKg: real("start_weight_kg"),
		targetRateKgPerWeek: real("target_rate_kg_per_week"), // signed: negative = cut
		kcalTargetPerDay: integer("kcal_target_per_day"),
		notes: text("notes"),
		createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
	},
	(t) => [index("cycles_user_idx").on(t.userId)],
);

/** Progress photos. Binary lives in R2 under `{userId}/{photoId}` (private). */
export const photos = sqliteTable(
	"photos",
	{
		id: text("id").primaryKey(),
		userId: text("user_id").notNull(),
		takenAt: integer("taken_at", { mode: "timestamp" }).notNull(),
		pose: text("pose", { enum: ["front", "side", "back", "other"] }).notNull().default("front"),
		r2Key: text("r2_key").notNull(),
		contentType: text("content_type").notNull().default("image/jpeg"),
		bytes: integer("bytes"),
		createdAt: integer("created_at", { mode: "timestamp" }).notNull().default(sql`(unixepoch())`),
	},
	(t) => [index("photos_user_taken_idx").on(t.userId, t.takenAt)],
);

/**
 * One row per user-day of nutrition logging. `date` is canonical 'YYYY-MM-DD'.
 * Weight is NOT stored here — TDEE pairs intake with same-day measurement weights.
 */
export const dailyIntake = sqliteTable(
	"daily_intake",
	{
		id: text("id").primaryKey(), // crypto.randomUUID()
		userId: text("user_id").notNull(),
		date: text("date").notNull(), // canonical 'YYYY-MM-DD'
		kcal: integer("kcal").notNull(),
		proteinG: integer("protein_g"),
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
		updatedAt: integer("updated_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [uniqueIndex("daily_intake_user_date_idx").on(t.userId, t.date)],
);

export type Measurement = typeof measurements.$inferSelect;
export type NewMeasurement = typeof measurements.$inferInsert;
export type Cycle = typeof cycles.$inferSelect;
export type Photo = typeof photos.$inferSelect;
export type DailyIntake = typeof dailyIntake.$inferSelect;
export type NewDailyIntake = typeof dailyIntake.$inferInsert;
export type UserRow = typeof user.$inferSelect;

/**
 * Landing-page email capture (waitlist / walkthrough list). No account, no PII
 * beyond the address, no marketing automation: one row, one source.
 */
export const waitlist = sqliteTable(
	"waitlist",
	{
		id: text("id").primaryKey(), // crypto.randomUUID()
		email: text("email").notNull(),
		source: text("source"), // which surface captured it ('landing-footer', ...)
		createdAt: integer("created_at", { mode: "timestamp" })
			.notNull()
			.default(sql`(unixepoch())`),
	},
	(t) => [uniqueIndex("waitlist_email_idx").on(t.email)],
);

export type WaitlistRow = typeof waitlist.$inferSelect;
