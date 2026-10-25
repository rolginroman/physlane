import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { env } from "cloudflare:workers";
import type { BatchItem } from "drizzle-orm/batch";
import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  max,
  or,
  sql,
} from "drizzle-orm";
import { z } from "zod";
import { useDb } from "#/db/client";
import * as schema from "#/db/schema";
import { appError } from "#/lib/app-error";
import {
  entrySchema,
  programMetaSchema,
  sessionSchema,
  type ProgramEntry,
} from "#/lib/programs/program-shape";
import {
  EQUIPMENT,
  MUSCLES,
  type Equipment,
  type Muscle,
} from "#/lib/programs/taxonomy";
import { newShareToken, publicFirstName } from "#/lib/share";
import {
  filterExercisesForSearch,
  rankExercisesForSearch,
} from "#/lib/programs/exercise-search";
import { isProgramIdRef } from "#/lib/programs/program-id-ref";
import { suggestSlug } from "#/lib/programs/slug";
import { requireUser } from "./auth.fns";
import {
  assertAuthor,
  assertProgramUsable,
  assertSessionWeekInProgram,
  assertSlugAvailable,
  authorSlugHistoryRowsToKeep,
  authorSlugRenameAllowedAt,
  customExerciseInputSchema,
  isSlugHistoryReserved,
  listPublicProgramsByAuthor,
  nextRevision,
  normalizeExerciseName,
  planAuthorProfileSave,
  planVisibilityTransition,
  assertForkAllowed,
  buildForkSourceLabel,
  planForkSessionCopies,
  forkEntryPayloadFromPlan,
  mintAuthorSlugForShare,
  throwIfSlugUniqueViolation,
  resolveAuthorProfileRedirect,
  resolveAuthorSlugLookup,
  resolveProgramRedirect,
  resolvePublicProgramView,
  revisionGuard,
  reportProgramReasonSchema,
  suggestAuthorSlug,
  suggestProgramSlug,
  validateSessionEntries,
  publicProgramRemovalVariant,
  assertProgramWeeksCoversSessions,
  assertAnonymousReportRateAllowed,
  assertNoDuplicateCustomExerciseName,
  authorSlugMintBase,
  inheritedForeignCustomIdsFromExerciseOwners,
  mintProgramSlugForShare,
  planProgramSlugRename,
  programSlugHistoryRowsToKeep,
  type ProgramRedirectRow,
} from "./programs.core";
import { loadSessionUser } from "#/server/auth.core";
import { validateSlug } from "#/lib/programs/slug";

export type ProgramEntryDTO = ProgramEntry & { id: string; orderIndex: number };

export type ProgramSessionDTO = {
  id: string;
  weekNumber: number;
  orderIndex: number;
  title: string;
  notes: string | null;
  entries: ProgramEntryDTO[];
};

export type ProgramExerciseRefDTO = {
  name: string;
  musclePrimary: Muscle;
  equipment: Equipment;
  formNote: string | null;
  isCustom: boolean;
};

export type ProgramDTO = {
  id: string;
  title: string;
  description: string | null;
  visibility: "draft" | "unlisted" | "public";
  weeks: number;
  goal: schema.Program["goal"];
  level: schema.Program["level"];
  daysPerWeek: number;
  equipmentTags: Equipment[];
  revision: number;
  updatedAt: string;
  forkSourceLabel: string | null;
  slug: string | null;
  shareToken: string | null;
  hiddenAt: string | null;
  createdAt: string;
  sessions?: ProgramSessionDTO[];
  exercises?: Record<string, ProgramExerciseRefDTO>;
};

export type ProgramListItemDTO = Pick<
  ProgramDTO,
  | "id"
  | "title"
  | "description"
  | "visibility"
  | "weeks"
  | "goal"
  | "level"
  | "daysPerWeek"
  | "equipmentTags"
  | "revision"
  | "updatedAt"
  | "forkSourceLabel"
  | "slug"
  | "shareToken"
  | "hiddenAt"
  | "createdAt"
>;

export type PublicProgramAuthorDTO = {
  userId: string;
  displayName: string | null;
  authorSlug: string | null;
};

export type PublicAuthorProfileProgramDTO = {
  id: string;
  title: string;
  description: string | null;
  slug: string;
  goal: schema.Program["goal"];
  level: schema.Program["level"];
  daysPerWeek: number;
  weeks: number;
  updatedAt: string;
};

export type PublicAuthorProfileDTO = {
  displayName: string;
  authorSlug: string;
  bio: string | null;
  programs: PublicAuthorProfileProgramDTO[];
  isOwner: boolean;
  unavailable: boolean;
};

export type AuthorProfileSetupDTO = {
  displayName: string;
  authorSlug: string | null;
  bio: string | null;
  slugRenameAllowedFrom: string | null;
};

export type PublicProgramDTO = ProgramDTO & {
  sessions: ProgramSessionDTO[];
  exercises: Record<string, ProgramExerciseRefDTO>;
  author: PublicProgramAuthorDTO;
  forkable: boolean;
};

export type PublicProgramRemovalDTO = {
  variant: "author" | "moderation";
  authorSlug: string | null;
  authorDisplayName: string | null;
  hasPublicProfile: boolean;
};

export type ExercisePickerRowDTO = {
  id: string;
  name: string;
  aliases: string[];
  musclePrimary: Muscle;
  muscleSecondary: Muscle[];
  equipment: Equipment;
  formNote: string | null;
  isCustom: boolean;
  hasVideo: boolean;
  hasArticle: boolean;
};

const toProgramDTO = (
  row: schema.Program,
  sessions?: ProgramSessionDTO[],
): ProgramDTO => ({
  id: row.id,
  title: row.title,
  description: row.description,
  visibility: row.visibility,
  weeks: row.weeks,
  goal: row.goal,
  level: row.level,
  daysPerWeek: row.daysPerWeek,
  equipmentTags: row.equipmentTags,
  revision: row.revision,
  updatedAt: row.updatedAt.toISOString(),
  forkSourceLabel: row.forkSourceLabel,
  slug: row.slug,
  shareToken: row.shareToken,
  hiddenAt: row.hiddenAt?.toISOString() ?? null,
  createdAt: row.createdAt.toISOString(),
  ...(sessions !== undefined ? { sessions } : {}),
});

const toListItemDTO = (row: schema.Program): ProgramListItemDTO =>
  toProgramDTO(row);

async function loadAuthorProgram(
  programId: string,
  meId: string,
): Promise<schema.Program> {
  const [program] = await useDb()
    .select()
    .from(schema.programs)
    .where(eq(schema.programs.id, programId))
    .limit(1);
  if (!program) {
    throw appError("PROGRAM_NOT_FOUND");
  }
  assertAuthor(program, meId);
  assertProgramUsable(program, { isOwner: true });
  return program;
}

async function loadExerciseReferenceSets(authorUserId: string) {
  const db = useDb();
  const rows = await db
    .select({
      id: schema.exercises.id,
      ownerUserId: schema.exercises.ownerUserId,
    })
    .from(schema.exercises)
    .where(
      and(
        isNull(schema.exercises.deletedAt),
        or(
          isNull(schema.exercises.ownerUserId),
          eq(schema.exercises.ownerUserId, authorUserId),
        ),
      ),
    );
  const catalogIds = new Set<string>();
  const myCustomIds = new Set<string>();
  for (const row of rows) {
    if (row.ownerUserId == null) {
      catalogIds.add(row.id);
    } else {
      myCustomIds.add(row.id);
    }
  }
  return { catalogIds, myCustomIds };
}

/** Foreign customs already referenced anywhere in this program (fork inheritance). */
async function inheritedForeignCustomIdsForProgram(
  programId: string,
  programAuthorId: string,
): Promise<Set<string>> {
  const db = useDb();
  const sessionRows = await db
    .select({ id: schema.programSessions.id })
    .from(schema.programSessions)
    .where(eq(schema.programSessions.programId, programId));
  if (sessionRows.length === 0) {
    return new Set();
  }
  const sessionIds = sessionRows.map((s) => s.id);
  const entryRows = await db
    .select({ exerciseId: schema.programEntries.exerciseId })
    .from(schema.programEntries)
    .where(inArray(schema.programEntries.sessionId, sessionIds));
  if (entryRows.length === 0) {
    return new Set();
  }
  const exerciseIds = [...new Set(entryRows.map((r) => r.exerciseId))];
  const exerciseRows = await db
    .select({
      id: schema.exercises.id,
      ownerUserId: schema.exercises.ownerUserId,
    })
    .from(schema.exercises)
    .where(inArray(schema.exercises.id, exerciseIds));
  const owners = new Map(
    exerciseRows.map((ex) => [ex.id, ex.ownerUserId] as const),
  );
  return inheritedForeignCustomIdsFromExerciseOwners(
    entryRows,
    owners,
    programAuthorId,
  );
}

