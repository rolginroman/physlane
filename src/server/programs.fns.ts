import { createServerFn } from "@tanstack/react-start";
import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm";
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
import { requireUser } from "./auth.fns";
import {
  assertAuthor,
  assertProgramUsable,
  assertSessionWeekInProgram,
  customExerciseInputSchema,
  nextRevision,
  normalizeExerciseName,
  revisionGuard,
  validateSessionEntries,
} from "./programs.core";

export type ProgramEntryDTO = ProgramEntry & { id: string; orderIndex: number };

export type ProgramSessionDTO = {
  id: string;
  weekNumber: number;
  orderIndex: number;
  title: string;
  notes: string | null;
  entries: ProgramEntryDTO[];
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
  createdAt: string;
  sessions?: ProgramSessionDTO[];
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
  | "createdAt"
>;

export type ExercisePickerRowDTO = {
  id: string;
  name: string;
  aliases: string[];
  musclePrimary: Muscle;
  muscleSecondary: Muscle[];
  equipment: Equipment;
  formNote: string | null;
  isCustom: boolean;
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
  const inherited = new Set<string>();
  for (const ex of exerciseRows) {
    if (ex.ownerUserId != null && ex.ownerUserId !== programAuthorId) {
      inherited.add(ex.id);
    }
  }
  return inherited;
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
    return toProgramDTO(program, sessions);
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
      .where(eq(schema.programs.id, program.id))
      .returning();
    if (!row) {
      throw appError("PROGRAM_NOT_FOUND");
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
      if (!existingSession) {
        throw appError("PROGRAM_NOT_FOUND");
      }
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
    const revision = nextRevision(program.revision);

    await db.transaction(async (tx) => {
      if (existingSession) {
        await tx
          .update(schema.programSessions)
          .set({
            weekNumber: parsedSession.weekNumber,
            orderIndex: parsedSession.orderIndex,
            title: parsedSession.title,
            notes: parsedSession.notes ?? null,
          })
          .where(eq(schema.programSessions.id, sessionId));
        await tx
          .delete(schema.programEntries)
          .where(eq(schema.programEntries.sessionId, sessionId));
      } else {
        await tx.insert(schema.programSessions).values({
          id: sessionId,
          programId: program.id,
          weekNumber: parsedSession.weekNumber,
          orderIndex: parsedSession.orderIndex,
          title: parsedSession.title,
          notes: parsedSession.notes ?? null,
        });
      }

      for (let i = 0; i < parsedSession.entries.length; i++) {
        const entry = parsedSession.entries[i];
        const validated = entrySchema.parse(entry);
        await tx.insert(schema.programEntries).values({
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
        });
      }

      await tx
        .update(schema.programs)
        .set({ revision, updatedAt: now })
        .where(eq(schema.programs.id, program.id));
    });

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
      throw appError("PROGRAM_NOT_FOUND");
    }

    const now = new Date();
    const revision = nextRevision(program.revision);

    await db.transaction(async (tx) => {
      await tx
        .delete(schema.programEntries)
        .where(eq(schema.programEntries.sessionId, data.sessionId));
      await tx
        .delete(schema.programSessions)
        .where(eq(schema.programSessions.id, data.sessionId));
      await tx
        .update(schema.programs)
        .set({ revision, updatedAt: now })
        .where(eq(schema.programs.id, program.id));
    });

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
    for (const row of candidates) {
      if (row.deletedAt != null) {
        continue;
      }
      if (normalizeExerciseName(row.name) === normalized) {
        throw appError("INVALID_ENTRY");
      }
    }

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

function exerciseSearchRank(
  row: {
    name: string;
    aliases: string[];
  },
  query: string,
): number | null {
  const q = query.trim().toLowerCase();
  if (!q) {
    return 2;
  }
  const name = row.name.toLowerCase();
  if (name.startsWith(q)) {
    return 0;
  }
  if (name.includes(q)) {
    return 1;
  }
  for (const alias of row.aliases) {
    if (alias.toLowerCase().includes(q)) {
      return 2;
    }
  }
  return null;
}

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

    const filtered = rows.filter((row) => {
      if (data.equipment && row.equipment !== data.equipment) {
        return false;
      }
      if (data.muscle) {
        const hitsPrimary = row.musclePrimary === data.muscle;
        const hitsSecondary = row.muscleSecondary.includes(data.muscle);
        if (!hitsPrimary && !hitsSecondary) {
          return false;
        }
      }
      const rank = exerciseSearchRank(row, data.query);
      return rank !== null;
    });

    const ranked = filtered
      .map((row) => ({
        row,
        rank: exerciseSearchRank(row, data.query) ?? 2,
      }))
      .sort((a, b) => {
        if (a.rank !== b.rank) {
          return a.rank - b.rank;
        }
        return a.row.name.localeCompare(b.row.name);
      })
      .slice(0, 50);

    return ranked.map(({ row }) => ({
      id: row.id,
      name: row.name,
      aliases: row.aliases,
      musclePrimary: row.musclePrimary,
      muscleSecondary: row.muscleSecondary,
      equipment: row.equipment,
      formNote: row.formNote,
      isCustom: row.ownerUserId != null,
    })) satisfies ExercisePickerRowDTO[];
  });
