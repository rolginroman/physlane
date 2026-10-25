import { sql } from "drizzle-orm";
import {
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import {
  EQUIPMENT,
  MUSCLES,
  PROGRAM_GOALS,
  PROGRAM_LEVELS,
  type Equipment,
  type Muscle,
} from "#/lib/programs/taxonomy";

// drizzle's enum option wants a mutable tuple; taxonomy arrays are the source of truth
const muscleEnum = MUSCLES as unknown as [Muscle, ...Muscle[]];
// drizzle's enum option wants a mutable tuple; taxonomy arrays are the source of truth
const equipmentEnum = EQUIPMENT as unknown as [Equipment, ...Equipment[]];
// drizzle's enum option wants a mutable tuple; taxonomy arrays are the source of truth
const programGoalEnum = PROGRAM_GOALS as unknown as [
  (typeof PROGRAM_GOALS)[number],
  ...(typeof PROGRAM_GOALS)[number][],
];
// drizzle's enum option wants a mutable tuple; taxonomy arrays are the source of truth
const programLevelEnum = PROGRAM_LEVELS as unknown as [
  (typeof PROGRAM_LEVELS)[number],
  ...(typeof PROGRAM_LEVELS)[number][],
];

/* ── better-auth core tables ─────────────────────────────────────────── */

export const user = sqliteTable(
  "user",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    emailVerified: integer("email_verified", { mode: "boolean" })
      .notNull()
      .default(false),
    image: text("image"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    /* physlane fields */
    unitSystem: text("unit_system", { enum: ["metric", "imperial"] })
      .notNull()
      .default("metric"),
    plan: text("plan", { enum: ["free", "pro"] })
      .notNull()
      .default("free"),
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
    targetPromptLastAppliedAt: integer("target_prompt_last_applied_at", {
      mode: "timestamp",
    }),
    targetPromptLastDismissedAt: integer("target_prompt_last_dismissed_at", {
      mode: "timestamp",
    }),
    /** measured kcal at the last Apply, for the >10% re-prompt rule */
    targetPromptAppliedKcal: integer("target_prompt_applied_kcal"),
    /* public read-only progress card (migration 0005); rotating revokes links */
    shareToken: text("share_token"),
    stripeCustomerId: text("stripe_customer_id"),
    stripeSubscriptionId: text("stripe_subscription_id"),
    planCurrentPeriodEnd: integer("plan_current_period_end", {
      mode: "timestamp",
    }),
    slug: text("slug"),
    displayName: text("display_name"),
    bio: text("bio"),
    profileHiddenAt: integer("profile_hidden_at", { mode: "timestamp" }),
  },
  (t) => [
    uniqueIndex("user_email_idx").on(t.email),
    uniqueIndex("user_share_token_idx").on(t.shareToken), // SQLite: multiple NULLs allowed
    uniqueIndex("user_slug_idx").on(t.slug), // SQLite: multiple NULLs allowed
  ],
);

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
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
    accessTokenExpiresAt: integer("access_token_expires_at", {
      mode: "timestamp",
    }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", {
      mode: "timestamp",
    }),
    scope: text("scope"),
    password: text("password"),
    /* tele-better-auth (migration 0004) */
    telegramId: text("telegram_id"),
    telegramUsername: text("telegram_username"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [index("account_user_id_idx").on(t.userId)],
);

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
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
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
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
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
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
    pose: text("pose", { enum: ["front", "side", "back", "other"] })
      .notNull()
      .default("front"),
    r2Key: text("r2_key").notNull(),
    contentType: text("content_type").notNull().default("image/jpeg"),
    bytes: integer("bytes"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
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

/* ── programs domain (shareable training programs) ───────────────────── */

/** Unique normalized name per scope is enforced in app logic, not in the DB. */
export const exercises = sqliteTable(
  "exercises",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id"),
    name: text("name").notNull(),
    aliases: text("aliases", { mode: "json" })
      .$type<string[]>()
      .notNull()
      .default([]),
    musclePrimary: text("muscle_primary", { enum: muscleEnum }).notNull(),
    muscleSecondary: text("muscle_secondary", { mode: "json" })
      .$type<Muscle[]>()
      .notNull()
      .default([]),
    equipment: text("equipment", { enum: equipmentEnum }).notNull(),
    formNote: text("form_note"),
    deletedAt: integer("deleted_at", { mode: "timestamp" }),
  },
  (t) => [
    index("exercises_name_idx").on(t.name),
    index("exercises_owner_user_id_idx").on(t.ownerUserId),
  ],
);