async function loadProgramExerciseMap(
  sessions: ProgramSessionDTO[],
): Promise<Record<string, ProgramExerciseRefDTO>> {
  const ids = new Set<string>();
  for (const session of sessions) {
    for (const entry of session.entries) {
      ids.add(entry.exerciseId);
    }
  }
  if (ids.size === 0) {
    return {};
  }
  const db = useDb();
  const rows = await db
    .select()
    .from(schema.exercises)
    .where(inArray(schema.exercises.id, [...ids]));
  const map: Record<string, ProgramExerciseRefDTO> = {};
  for (const row of rows) {
    map[row.id] = {
      name: row.name,
      musclePrimary: row.musclePrimary,
      equipment: row.equipment,
      formNote: row.formNote,
      isCustom: row.ownerUserId != null,
    };
  }
  return map;
}

function resolvePublicAuthorDisplayName(author: {
  displayName: string | null;
  name: string | null;
}): string | null {
  return author.displayName ?? publicFirstName(author.name);
}

async function loadAuthorRow(userId: string): Promise<schema.UserRow> {
  const [author] = await useDb()
    .select()
    .from(schema.user)
    .where(eq(schema.user.id, userId))
    .limit(1);
  if (!author) {
    throw appError("PROGRAM_NOT_FOUND");
  }
  return author;
}

async function takenProgramSlugsForAuthor(
  authorUserId: string,
  now: Date,
): Promise<string[]> {
  const db = useDb();
  const programRows = await db
    .select({ slug: schema.programs.slug })
    .from(schema.programs)
    .where(eq(schema.programs.userId, authorUserId));
  const historyRows = await db
    .select({
      fromSlug: schema.programSlugHistory.fromSlug,
      createdAt: schema.programSlugHistory.createdAt,
    })
    .from(schema.programSlugHistory)
    .where(eq(schema.programSlugHistory.userId, authorUserId));

  const taken = new Set<string>();
  for (const row of programRows) {
    if (row.slug) {
      taken.add(row.slug);
    }
  }
  for (const row of historyRows) {
    if (isSlugHistoryReserved(row.createdAt, now)) {
      taken.add(row.fromSlug);
    }
  }
  return [...taken];
}

