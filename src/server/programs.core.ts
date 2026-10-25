import { z } from "zod";
import { appError } from "#/lib/app-error";
import { EQUIPMENT, MUSCLES } from "#/lib/programs/taxonomy";
import type { ProgramSession } from "#/lib/programs/program-shape";

export function assertAuthor(program: { userId: string }, meId: string): void {
  if (program.userId !== meId) {
    throw appError("NOT_AUTHOR");
  }
}

export function revisionGuard(expected: number, current: number): void {
  if (expected !== current) {
    throw appError("STALE_REVISION");
  }
}

export function nextRevision(current: number): number {
  return current + 1;
}

/** Deleted programs are invisible; hidden programs only to non-owners. */
export function assertProgramUsable(
  program: {
    hiddenAt: Date | null;
    deletedAt: Date | null;
  },
  options?: { isOwner?: boolean },
): void {
  if (program.deletedAt != null) {
    throw appError("PROGRAM_NOT_FOUND");
  }
  if (program.hiddenAt != null && !options?.isOwner) {
    throw appError("PROGRAM_NOT_FOUND");
  }
}

export function normalizeExerciseName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export type ExerciseReferenceContext = {
  catalogIds: Set<string>;
  myCustomIds: Set<string>;
  inheritedForeignCustomIds: Set<string>;
};

export function assertExerciseReferenceAllowed(
  entry: { exerciseId: string },
  ctx: ExerciseReferenceContext,
): void {
  const { exerciseId } = entry;
  if (ctx.catalogIds.has(exerciseId)) {
    return;
  }
  if (ctx.myCustomIds.has(exerciseId)) {
    return;
  }
  if (ctx.inheritedForeignCustomIds.has(exerciseId)) {
    return;
  }
  throw appError("INVALID_ENTRY");
}

/** Validates every entry in a session payload (whole-session replace). */
export function validateSessionEntries(
  entries: ReadonlyArray<{ exerciseId: string }>,
  ctx: ExerciseReferenceContext,
): void {
  for (const entry of entries) {
    assertExerciseReferenceAllowed(entry, ctx);
  }
}

export const customExerciseInputSchema = z.object({
  name: z.string().min(1).max(80),
  aliases: z.array(z.string().min(1).max(80)).max(8).default([]),
  musclePrimary: z.enum(MUSCLES),
  muscleSecondary: z.array(z.enum(MUSCLES)).max(6).default([]),
  equipment: z.enum(EQUIPMENT),
  formNote: z.string().max(200).nullable().optional(),
});

export type CustomExerciseInput = z.infer<typeof customExerciseInputSchema>;

export function assertSessionWeekInProgram(
  session: Pick<ProgramSession, "weekNumber" | "title">,
  programWeeks: number,
): void {
  if (session.weekNumber > programWeeks) {
    throw appError("INVALID_ENTRY");
  }
}

export type SessionUpsertPayload = ProgramSession & {
  id?: string;
};