export const exerciseAssets = sqliteTable(
  "exercise_assets",
  {
    id: text("id").primaryKey(),
    exerciseId: text("exercise_id").notNull(),
    kind: text("kind", { enum: ["video", "article", "image"] }).notNull(),
    url: text("url").notNull(),
    title: text("title").notNull(),
    sortOrder: integer("sort_order").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    index("exercise_assets_exercise_sort_idx").on(t.exerciseId, t.sortOrder),
  ],
);

export const programs = sqliteTable(
  "programs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    title: text("title").notNull(),
    description: text("description"),
    slug: text("slug"),
    visibility: text("visibility", {
      enum: ["draft", "unlisted", "public"],
    })
      .notNull()
      .default("draft"),
    weeks: integer("weeks").notNull(),
    goal: text("goal", { enum: programGoalEnum }).notNull(),
    level: text("level", { enum: programLevelEnum }).notNull(),
    daysPerWeek: integer("days_per_week").notNull(),
    equipmentTags: text("equipment_tags", { mode: "json" })
      .$type<Equipment[]>()
      .notNull()
      .default([]),
    shareToken: text("share_token"),
    forkedFromProgramId: text("forked_from_program_id"),
    forkSourceLabel: text("fork_source_label"),
    forkable: integer("forkable", { mode: "boolean" }).notNull().default(true),
    hiddenAt: integer("hidden_at", { mode: "timestamp" }),
    revision: integer("revision").notNull().default(0),
    deletedAt: integer("deleted_at", { mode: "timestamp" }),
  },
  (t) => [
    index("programs_user_visibility_deleted_idx").on(
      t.userId,
      t.visibility,
      t.deletedAt,
    ),
    index("programs_visibility_deleted_idx").on(t.visibility, t.deletedAt),
    uniqueIndex("programs_user_slug_idx").on(t.userId, t.slug),
    uniqueIndex("programs_share_token_idx").on(t.shareToken),
  ],
);

export const programSessions = sqliteTable(
  "program_sessions",
  {
    id: text("id").primaryKey(),
    programId: text("program_id").notNull(),
    weekNumber: integer("week_number").notNull(),
    orderIndex: integer("order_index").notNull(),
    title: text("title").notNull(),
    notes: text("notes"),
  },
  (t) => [
    index("program_sessions_program_week_order_idx").on(
      t.programId,
      t.weekNumber,
      t.orderIndex,
    ),
  ],
);

export const programEntries = sqliteTable(
  "program_entries",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id").notNull(),
    orderIndex: integer("order_index").notNull(),
    exerciseId: text("exercise_id").notNull(),
    groupTag: text("group_tag"),
    sets: integer("sets").notNull(),
    repsType: text("reps_type", {
      enum: ["count", "max", "seconds"],
    }).notNull(),
    repsValue: integer("reps_value"),
    loadType: text("load_type", {
      enum: ["none", "kg", "percent1rm"],
    }).notNull(),
    loadValue: real("load_value"),
    intensityType: text("intensity_type", {
      enum: ["none", "rpe", "rir"],
    }).notNull(),
    intensityValue: real("intensity_value"),
    restSeconds: integer("rest_seconds"),
    cues: text("cues"),
    refUrl: text("ref_url"),
  },
  (t) => [
    index("program_entries_session_order_idx").on(t.sessionId, t.orderIndex),
  ],
);