async function runSlugSafeBatch(batch: BatchItem<"sqlite">[]): Promise<void> {
  const db = useDb();
  try {
    await db.batch(batch as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
  } catch (error) {
    throwIfSlugUniqueViolation(error);
  }
}

async function bumpProgramRevisionIfMatch(
  programId: string,
  expectedRevision: number,
  now: Date,
): Promise<schema.Program> {
  const [row] = await useDb()
    .update(schema.programs)
    .set({
      revision: nextRevision(expectedRevision),
      updatedAt: now,
    })
    .where(
      and(
        eq(schema.programs.id, programId),
        eq(schema.programs.revision, expectedRevision),
      ),
    )
    .returning();
  if (!row) {
    throw appError("STALE_REVISION");
  }
  return row;
}

async function revertProgramRevisionBump(
  programId: string,
  expectedRevision: number,
): Promise<void> {
  await useDb()
    .update(schema.programs)
    .set({ revision: expectedRevision })
    .where(
      and(
        eq(schema.programs.id, programId),
        eq(schema.programs.revision, nextRevision(expectedRevision)),
      ),
    );
}

/** Bump revision as a lock, run mutation batch, revert revision if batch fails. */
async function withRevisionBumpThenBatch(
  programId: string,
  expectedRevision: number,
  now: Date,
  runBatch: () => Promise<void>,
): Promise<void> {
  await bumpProgramRevisionIfMatch(programId, expectedRevision, now);
  try {
    await runBatch();
  } catch (error) {
    await revertProgramRevisionBump(programId, expectedRevision);
    throw error;
  }
}

async function authorSlugTakenByOtherUser(
  slug: string,
  exceptUserId: string,
): Promise<boolean> {
  const [row] = await useDb()
    .select({ id: schema.user.id })
    .from(schema.user)
    .where(eq(schema.user.slug, slug))
    .limit(1);
  return row != null && row.id !== exceptUserId;
}

async function reservedAuthorSlugHistoryForSlugs(
  slugs: string[],
  now: Date,
): Promise<Array<{ slug: string; createdAt: Date; userId: string }>> {
  if (slugs.length === 0) {
    return [];
  }
  const rows = await useDb()
    .select({
      slug: schema.authorSlugHistory.fromSlug,
      createdAt: schema.authorSlugHistory.createdAt,
      userId: schema.authorSlugHistory.userId,
    })
    .from(schema.authorSlugHistory)
    .where(inArray(schema.authorSlugHistory.fromSlug, slugs));
  return rows
    .filter((row) => isSlugHistoryReserved(row.createdAt, now))
    .map((row) => ({
      slug: row.slug,
      createdAt: row.createdAt,
      userId: row.userId,
    }));
}

async function takenAuthorSlugsWithPrefix(
  prefix: string,
  now: Date,
): Promise<string[]> {
  const pattern = `${prefix.toLowerCase()}%`;
  const db = useDb();
  const userRows = await db
    .select({ slug: schema.user.slug })
    .from(schema.user)
    .where(sql`lower(${schema.user.slug}) like ${pattern}`);
  const historyRows = await db
    .select({
      fromSlug: schema.authorSlugHistory.fromSlug,
      createdAt: schema.authorSlugHistory.createdAt,
    })
    .from(schema.authorSlugHistory)
    .where(sql`lower(${schema.authorSlugHistory.fromSlug}) like ${pattern}`);
  const taken = new Set<string>();
  for (const row of userRows) {
    if (row.slug) {
      taken.add(row.slug);
    }
  }
  for (const row of historyRows) {
    if (isSlugHistoryReserved(row.createdAt, now)) {
      taken.add(row.fromSlug);
    }
  }
  return [...taken];
}

async function takenAuthorSlugsForShareMint(
  label: string,
  now: Date,
): Promise<string[]> {
  const bases = new Set([authorSlugMintBase(label), "author"]);
  const taken = new Set<string>();
  for (const base of bases) {
    for (const slug of await takenAuthorSlugsWithPrefix(base, now)) {
      taken.add(slug);
    }
  }
  return [...taken];
}

async function hashReporterIp(rawIp: string): Promise<string> {
  const secret = env.AUTH_SECRET ?? "dev-insecure-secret-change-me";
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(rawIp),
  );
  return [...new Uint8Array(sig)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function clientIpFromHeaders(headers: Headers): string | null {
  const direct = headers.get("CF-Connecting-IP")?.trim();
  if (direct) {
    return direct;
  }
  const forwarded = headers.get("X-Forwarded-For")?.split(",")[0]?.trim();
  return forwarded || null;
}

async function countAnonymousReportsToday(ipHash: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const [row] = await useDb()
    .select({ count: sql<number>`count(*)` })
    .from(schema.programReports)
    .where(
      and(
        eq(schema.programReports.reporterIpHash, ipHash),
        isNull(schema.programReports.reporterUserId),
        gte(schema.programReports.createdAt, startOfDay),
      ),
    );
  return row?.count ?? 0;
}

async function buildPublicProgramDTO(
  program: schema.Program,
): Promise<PublicProgramDTO> {
  const author = await loadAuthorRow(program.userId);
  const sessions = await loadProgramSessionsDTO(program.id);
  const exercises = await loadProgramExerciseMap(sessions);
  const dto = toProgramDTO(program, sessions);
  return {
    ...dto,
    sessions,
    exercises,
    author: {
      userId: author.id,
      displayName: resolvePublicAuthorDisplayName(author),
      authorSlug: author.slug,
    },
    forkable: program.forkable,
  };
}

async function buildRemovalDTO(
  program: schema.Program,
  variant: "author" | "moderation",
): Promise<PublicProgramRemovalDTO> {
  const author = await loadAuthorRow(program.userId);
  const hasPublicProfile =
    author.profilePublishedAt != null && author.profileHiddenAt == null;
  return {
    variant,
    authorSlug: author.slug,
    authorDisplayName: resolvePublicAuthorDisplayName(author),
    hasPublicProfile,
  };
}

function assertViewerVisibility(
  program: schema.Program,
  mode: "token" | "public-only",
): void {
  const outcome = resolvePublicProgramView(program, mode);
  if (outcome.kind === "removed_by_author") {
    throw appError("PROGRAM_REMOVED");
  }
  if (outcome.kind === "unavailable") {
    throw appError("PROGRAM_UNAVAILABLE");
  }
  if (outcome.kind === "not_found") {
    throw appError("PROGRAM_NOT_FOUND");
  }
}

async function loadProgramSessionsDTO(
  programId: string,
): Promise<ProgramSessionDTO[]> {
  const db = useDb();
  const sessions = await db
    .select()
    .from(schema.programSessions)
    .where(eq(schema.programSessions.programId, programId))
    .orderBy(
      asc(schema.programSessions.weekNumber),
      asc(schema.programSessions.orderIndex),
    );
  if (sessions.length === 0) {
    return [];
  }
  const sessionIds = sessions.map((s) => s.id);
  const entries = await db
    .select()
    .from(schema.programEntries)
    .where(inArray(schema.programEntries.sessionId, sessionIds))
    .orderBy(
      asc(schema.programEntries.sessionId),
      asc(schema.programEntries.orderIndex),
    );
  const entriesBySession = new Map<string, ProgramEntryDTO[]>();
  for (const entry of entries) {
    const list = entriesBySession.get(entry.sessionId) ?? [];
    list.push({
      id: entry.id,
      orderIndex: entry.orderIndex,
      exerciseId: entry.exerciseId,
      groupTag: entry.groupTag,
      sets: entry.sets,
      repsType: entry.repsType,
      repsValue: entry.repsValue,
      loadType: entry.loadType,
      loadValue: entry.loadValue,
      intensityType: entry.intensityType,
      intensityValue: entry.intensityValue,
      restSeconds: entry.restSeconds,
      cues: entry.cues,
      refUrl: entry.refUrl,
    });
    entriesBySession.set(entry.sessionId, list);
  }
  return sessions.map((s) => ({
    id: s.id,
    weekNumber: s.weekNumber,
    orderIndex: s.orderIndex,
    title: s.title,
    notes: s.notes,
    entries: entriesBySession.get(s.id) ?? [],
  }));
}

const CreateProgramInputSchema = programMetaSchema;

export const createProgram = createServerFn({ method: "POST" })
  .validator((d) => CreateProgramInputSchema.parse(d))
  .handler(async ({ data }) => {
    const me = await requireUser();
    const id = crypto.randomUUID();
    const now = new Date();
    const [row] = await useDb()
      .insert(schema.programs)
      .values({
        id,
        userId: me.id,
        title: data.title,
        description: data.description ?? null,
        visibility: "draft",
        weeks: data.weeks,
        goal: data.goal,
        level: data.level,
        daysPerWeek: data.daysPerWeek,
        equipmentTags: data.equipmentTags,
        revision: 0,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    if (!row) {
      throw appError("NOT_READY");
    }
    return toProgramDTO(row, []);
  });

const GetMyProgramInputSchema = z.object({
  programId: z.string().min(1),
});

export const getMyProgram = createServerFn({ method: "GET" })
  .validator((d) => GetMyProgramInputSchema.parse(d))
  .handler(async ({ data }) => {
    const me = await requireUser();
    const program = await loadAuthorProgram(data.programId, me.id);
    const sessions = await loadProgramSessionsDTO(program.id);
    const exercises = await loadProgramExerciseMap(sessions);
    return { ...toProgramDTO(program, sessions), exercises };
  });

export const listMyPrograms = createServerFn({ method: "GET" }).handler(
  async () => {
    const me = await requireUser();
    const rows = await useDb()
      .select()
      .from(schema.programs)
      .where(
        and(
          eq(schema.programs.userId, me.id),
          isNull(schema.programs.deletedAt),
        ),
      )
      .orderBy(desc(schema.programs.updatedAt));
    return rows.map(toListItemDTO);
  },
);

const UpdateProgramMetaInputSchema = z.object({
  programId: z.string().min(1),
  expectedRevision: z.number().int().min(0),
  meta: programMetaSchema,
});

export const updateProgramMeta = createServerFn({ method: "POST" })
  .validator((d) => UpdateProgramMetaInputSchema.parse(d))
  .handler(async ({ data }) => {
    const me = await requireUser();
    const program = await loadAuthorProgram(data.programId, me.id);
    revisionGuard(data.expectedRevision, program.revision);
    const [maxWeekRow] = await useDb()
      .select({ maxWeek: max(schema.programSessions.weekNumber) })
      .from(schema.programSessions)
      .where(eq(schema.programSessions.programId, program.id));
    const maxSessionWeek =
      maxWeekRow?.maxWeek != null ? Number(maxWeekRow.maxWeek) : null;
    assertProgramWeeksCoversSessions(data.meta.weeks, maxSessionWeek);
    const now = new Date();
    const revision = nextRevision(program.revision);
    const [row] = await useDb()
      .update(schema.programs)
      .set({
        title: data.meta.title,
        description: data.meta.description ?? null,
        weeks: data.meta.weeks,
        goal: data.meta.goal,
        level: data.meta.level,
        daysPerWeek: data.meta.daysPerWeek,
        equipmentTags: data.meta.equipmentTags,
        revision,
        updatedAt: now,
      })
      .where(
        and(
          eq(schema.programs.id, program.id),
          eq(schema.programs.revision, data.expectedRevision),
        ),
      )
      .returning();
    if (!row) {
      throw appError("STALE_REVISION");
    }
    const sessions = await loadProgramSessionsDTO(row.id);
    return toProgramDTO(row, sessions);
  });

const UpsertSessionInputSchema = z.object({
  programId: z.string().min(1),
  expectedRevision: z.number().int().min(0),
  session: sessionSchema.extend({
    id: z.string().min(1).optional(),
  }),
});

export const upsertSession = createServerFn({ method: "POST" })
  .validator((d) => UpsertSessionInputSchema.parse(d))
  .handler(async ({ data }) => {
    const me = await requireUser();
    const program = await loadAuthorProgram(data.programId, me.id);
    revisionGuard(data.expectedRevision, program.revision);
    const parsedSession = sessionSchema.parse(data.session);
    assertSessionWeekInProgram(parsedSession, program.weeks);

    const sessionId = data.session.id ?? crypto.randomUUID();
    const db = useDb();
    let existingSession: schema.ProgramSession | undefined;
    if (data.session.id) {
      const [row] = await db
        .select()
        .from(schema.programSessions)
        .where(
          and(
            eq(schema.programSessions.id, sessionId),
            eq(schema.programSessions.programId, program.id),
          ),
        )
        .limit(1);
      existingSession = row;
    }

    const { catalogIds, myCustomIds } = await loadExerciseReferenceSets(
      program.userId,
    );
    const inheritedForeignCustomIds = await inheritedForeignCustomIdsForProgram(
      program.id,
      program.userId,
    );

    validateSessionEntries(parsedSession.entries, {
      catalogIds,
      myCustomIds,
      inheritedForeignCustomIds,
    });

    const now = new Date();

    const upsertBatch: BatchItem<"sqlite">[] = [];
    if (existingSession) {
      upsertBatch.push(
        db
          .update(schema.programSessions)
          .set({
            weekNumber: parsedSession.weekNumber,
            orderIndex: parsedSession.orderIndex,
            title: parsedSession.title,
            notes: parsedSession.notes ?? null,
          })
          .where(eq(schema.programSessions.id, sessionId)),
        db
          .delete(schema.programEntries)
          .where(eq(schema.programEntries.sessionId, sessionId)),
      );
    } else {
      upsertBatch.push(
        db.insert(schema.programSessions).values({
          id: sessionId,
          programId: program.id,
          weekNumber: parsedSession.weekNumber,
          orderIndex: parsedSession.orderIndex,
          title: parsedSession.title,
          notes: parsedSession.notes ?? null,
        }),
      );
    }

    for (let i = 0; i < parsedSession.entries.length; i++) {
      const entry = parsedSession.entries[i];
      const validated = entrySchema.parse(entry);
      upsertBatch.push(
        db.insert(schema.programEntries).values({
          id: crypto.randomUUID(),
          sessionId,
          orderIndex: i,
          exerciseId: validated.exerciseId,
          groupTag: validated.groupTag ?? null,
          sets: validated.sets,
          repsType: validated.repsType,
          repsValue: validated.repsValue,
          loadType: validated.loadType,
          loadValue: validated.loadValue,
          intensityType: validated.intensityType,
          intensityValue: validated.intensityValue,
          restSeconds: validated.restSeconds ?? null,
          cues: validated.cues ?? null,
          refUrl: validated.refUrl ?? null,
        }),
      );
    }

    await withRevisionBumpThenBatch(
      program.id,
      data.expectedRevision,
      now,
      async () => {
        if (upsertBatch.length === 1) {
          await upsertBatch[0];
        } else {
          await db.batch(
            upsertBatch as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]],
          );
        }
      },
    );

    const sessions = await loadProgramSessionsDTO(program.id);
    const [updatedProgram] = await db
      .select()
      .from(schema.programs)
      .where(eq(schema.programs.id, program.id))
      .limit(1);
    if (!updatedProgram) {
      throw appError("PROGRAM_NOT_FOUND");
    }
    return toProgramDTO(updatedProgram, sessions);
  });

const RemoveSessionInputSchema = z.object({
  programId: z.string().min(1),
  expectedRevision: z.number().int().min(0),
  sessionId: z.string().min(1),
});

export const removeSession = createServerFn({ method: "POST" })
  .validator((d) => RemoveSessionInputSchema.parse(d))
  .handler(async ({ data }) => {
    const me = await requireUser();
    const program = await loadAuthorProgram(data.programId, me.id);
    revisionGuard(data.expectedRevision, program.revision);

    const db = useDb();
    const [session] = await db
      .select()
      .from(schema.programSessions)
      .where(
        and(
          eq(schema.programSessions.id, data.sessionId),
          eq(schema.programSessions.programId, program.id),
        ),
      )
      .limit(1);
    if (!session) {
      const sessions = await loadProgramSessionsDTO(program.id);
      return toProgramDTO(program, sessions);
    }

    const now = new Date();
    await withRevisionBumpThenBatch(
      program.id,
      data.expectedRevision,
      now,
      async () => {
        await db.batch([
          db
            .delete(schema.programEntries)
            .where(eq(schema.programEntries.sessionId, data.sessionId)),
          db
            .delete(schema.programSessions)
            .where(eq(schema.programSessions.id, data.sessionId)),
        ]);
      },
    );

    const sessions = await loadProgramSessionsDTO(program.id);
    const [updatedProgram] = await db
      .select()
      .from(schema.programs)
      .where(eq(schema.programs.id, program.id))
      .limit(1);
    if (!updatedProgram) {
      throw appError("PROGRAM_NOT_FOUND");
    }
    return toProgramDTO(updatedProgram, sessions);
  });

export const upsertCustomExercise = createServerFn({ method: "POST" })
  .validator((d) => customExerciseInputSchema.parse(d))
  .handler(async ({ data }) => {
    const me = await requireUser();
    const normalized = normalizeExerciseName(data.name);
    const db = useDb();
    const candidates = await db
      .select({
        id: schema.exercises.id,
        name: schema.exercises.name,
        ownerUserId: schema.exercises.ownerUserId,
        deletedAt: schema.exercises.deletedAt,
      })
      .from(schema.exercises)
      .where(
        or(
          isNull(schema.exercises.ownerUserId),
          eq(schema.exercises.ownerUserId, me.id),
        ),
      );
    assertNoDuplicateCustomExerciseName(normalized, candidates);

    const id = crypto.randomUUID();
    const [row] = await db
      .insert(schema.exercises)
      .values({
        id,
        ownerUserId: me.id,
        name: data.name.trim(),
        aliases: data.aliases,
        musclePrimary: data.musclePrimary,
        muscleSecondary: data.muscleSecondary,
        equipment: data.equipment,
        formNote: data.formNote ?? null,
        deletedAt: null,
      })
      .returning();
    if (!row) {
      throw appError("NOT_READY");
    }
    return {
      id: row.id,
      name: row.name,
      aliases: row.aliases,
      musclePrimary: row.musclePrimary,
      muscleSecondary: row.muscleSecondary,
      equipment: row.equipment,
      formNote: row.formNote,
    };
  });

const SearchCatalogExercisesInputSchema = z.object({
  query: z.string().default(""),
  equipment: z.enum(EQUIPMENT).optional(),
  muscle: z.enum(MUSCLES).optional(),
});

export const searchCatalogExercises = createServerFn({ method: "GET" })
  .validator((d) => SearchCatalogExercisesInputSchema.parse(d))
  .handler(async ({ data }) => {
    const me = await requireUser();
    const db = useDb();
    const rows = await db
      .select()
      .from(schema.exercises)
      .where(
        and(
          isNull(schema.exercises.deletedAt),
          or(
            isNull(schema.exercises.ownerUserId),
            eq(schema.exercises.ownerUserId, me.id),
          ),
        ),
      );

    const filtered = filterExercisesForSearch(rows, {
      query: data.query,
      equipment: data.equipment,
      muscle: data.muscle,
    });
    const ranked = rankExercisesForSearch(filtered, data.query, 50).map(
      (row) => ({ row }),
    );

    const rankedIds = ranked.map(({ row }) => row.id);
    const assetHints = new Map<
      string,
      { hasVideo: boolean; hasArticle: boolean }
    >();
    if (rankedIds.length > 0) {
      const assetRows = await db
        .select({
          exerciseId: schema.exerciseAssets.exerciseId,
          hasVideo: sql<number>`max(case when ${schema.exerciseAssets.kind} = 'video' then 1 else 0 end)`,
          hasArticle: sql<number>`max(case when ${schema.exerciseAssets.kind} = 'article' then 1 else 0 end)`,
        })
        .from(schema.exerciseAssets)
        .where(inArray(schema.exerciseAssets.exerciseId, rankedIds))
        .groupBy(schema.exerciseAssets.exerciseId);
      for (const hint of assetRows) {
        assetHints.set(hint.exerciseId, {
          hasVideo: hint.hasVideo > 0,
          hasArticle: hint.hasArticle > 0,
        });
      }
    }

    return ranked.map(({ row }) => {
      const hints = assetHints.get(row.id);
      return {
        id: row.id,
        name: row.name,
        aliases: row.aliases,
        musclePrimary: row.musclePrimary,
        muscleSecondary: row.muscleSecondary,
        equipment: row.equipment,
        formNote: row.formNote,
        isCustom: row.ownerUserId != null,
        hasVideo: hints?.hasVideo ?? false,
        hasArticle: hints?.hasArticle ?? false,
      };
    }) satisfies ExercisePickerRowDTO[];
  });

const SetVisibilityInputSchema = z.object({
  programId: z.string().min(1),
  target: z.enum(["draft", "unlisted", "public"]),
});

export const setVisibility = createServerFn({ method: "POST" })
  .validator((d) => SetVisibilityInputSchema.parse(d))
  .handler(async ({ data }) => {
    const me = await requireUser();
    const program = await loadAuthorProgram(data.programId, me.id);
    const author = await loadAuthorRow(program.userId);
    const planned = planVisibilityTransition(
      program.visibility,
      data.target,
      { hiddenAt: program.hiddenAt, slug: program.slug },
      { slug: author.slug },
    );
    if (!planned.ok) {
      throw appError(planned.code);
    }
    const { effects } = planned;
    const now = new Date();
    const revision = nextRevision(program.revision);

    let nextShareToken = program.shareToken;
    if (effects.clearShareToken) {
      nextShareToken = null;
    }
    if (effects.mintShareToken) {
      nextShareToken = newShareToken();
    }

    let nextProgramSlug = program.slug;
    if (effects.mintProgramSlug) {
      const taken = await takenProgramSlugsForAuthor(program.userId, now);
      nextProgramSlug = mintProgramSlugForShare(program.title, taken);
    }

    let authorSlugUpdate: string | undefined;
    let authorDisplayNameUpdate: string | null | undefined;
    if (effects.mintAuthorSlug) {
      const label =
        author.displayName ?? publicFirstName(author.name) ?? "author";
      const taken = await takenAuthorSlugsForShareMint(label, now);
      const candidate = mintAuthorSlugForShare(label, taken);
      const reserved = await reservedAuthorSlugHistoryForSlugs(
        [candidate],
        now,
      );
      assertSlugAvailable(
        candidate,
        (await authorSlugTakenByOtherUser(candidate, author.id))
          ? new Set([candidate])
          : new Set(),
        reserved,
        now,
      );
      authorSlugUpdate = candidate;
      if (author.displayName == null) {
        authorDisplayNameUpdate = publicFirstName(author.name);
      }
    }

    const db = useDb();
    const visibilityBatch: BatchItem<"sqlite">[] = [];
    const userPatch: Partial<schema.UserRow> = {};
    if (authorSlugUpdate != null) {
      userPatch.slug = authorSlugUpdate;
    }
    if (authorDisplayNameUpdate !== undefined) {
      userPatch.displayName = authorDisplayNameUpdate;
    }
    if (data.target === "public" && author.profilePublishedAt == null) {
      userPatch.profilePublishedAt = now;
    }
    if (authorSlugUpdate != null) {
      visibilityBatch.push(
        db
          .delete(schema.authorSlugHistory)
          .where(eq(schema.authorSlugHistory.fromSlug, authorSlugUpdate)),
      );
    }
    if (Object.keys(userPatch).length > 0) {
      visibilityBatch.push(
        db
          .update(schema.user)
          .set(userPatch)
          .where(eq(schema.user.id, author.id)),
      );
    }
    visibilityBatch.push(
      db
        .update(schema.programs)
        .set({
          visibility: data.target,
          shareToken: nextShareToken,
          slug: nextProgramSlug,
          revision,
          updatedAt: now,
        })
        .where(eq(schema.programs.id, program.id)),
    );
    await runSlugSafeBatch(visibilityBatch);

    const [row] = await db
      .select()
      .from(schema.programs)
      .where(eq(schema.programs.id, program.id))
      .limit(1);
    if (!row) {
      throw appError("PROGRAM_NOT_FOUND");
    }
    const sessions = await loadProgramSessionsDTO(row.id);
    return toProgramDTO(row, sessions);
  });

const RotateShareTokenInputSchema = z.object({
  programId: z.string().min(1),
});

export const rotateShareToken = createServerFn({ method: "POST" })
  .validator((d) => RotateShareTokenInputSchema.parse(d))
  .handler(async ({ data }) => {
    const me = await requireUser();
    const program = await loadAuthorProgram(data.programId, me.id);
    if (program.visibility !== "unlisted") {
      throw appError("INVALID_TRANSITION");
    }
    const now = new Date();
    const token = newShareToken();
    const revision = nextRevision(program.revision);
    await useDb()
      .update(schema.programs)
      .set({
        shareToken: token,
        revision,
        updatedAt: now,
      })
      .where(eq(schema.programs.id, program.id));
    return { shareToken: token };
  });

const CheckProgramSlugInputSchema = z.object({
  programId: z.string().min(1),
  candidate: z.string().min(1),
});

export const checkProgramSlugAvailable = createServerFn({ method: "GET" })
  .validator((d) => CheckProgramSlugInputSchema.parse(d))
  .handler(async ({ data }) => {
    const me = await requireUser();
    const program = await loadAuthorProgram(data.programId, me.id);
    if (!program.slug) {
      return { ok: false as const, reason: "Share the program first." };
    }
    const validated = validateSlug(data.candidate.trim().toLowerCase());
    if (!validated.ok) {
      return { ok: false as const, reason: validated.reason };
    }
    const candidate = data.candidate.trim().toLowerCase();
    if (program.slug === candidate) {
      return { ok: true as const };
    }
    const now = new Date();
    const taken = await takenProgramSlugsForAuthor(program.userId, now);
    const historyRows = await useDb()
      .select({
        fromSlug: schema.programSlugHistory.fromSlug,
        createdAt: schema.programSlugHistory.createdAt,
        programId: schema.programSlugHistory.programId,
      })
      .from(schema.programSlugHistory)
      .where(eq(schema.programSlugHistory.userId, program.userId));
    const reclaiming = historyRows.some(
      (row) => row.fromSlug === candidate && row.programId === program.id,
    );
    const historyForAssert = historyRows
      .filter((row) => isSlugHistoryReserved(row.createdAt, now))
      .filter((row) => !(reclaiming && row.fromSlug === candidate))
      .map((row) => ({ slug: row.fromSlug, createdAt: row.createdAt }));
    try {
      assertSlugAvailable(candidate, taken, historyForAssert, now);
    } catch (e) {
      if (e instanceof Error && e.message === "SLUG_TAKEN") {
        const takenSlugs = new Set(taken);
        const base = suggestSlug(candidate) || candidate;
        const suggestions = [
          suggestProgramSlug(base, [...takenSlugs]),
          suggestProgramSlug(`${base}-plan`, [...takenSlugs]),
        ].filter((s): s is string => s != null && s !== candidate);
        return {
          ok: false as const,
          reason: "That address is taken.",
          suggestions: [...new Set(suggestions)].slice(0, 2),
        };
      }
      throw e;
    }
    return { ok: true as const };
  });

const RenameProgramSlugInputSchema = z.object({
  programId: z.string().min(1),
  expectedRevision: z.number().int().min(0),
  slug: z.string().min(3).max(40),
});

export const renameProgramSlug = createServerFn({ method: "POST" })
  .validator((d) => RenameProgramSlugInputSchema.parse(d))
  .handler(async ({ data }) => {
    const me = await requireUser();
    const program = await loadAuthorProgram(data.programId, me.id);
    revisionGuard(data.expectedRevision, program.revision);
    const validated = validateSlug(data.slug.trim().toLowerCase());
    if (!validated.ok) {
      throw appError("SLUG_TAKEN");
    }
    const now = new Date();
    const taken = await takenProgramSlugsForAuthor(program.userId, now);
    const db = useDb();
    const historyWithProgram = await db
      .select({
        fromSlug: schema.programSlugHistory.fromSlug,
        createdAt: schema.programSlugHistory.createdAt,
        programId: schema.programSlugHistory.programId,
      })
      .from(schema.programSlugHistory)
      .where(eq(schema.programSlugHistory.userId, program.userId));
    const reclaiming = historyWithProgram.some(
      (row) =>
        row.fromSlug === data.slug.trim().toLowerCase() &&
        row.programId === program.id,
    );
    const reservedHistory = historyWithProgram
      .filter((row) => isSlugHistoryReserved(row.createdAt, now))
      .map((row) => ({ slug: row.fromSlug, createdAt: row.createdAt }));
    const planned = planProgramSlugRename(
      program.slug,
      data.slug,
      taken,
      reservedHistory,
      reclaiming,
      now,
    );
    if (!planned.ok) {
      throw appError(planned.code);
    }
    if (!planned.rename) {
      const sessions = await loadProgramSessionsDTO(program.id);
      return toProgramDTO(program, sessions);
    }

    const batch: BatchItem<"sqlite">[] = [];
    if (planned.rename.reclaimingOwnHistorySlug) {
      batch.push(
        db
          .delete(schema.programSlugHistory)
          .where(
            and(
              eq(schema.programSlugHistory.userId, program.userId),
              eq(schema.programSlugHistory.fromSlug, planned.rename.toSlug),
            ),
          ),
      );
    }
    batch.push(
      db.insert(schema.programSlugHistory).values({
        id: crypto.randomUUID(),
        userId: program.userId,
        programId: program.id,
        fromSlug: planned.rename.fromSlug,
        createdAt: now,
      }),
    );
    const programHistory = historyWithProgram.filter(
      (row) => row.programId === program.id,
    );
    const keep = programSlugHistoryRowsToKeep([
      ...programHistory.map((row) => ({
        fromSlug: row.fromSlug,
        createdAt: row.createdAt,
      })),
      { fromSlug: planned.rename.fromSlug, createdAt: now },
    ]);
    for (const row of programHistory) {
      if (!keep.has(row.fromSlug) && row.fromSlug !== planned.rename.toSlug) {
        batch.push(
          db
            .delete(schema.programSlugHistory)
            .where(
              and(
                eq(schema.programSlugHistory.userId, program.userId),
                eq(schema.programSlugHistory.fromSlug, row.fromSlug),
              ),
            ),
        );
      }
    }
    const revision = nextRevision(program.revision);
    batch.push(
      db
        .update(schema.programs)
        .set({
          slug: planned.rename.toSlug,
          revision,
          updatedAt: now,
        })
        .where(
          and(
            eq(schema.programs.id, program.id),
            eq(schema.programs.revision, data.expectedRevision),
          ),
        ),
    );
    await runSlugSafeBatch(batch);

    const [row] = await db
      .select()
      .from(schema.programs)
      .where(eq(schema.programs.id, program.id))
      .limit(1);
    if (!row || row.revision === data.expectedRevision) {
      throw appError("STALE_REVISION");
    }
    const sessions = await loadProgramSessionsDTO(program.id);
    return toProgramDTO(row, sessions);
  });

const GetPublicProgramByTokenInputSchema = z.object({
  token: z.string().min(1),
});

export const getPublicProgramByToken = createServerFn({ method: "GET" })
  .validator((d) => GetPublicProgramByTokenInputSchema.parse(d))
  .handler(async ({ data }) => {
    const [program] = await useDb()
      .select()
      .from(schema.programs)
      .where(eq(schema.programs.shareToken, data.token))
      .limit(1);
    if (!program) {
      throw appError("PROGRAM_NOT_FOUND");
    }
    assertViewerVisibility(program, "token");
    return buildPublicProgramDTO(program);
  });

const GetPublicProgramByIdInputSchema = z.object({
  programId: z.string().min(1),
});

export const getPublicProgramById = createServerFn({ method: "GET" })
  .validator((d) => GetPublicProgramByIdInputSchema.parse(d))
  .handler(async ({ data }) => {
    const [program] = await useDb()
      .select()
      .from(schema.programs)
      .where(eq(schema.programs.id, data.programId))
      .limit(1);
    if (!program) {
      throw appError("PROGRAM_NOT_FOUND");
    }
    assertViewerVisibility(program, "public-only");
    return buildPublicProgramDTO(program);
  });

const GetPublicProgramBySlugInputSchema = z.object({
  authorSlug: z.string().min(1),
  programSlug: z.string().min(1),
});

export const getPublicProgramBySlug = createServerFn({ method: "GET" })
  .validator((d) => GetPublicProgramBySlugInputSchema.parse(d))
  .handler(async ({ data }) => {
    const [author] = await useDb()
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.slug, data.authorSlug))
      .limit(1);
    if (!author) {
      throw appError("PROGRAM_NOT_FOUND");
    }
    const [program] = await useDb()
      .select()
      .from(schema.programs)
      .where(
        and(
          eq(schema.programs.userId, author.id),
          eq(schema.programs.slug, data.programSlug),
        ),
      )
      .limit(1);
    if (!program) {
      throw appError("PROGRAM_NOT_FOUND");
    }
    assertViewerVisibility(program, "public-only");
    return buildPublicProgramDTO(program);
  });

async function loadUserByAuthorSlug(slug: string) {
  const [row] = await useDb()
    .select()
    .from(schema.user)
    .where(eq(schema.user.slug, slug))
    .limit(1);
  return row ?? null;
}

async function loadAuthorSlugHistoryRow(fromSlug: string) {
  const [row] = await useDb()
    .select()
    .from(schema.authorSlugHistory)
    .where(eq(schema.authorSlugHistory.fromSlug, fromSlug))
    .limit(1);
  return row ?? null;
}

async function lastAuthorSlugRenameAt(userId: string): Promise<Date | null> {
  const [row] = await useDb()
    .select({ createdAt: schema.authorSlugHistory.createdAt })
    .from(schema.authorSlugHistory)
    .where(eq(schema.authorSlugHistory.userId, userId))
    .orderBy(desc(schema.authorSlugHistory.createdAt))
    .limit(1);
  return row?.createdAt ?? null;
}

async function resolveAuthorSlugContext(slugFromPath: string, now: Date) {
  const current = await loadUserByAuthorSlug(slugFromPath);
  const history = await loadAuthorSlugHistoryRow(slugFromPath);
  let ownerCurrentSlug: string | null = current?.slug ?? null;
  if (!current && history) {
    const owner = await loadAuthorRow(history.userId);
    ownerCurrentSlug = owner.slug;
  }
  const lookup = resolveAuthorSlugLookup(
    slugFromPath,
    current ? { userId: current.id, slug: current.slug! } : null,
    history ? { userId: history.userId, createdAt: history.createdAt } : null,
    ownerCurrentSlug,
    now,
  );
  return { lookup, current, history };
}