export const authorSlugHistory = sqliteTable("author_slug_history", {
  fromSlug: text("from_slug").primaryKey(),
  userId: text("user_id").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const programSlugHistory = sqliteTable(
  "program_slug_history",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    fromSlug: text("from_slug").notNull(),
    programId: text("program_id").notNull(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (t) => [
    uniqueIndex("program_slug_history_user_from_slug_idx").on(
      t.userId,
      t.fromSlug,
    ),
  ],
);

export const programReports = sqliteTable("program_reports", {
  id: text("id").primaryKey(),
  programId: text("program_id"),
  reportedUserId: text("reported_user_id"),
  reporterUserId: text("reporter_user_id"),
  reason: text("reason").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  handledAt: integer("handled_at", { mode: "timestamp" }),
});

export type Exercise = typeof exercises.$inferSelect;
export type NewExercise = typeof exercises.$inferInsert;
export type ExerciseAsset = typeof exerciseAssets.$inferSelect;
export type NewExerciseAsset = typeof exerciseAssets.$inferInsert;
export type Program = typeof programs.$inferSelect;
export type NewProgram = typeof programs.$inferInsert;
export type ProgramSession = typeof programSessions.$inferSelect;
export type NewProgramSession = typeof programSessions.$inferInsert;
export type ProgramEntry = typeof programEntries.$inferSelect;
export type NewProgramEntry = typeof programEntries.$inferInsert;
export type AuthorSlugHistory = typeof authorSlugHistory.$inferSelect;
export type NewAuthorSlugHistory = typeof authorSlugHistory.$inferInsert;
export type ProgramSlugHistory = typeof programSlugHistory.$inferSelect;
export type NewProgramSlugHistory = typeof programSlugHistory.$inferInsert;
export type ProgramReport = typeof programReports.$inferSelect;
export type NewProgramReport = typeof programReports.$inferInsert;

/* ── better-auth OAuth / MCP (migration via @better-auth/cli generate) ─── */

export const jwks = sqliteTable("jwks", {
  id: text("id").primaryKey(),
  publicKey: text("public_key").notNull(),
  privateKey: text("private_key").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
  alg: text("alg"),
  crv: text("crv"),
});

export const oauthClient = sqliteTable(
  "oauth_client",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id").notNull().unique(),
    clientSecret: text("client_secret"),
    clientDiscoveryId: text("client_discovery_id"),
    disabled: integer("disabled", { mode: "boolean" }).default(false),
    skipConsent: integer("skip_consent", { mode: "boolean" }),
    enableEndSession: integer("enable_end_session", { mode: "boolean" }),
    subjectType: text("subject_type"),
    scopes: text("scopes", { mode: "json" }),
    clientCredentialsScopes: text("client_credentials_scopes", {
      mode: "json",
    }).default([]),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
    name: text("name"),
    uri: text("uri"),
    icon: text("icon"),
    contacts: text("contacts", { mode: "json" }),
    tos: text("tos"),
    policy: text("policy"),
    softwareId: text("software_id"),
    softwareVersion: text("software_version"),
    softwareStatement: text("software_statement"),
    redirectUris: text("redirect_uris", { mode: "json" }).notNull(),
    postLogoutRedirectUris: text("post_logout_redirect_uris", { mode: "json" }),
    backchannelLogoutUri: text("backchannel_logout_uri"),
    backchannelLogoutSessionRequired: integer(
      "backchannel_logout_session_required",
      {
        mode: "boolean",
      },
    ),
    tokenEndpointAuthMethod: text("token_endpoint_auth_method"),
    applicationType: text("application_type"),
    jwks: text("jwks"),
    jwksUri: text("jwks_uri"),
    grantTypes: text("grant_types", { mode: "json" }),
    responseTypes: text("response_types", { mode: "json" }),
    requirePKCE: integer("require_pkce", { mode: "boolean" }),
    dpopBoundAccessTokens: integer("dpop_bound_access_tokens", {
      mode: "boolean",
    }).default(false),
    referenceId: text("reference_id"),
    metadata: text("metadata", { mode: "json" }),
  },
  (t) => [index("oauthClient_userId_idx").on(t.userId)],
);

export const oauthResource = sqliteTable("oauth_resource", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull().unique(),
  name: text("name").notNull(),
  accessTokenTtl: integer("access_token_ttl"),
  refreshTokenTtl: integer("refresh_token_ttl"),
  signingAlgorithm: text("signing_algorithm"),
  signingKeyId: text("signing_key_id"),
  allowedScopes: text("allowed_scopes", { mode: "json" }),
  customClaims: text("custom_claims", { mode: "json" }),
  dpopBoundAccessTokensRequired: integer("dpop_bound_access_tokens_required", {
    mode: "boolean",
  }).default(false),
  disabled: integer("disabled", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  policyVersion: integer("policy_version").default(1),
  metadata: text("metadata", { mode: "json" }),
});

export const oauthClientResource = sqliteTable(
  "oauth_client_resource",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    resourceId: text("resource_id")
      .notNull()
      .references(() => oauthResource.identifier, { onDelete: "cascade" }),
    metadata: text("metadata", { mode: "json" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("oauthClientResource_clientId_idx").on(t.clientId),
    index("oauthClientResource_resourceId_idx").on(t.resourceId),
  ],
);

export const oauthRefreshToken = sqliteTable(
  "oauth_refresh_token",
  {
    id: text("id").primaryKey(),
    token: text("token").notNull().unique(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    sessionId: text("session_id").references(() => session.id, {
      onDelete: "set null",
    }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    referenceId: text("reference_id"),
    authorizationCodeId: text("authorization_code_id"),
    resources: text("resources", { mode: "json" }),
    requestedUserInfoClaims: text("requested_user_info_claims", {
      mode: "json",
    }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }),
    revoked: integer("revoked", { mode: "timestamp_ms" }),
    rotatedAt: integer("rotated_at", { mode: "timestamp_ms" }),
    rotationReplayResponse: text("rotation_replay_response"),
    rotationReplayExpiresAt: integer("rotation_replay_expires_at", {
      mode: "timestamp_ms",
    }),
    authTime: integer("auth_time", { mode: "timestamp_ms" }),
    confirmation: text("confirmation", { mode: "json" }),
    scopes: text("scopes", { mode: "json" }).notNull(),
  },
  (t) => [
    index("oauthRefreshToken_clientId_idx").on(t.clientId),
    index("oauthRefreshToken_sessionId_idx").on(t.sessionId),
    index("oauthRefreshToken_userId_idx").on(t.userId),
    index("oauthRefreshToken_authorizationCodeId_idx").on(
      t.authorizationCodeId,
    ),
  ],
);

export const oauthAccessToken = sqliteTable(
  "oauth_access_token",
  {
    id: text("id").primaryKey(),
    token: text("token").unique(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    sessionId: text("session_id").references(() => session.id, {
      onDelete: "set null",
    }),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    referenceId: text("reference_id"),
    authorizationCodeId: text("authorization_code_id"),
    resources: text("resources", { mode: "json" }),
    requestedUserInfoClaims: text("requested_user_info_claims", {
      mode: "json",
    }),
    refreshId: text("refresh_id").references(() => oauthRefreshToken.id, {
      onDelete: "cascade",
    }),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }),
    createdAt: integer("created_at", { mode: "timestamp_ms" }),
    revoked: integer("revoked", { mode: "timestamp_ms" }),
    confirmation: text("confirmation", { mode: "json" }),
    scopes: text("scopes", { mode: "json" }).notNull(),
  },
  (t) => [
    index("oauthAccessToken_clientId_idx").on(t.clientId),
    index("oauthAccessToken_sessionId_idx").on(t.sessionId),
    index("oauthAccessToken_userId_idx").on(t.userId),
    index("oauthAccessToken_authorizationCodeId_idx").on(t.authorizationCodeId),
    index("oauthAccessToken_refreshId_idx").on(t.refreshId),
  ],
);

export const oauthConsent = sqliteTable(
  "oauth_consent",
  {
    id: text("id").primaryKey(),
    clientId: text("client_id")
      .notNull()
      .references(() => oauthClient.clientId, { onDelete: "cascade" }),
    userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
    referenceId: text("reference_id"),
    resources: text("resources", { mode: "json" }),
    requestedUserInfoClaims: text("requested_user_info_claims", {
      mode: "json",
    }),
    scopes: text("scopes", { mode: "json" }).notNull(),
    createdAt: integer("created_at", { mode: "timestamp_ms" }),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("oauthConsent_clientId_idx").on(t.clientId),
    index("oauthConsent_userId_idx").on(t.userId),
  ],
);

export const oauthClientAssertion = sqliteTable("oauth_client_assertion", {
  id: text("id").primaryKey(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
});