function toProgramRedirectRow(row: schema.Program): ProgramRedirectRow {
  return {
    id: row.id,
    userId: row.userId,
    slug: row.slug,
    visibility: row.visibility,
    hiddenAt: row.hiddenAt,
    deletedAt: row.deletedAt,
  };
}

const GetPublicAuthorProfileInputSchema = z.object({
  authorSlug: z.string().min(1),
});

export const getPublicAuthorProfile = createServerFn({ method: "GET" })
  .validator((d) => GetPublicAuthorProfileInputSchema.parse(d))
  .handler(async ({ data }) => {
    const now = new Date();
    const viewer = await loadSessionUser();
    const { lookup } = await resolveAuthorSlugContext(data.authorSlug, now);
    if (!lookup) {
      throw appError("PROGRAM_NOT_FOUND");
    }
    const author = await loadAuthorRow(lookup.userId);
    if (author.profileHiddenAt != null) {
      return {
        displayName: resolvePublicAuthorDisplayName(author) ?? "Author",
        authorSlug: lookup.currentAuthorSlug,
        bio: null,
        programs: [],
        isOwner: viewer?.id === author.id,
        unavailable: true,
      } satisfies PublicAuthorProfileDTO;
    }
    if (author.profilePublishedAt == null) {
      throw appError("PROGRAM_NOT_FOUND");
    }
    const programRows = await useDb()
      .select()
      .from(schema.programs)
      .where(eq(schema.programs.userId, author.id));
    const publicRows = listPublicProgramsByAuthor(programRows);
    const programs: PublicAuthorProfileProgramDTO[] = publicRows.map((row) => ({
      id: row.id,
      title: row.title,
      description: row.description,
      slug: row.slug!,
      goal: row.goal,
      level: row.level,
      daysPerWeek: row.daysPerWeek,
      weeks: row.weeks,
      updatedAt: row.updatedAt.toISOString(),
    }));
    return {
      displayName: resolvePublicAuthorDisplayName(author) ?? "Author",
      authorSlug: lookup.currentAuthorSlug,
      bio: author.bio,
      programs,
      isOwner: viewer?.id === author.id,
      unavailable: false,
    } satisfies PublicAuthorProfileDTO;
  });

export const getAuthorProfileSetup = createServerFn({ method: "GET" }).handler(
  async () => {
    const me = await requireUser();
    const author = await loadAuthorRow(me.id);
    const lastRename = await lastAuthorSlugRenameAt(me.id);
    const allowedFrom = authorSlugRenameAllowedAt(lastRename);
    return {
      displayName: author.displayName ?? publicFirstName(author.name) ?? "",
      authorSlug: author.slug,
      bio: author.bio,
      slugRenameAllowedFrom: allowedFrom?.toISOString() ?? null,
    } satisfies AuthorProfileSetupDTO;
  },
);

const CheckAuthorSlugInputSchema = z.object({
  candidate: z.string().min(1),
});

export const checkAuthorSlugAvailable = createServerFn({ method: "GET" })
  .validator((d) => CheckAuthorSlugInputSchema.parse(d))
  .handler(async ({ data }) => {
    const me = await requireUser();
    const validated = validateSlug(data.candidate.trim().toLowerCase());
    if (!validated.ok) {
      return { ok: false as const, reason: validated.reason };
    }
    const candidate = data.candidate.trim().toLowerCase();
    const author = await loadAuthorRow(me.id);
    if (author.slug === candidate) {
      return { ok: true as const };
    }
    const now = new Date();
    const reservedHistory = await reservedAuthorSlugHistoryForSlugs(
      [candidate],
      now,
    );
    const reclaiming = reservedHistory.some(
      (row) => row.slug === candidate && row.userId === me.id,
    );
    const historyForAssert = reclaiming
      ? reservedHistory.filter(
          (row) => !(row.slug === candidate && row.userId === me.id),
        )
      : reservedHistory;
    try {
      const slugTaken = await authorSlugTakenByOtherUser(candidate, me.id);
      const taken = slugTaken ? new Set([candidate]) : new Set<string>();
      assertSlugAvailable(candidate, taken, historyForAssert, now);
    } catch (e) {
      if (e instanceof Error && e.message === "SLUG_TAKEN") {
        const takenSlugs = await takenAuthorSlugsWithPrefix(
          suggestSlug(candidate) || candidate,
          now,
        );
        const base = suggestSlug(candidate) || candidate;
        const suggestions = [
          suggestAuthorSlug(base, takenSlugs),
          suggestAuthorSlug(`${base}-strength`, takenSlugs),
        ].filter((s): s is string => s != null && s !== candidate);
        return {
          ok: false as const,
          reason: "That address is taken.",
          suggestions: [...new Set(suggestions)].slice(0, 2),
        };
      }
      throw e;
    }
    return { ok: true as const };
  });

const SaveAuthorProfileInputSchema = z.object({
  displayName: z.string().min(1).max(80),
  authorSlug: z.string().min(3).max(40),
  bio: z.string().max(280).nullable().optional(),
});

export const saveAuthorProfile = createServerFn({ method: "POST" })
  .validator((d) => SaveAuthorProfileInputSchema.parse(d))
  .handler(async ({ data }) => {
    const me = await requireUser();
    const author = await loadAuthorRow(me.id);
    const validated = validateSlug(data.authorSlug.trim().toLowerCase());
    if (!validated.ok) {
      throw appError("SLUG_TAKEN");
    }
    const now = new Date();
    const nextSlug = data.authorSlug.trim().toLowerCase();
    const slugTaken = await authorSlugTakenByOtherUser(nextSlug, me.id);
    const takenCurrent = slugTaken ? [nextSlug] : [];
    const historyWithUser = await useDb()
      .select({
        slug: schema.authorSlugHistory.fromSlug,
        createdAt: schema.authorSlugHistory.createdAt,
        userId: schema.authorSlugHistory.userId,
      })
      .from(schema.authorSlugHistory)
      .where(eq(schema.authorSlugHistory.userId, me.id));
    const reservedHistory = await reservedAuthorSlugHistoryForSlugs(
      [nextSlug],
      now,
    );
    const planned = planAuthorProfileSave(
      {
        userId: me.id,
        displayName: author.displayName,
        authorSlug: author.slug,
        bio: author.bio,
      },
      {
        displayName: data.displayName,
        authorSlug: data.authorSlug.trim().toLowerCase(),
        bio: data.bio ?? null,
      },
      takenCurrent,
      reservedHistory,
      await lastAuthorSlugRenameAt(me.id),
      now,
    );
    if (!planned.ok) {
      throw appError(planned.code);
    }

    const db = useDb();
    const batch: BatchItem<"sqlite">[] = [];
    const userPatch: Partial<schema.UserRow> = {
      displayName: planned.next.displayName,
      bio: planned.next.bio,
      slug: planned.next.authorSlug,
    };
    batch.push(
      db.update(schema.user).set(userPatch).where(eq(schema.user.id, me.id)),
    );

    if (planned.next.authorSlug !== author.slug) {
      batch.push(
        db
          .delete(schema.authorSlugHistory)
          .where(
            eq(schema.authorSlugHistory.fromSlug, planned.next.authorSlug),
          ),
      );
    }

    if (planned.rename) {
      batch.push(
        db.insert(schema.authorSlugHistory).values({
          fromSlug: planned.rename.fromSlug,
          userId: me.id,
          createdAt: now,
        }),
      );
      const keep = authorSlugHistoryRowsToKeep([
        ...historyWithUser.map((row) => ({
          fromSlug: row.slug,
          createdAt: row.createdAt,
        })),
        { fromSlug: planned.rename.fromSlug, createdAt: now },
      ]);
      for (const row of historyWithUser) {
        if (!keep.has(row.slug) && row.slug !== planned.rename.toSlug) {
          batch.push(
            db
              .delete(schema.authorSlugHistory)
              .where(eq(schema.authorSlugHistory.fromSlug, row.slug)),
          );
        }
      }
    }

    await runSlugSafeBatch(batch);

    return {
      authorSlug: planned.next.authorSlug,
      profilePublished: author.profilePublishedAt != null,
    };
  });

const ResolvePublicProgramRedirectInputSchema = z.object({
  authorSlug: z.string().min(1),
  programRef: z.string().min(1),
  shareToken: z.string().optional(),
});

export const resolvePublicProgramRedirect = createServerFn({ method: "GET" })
  .validator((d) => ResolvePublicProgramRedirectInputSchema.parse(d))
  .handler(async ({ data }) => {
    const now = new Date();
    const programIdRef = isProgramIdRef(data.programRef);
    const { lookup } = await resolveAuthorSlugContext(data.authorSlug, now);
    if (!lookup) {
      return { kind: "not_found" as const };
    }

    let programBySlug: ProgramRedirectRow | null = null;
    let programFromHistory: ProgramRedirectRow | null = null;

    if (!programIdRef) {
      const [bySlug] = await useDb()
        .select()
        .from(schema.programs)
        .where(
          and(
            eq(schema.programs.userId, lookup.userId),
            eq(schema.programs.slug, data.programRef),
          ),
        )
        .limit(1);
      if (bySlug) {
        programBySlug = toProgramRedirectRow(bySlug);
      } else {
        const [hist] = await useDb()
          .select({ programId: schema.programSlugHistory.programId })
          .from(schema.programSlugHistory)
          .where(
            and(
              eq(schema.programSlugHistory.userId, lookup.userId),
              eq(schema.programSlugHistory.fromSlug, data.programRef),
            ),
          )
          .limit(1);
        if (hist) {
          const [program] = await useDb()
            .select()
            .from(schema.programs)
            .where(eq(schema.programs.id, hist.programId))
            .limit(1);
          if (program) {
            programFromHistory = toProgramRedirectRow(program);
          }
        }
      }
    }

    const resolution = resolveProgramRedirect(
      data.authorSlug,
      data.programRef,
      lookup,
      programBySlug,
      programFromHistory,
      data.shareToken,
      programIdRef,
    );
    if (resolution.kind === "redirect") {
      return {
        kind: "redirect" as const,
        path: resolution.path,
        search: resolution.search,
      };
    }
    return { kind: "not_found" as const };
  });

const ResolveAuthorProfileRouteInputSchema = z.object({
  authorSlug: z.string().min(1),
});

export const resolveAuthorProfileRoute = createServerFn({ method: "GET" })
  .validator((d) => ResolveAuthorProfileRouteInputSchema.parse(d))
  .handler(async ({ data }) => {
    const now = new Date();
    const { lookup } = await resolveAuthorSlugContext(data.authorSlug, now);
    if (!lookup) {
      return { kind: "not_found" as const };
    }
    const path = resolveAuthorProfileRedirect(data.authorSlug, lookup);
    if (path) {
      return { kind: "redirect" as const, path };
    }
    return { kind: "ok" as const };
  });

export const getMyAuthorSlug = createServerFn({ method: "GET" }).handler(
  async () => {
    const me = await requireUser();
    const [row] = await useDb()
      .select({ slug: schema.user.slug })
      .from(schema.user)
      .where(eq(schema.user.id, me.id))
      .limit(1);
    return { authorSlug: row?.slug ?? null };
  },
);

const ResolveProgramIdForPublicPathInputSchema = z.object({
  authorSlug: z.string().min(1).optional(),
  programRef: z.string().min(1),
  shareToken: z.string().optional(),
});

export const resolveProgramIdForPublicPath = createServerFn({ method: "GET" })
  .validator((d) => ResolveProgramIdForPublicPathInputSchema.parse(d))
  .handler(async ({ data }) => {
    if (data.shareToken) {
      const [program] = await useDb()
        .select({ id: schema.programs.id })
        .from(schema.programs)
        .where(eq(schema.programs.shareToken, data.shareToken))
        .limit(1);
      return program?.id ?? null;
    }
    const uuidRe =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidRe.test(data.programRef)) {
      return data.programRef;
    }
    if (!data.authorSlug) {
      return null;
    }
    const [author] = await useDb()
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.slug, data.authorSlug))
      .limit(1);
    if (!author) {
      return null;
    }
    const [program] = await useDb()
      .select({ id: schema.programs.id })
      .from(schema.programs)
      .where(
        and(
          eq(schema.programs.userId, author.id),
          eq(schema.programs.slug, data.programRef),
        ),
      )
      .limit(1);
    return program?.id ?? null;
  });

const GetPublicProgramRemovalInputSchema = z.object({
  programId: z.string().min(1),
});

export const getPublicProgramRemoval = createServerFn({ method: "GET" })
  .validator((d) => GetPublicProgramRemovalInputSchema.parse(d))
  .handler(async ({ data }) => {
    const [program] = await useDb()
      .select()
      .from(schema.programs)
      .where(eq(schema.programs.id, data.programId))
      .limit(1);
    if (!program) {
      throw appError("PROGRAM_NOT_FOUND");
    }
    const variant = publicProgramRemovalVariant(program);
    if (variant == null) {
      throw appError("PROGRAM_NOT_FOUND");
    }
    return buildRemovalDTO(program, variant);
  });

const ForkProgramInputSchema = z.object({
  programId: z.string().min(1),
  shareToken: z.string().optional(),
});

export const forkProgram = createServerFn({ method: "POST" })
  .validator((d) => ForkProgramInputSchema.parse(d))
  .handler(async ({ data }) => {
    const me = await requireUser();
    const [program] = await useDb()
      .select()
      .from(schema.programs)
      .where(eq(schema.programs.id, data.programId))
      .limit(1);
    if (!program) {
      throw appError("PROGRAM_NOT_FOUND");
    }
    let grantedByToken = false;
    if (data.shareToken) {
      if (program.shareToken !== data.shareToken) {
        throw appError("PROGRAM_NOT_FOUND");
      }
      grantedByToken = true;
    }
    assertForkAllowed(program, { grantedByToken });

    const author = await loadAuthorRow(program.userId);
    const forkSourceLabel = buildForkSourceLabel(
      resolvePublicAuthorDisplayName(author) ?? "Author",
      program.title,
    );

    const sessionRows = await useDb()
      .select()
      .from(schema.programSessions)
      .where(eq(schema.programSessions.programId, program.id))
      .orderBy(
        asc(schema.programSessions.weekNumber),
        asc(schema.programSessions.orderIndex),
      );
    const sessionIds = sessionRows.map((s) => s.id);
    const entryRows =
      sessionIds.length === 0
        ? []
        : await useDb()
            .select()
            .from(schema.programEntries)
            .where(inArray(schema.programEntries.sessionId, sessionIds))
            .orderBy(
              asc(schema.programEntries.sessionId),
              asc(schema.programEntries.orderIndex),
            );

    const entriesBySession = new Map<string, (typeof entryRows)[number][]>();
    for (const entry of entryRows) {
      const list = entriesBySession.get(entry.sessionId) ?? [];
      list.push(entry);
      entriesBySession.set(entry.sessionId, list);
    }

    const forkSources = sessionRows.map((s) => ({
      id: s.id,
      weekNumber: s.weekNumber,
      orderIndex: s.orderIndex,
      title: s.title,
      notes: s.notes,
      entries: (entriesBySession.get(s.id) ?? []).map((e) => ({
        orderIndex: e.orderIndex,
        exerciseId: e.exerciseId,
        groupTag: e.groupTag,
        sets: e.sets,
        repsType: e.repsType,
        repsValue: e.repsValue,
        loadType: e.loadType,
        loadValue: e.loadValue,
        intensityType: e.intensityType,
        intensityValue: e.intensityValue,
        restSeconds: e.restSeconds,
        cues: e.cues,
        refUrl: e.refUrl,
      })),
    }));

    const newProgramId = crypto.randomUUID();
    const now = new Date();
    const sessionPlans = planForkSessionCopies(forkSources, () =>
      crypto.randomUUID(),
    );
    const db = useDb();
    const batch: BatchItem<"sqlite">[] = [
      db.insert(schema.programs).values({
        id: newProgramId,
        userId: me.id,
        title: program.title,
        description: program.description,
        visibility: "draft",
        weeks: program.weeks,
        goal: program.goal,
        level: program.level,
        daysPerWeek: program.daysPerWeek,
        equipmentTags: program.equipmentTags,
        slug: null,
        shareToken: null,
        forkedFromProgramId: program.id,
        forkSourceLabel,
        forkable: true,
        hiddenAt: null,
        revision: 0,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      }),
    ];
    for (const sessionPlan of sessionPlans) {
      batch.push(
        db.insert(schema.programSessions).values({
          id: sessionPlan.newSessionId,
          programId: newProgramId,
          weekNumber: sessionPlan.weekNumber,
          orderIndex: sessionPlan.orderIndex,
          title: sessionPlan.title,
          notes: sessionPlan.notes,
        }),
      );
      for (const entry of sessionPlan.entries) {
        const payload = forkEntryPayloadFromPlan(entry);
        batch.push(
          db.insert(schema.programEntries).values({
            id: entry.newEntryId,
            sessionId: sessionPlan.newSessionId,
            orderIndex: entry.orderIndex,
            ...payload,
          }),
        );
      }
    }
    await db.batch(batch as [BatchItem<"sqlite">, ...BatchItem<"sqlite">[]]);
    return { programId: newProgramId };
  });

const ReportProgramInputSchema = z.object({
  programId: z.string().min(1),
  reason: reportProgramReasonSchema,
});

async function insertProgramReport(args: {
  programId: string | null;
  reportedUserId: string | null;
  reason: string | undefined;
}): Promise<void> {
  const reporter = await loadSessionUser();
  const headers = getRequestHeaders();
  const ip = clientIpFromHeaders(headers);
  let reporterIpHash: string | null = null;
  if (reporter == null && ip) {
    reporterIpHash = await hashReporterIp(ip);
    const count = await countAnonymousReportsToday(reporterIpHash);
    assertAnonymousReportRateAllowed(count);
  }
  const now = new Date();
  await useDb()
    .insert(schema.programReports)
    .values({
      id: crypto.randomUUID(),
      programId: args.programId,
      reportedUserId: args.reportedUserId,
      reporterUserId: reporter?.id ?? null,
      reporterIpHash,
      reason: args.reason ?? "",
      createdAt: now,
      handledAt: null,
    });
}

export const reportProgram = createServerFn({ method: "POST" })
  .validator((d) => ReportProgramInputSchema.parse(d))
  .handler(async ({ data }) => {
    const [program] = await useDb()
      .select({ id: schema.programs.id })
      .from(schema.programs)
      .where(eq(schema.programs.id, data.programId))
      .limit(1);
    if (!program) {
      throw appError("PROGRAM_NOT_FOUND");
    }
    await insertProgramReport({
      programId: data.programId,
      reportedUserId: null,
      reason: data.reason,
    });
    return { ok: true as const };
  });

const ReportProfileInputSchema = z.object({
  authorSlug: z.string().min(1),
  reason: reportProgramReasonSchema,
});

export const reportProfile = createServerFn({ method: "POST" })
  .validator((d) => ReportProfileInputSchema.parse(d))
  .handler(async ({ data }) => {
    const slug = data.authorSlug.trim().toLowerCase();
    const [author] = await useDb()
      .select({ id: schema.user.id })
      .from(schema.user)
      .where(eq(schema.user.slug, slug))
      .limit(1);
    if (!author) {
      throw appError("PROGRAM_NOT_FOUND");
    }
    await insertProgramReport({
      programId: null,
      reportedUserId: author.id,
      reason: data.reason,
    });
    return { ok: true as const };
  });

const DeleteProgramInputSchema = z.object({
  programId: z.string().min(1),
});

export const deleteProgram = createServerFn({ method: "POST" })
  .validator((d) => DeleteProgramInputSchema.parse(d))
  .handler(async ({ data }) => {
    const me = await requireUser();
    const program = await loadAuthorProgram(data.programId, me.id);
    const now = new Date();
    await useDb()
      .update(schema.programs)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(schema.programs.id, program.id));
    return { ok: true as const };
  });
