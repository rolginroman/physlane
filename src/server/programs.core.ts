import { z } from "zod";
import { appError, type AppErrorCode } from "#/lib/app-error";
import { suggestSlug } from "#/lib/programs/slug";
import {
  EQUIPMENT,
  MUSCLES,
  type ProgramGoal,
  type ProgramLevel,
} from "#/lib/programs/taxonomy";
import type { ProgramSession } from "#/lib/programs/program-shape";

export type ProgramVisibility = "draft" | "unlisted" | "public";

export type TransitionEffects = {
  mintShareToken: boolean;
  clearShareToken: boolean;
  mintProgramSlug: boolean;
  mintAuthorSlug: boolean;
  profileBecomesPublic: boolean;
};

/** Reserved author/program slugs in history remain claimed for this window. */
export const SLUG_QUARANTINE_MS = 365 * 24 * 60 * 60 * 1000;

export function isSlugHistoryReserved(
  historyCreatedAt: Date,
  now: Date = new Date(),
): boolean {
  return now.getTime() - historyCreatedAt.getTime() < SLUG_QUARANTINE_MS;
}

export function assertSlugAvailable(
  candidate: string,
  takenCurrent: ReadonlySet<string> | readonly string[],
  takenHistory: ReadonlyArray<{ slug: string; createdAt: Date }>,
  now: Date = new Date(),
): void {
  const current =
    takenCurrent instanceof Set ? takenCurrent : new Set(takenCurrent);
  if (current.has(candidate)) {
    throw appError("SLUG_TAKEN");
  }
  for (const row of takenHistory) {
    if (row.slug === candidate && isSlugHistoryReserved(row.createdAt, now)) {
      throw appError("SLUG_TAKEN");
    }
  }
}

const MAX_PROGRAM_SLUG_LEN = 40;

/** Suggest a per-author program slug; suffix `-2`, `-3`, … on collision. */
export function suggestProgramSlug(title: string, taken: string[]): string {
  const takenSet = new Set(taken);
  const base = suggestSlug(title);
  if (!base) {
    return "";
  }

  const tryCandidate = (suffix: string): string | null => {
    const suffixPart = suffix ? `-${suffix}` : "";
    const maxBaseLen = MAX_PROGRAM_SLUG_LEN - suffixPart.length;
    if (maxBaseLen < 3) {
      return null;
    }
    let trimmedBase = base;
    if (trimmedBase.length > maxBaseLen) {
      trimmedBase = trimmedBase.slice(0, maxBaseLen).replace(/-$/, "");
    }
    if (trimmedBase.length < 3) {
      return null;
    }
    const candidate = `${trimmedBase}${suffixPart}`;
    return candidate.length <= MAX_PROGRAM_SLUG_LEN ? candidate : null;
  };

  if (!takenSet.has(base)) {
    const first = tryCandidate("");
    if (first && !takenSet.has(first)) {
      return first;
    }
  }

  for (let n = 2; n < 10_000; n++) {
    const candidate = tryCandidate(String(n));
    if (!candidate) {
      break;
    }
    if (!takenSet.has(candidate)) {
      return candidate;
    }
  }
  return "";
}

const MAX_AUTHOR_SLUG_SUFFIX = 99;

/** Suggest a global author slug; suffix `-2`, `-3`, … on collision (up to `-99`). */
export function suggestAuthorSlug(
  base: string,
  taken: readonly string[],
): string | null {
  if (!base) {
    return null;
  }
  const takenSet = new Set(taken);

  const tryCandidate = (suffix: string): string | null => {
    const suffixPart = suffix ? `-${suffix}` : "";
    const maxBaseLen = MAX_PROGRAM_SLUG_LEN - suffixPart.length;
    if (maxBaseLen < 3) {
      return null;
    }
    let trimmedBase = base;
    if (trimmedBase.length > maxBaseLen) {
      trimmedBase = trimmedBase.slice(0, maxBaseLen).replace(/-$/, "");
    }
    if (trimmedBase.length < 3) {
      return null;
    }
    const candidate = `${trimmedBase}${suffixPart}`;
    return candidate.length <= MAX_PROGRAM_SLUG_LEN ? candidate : null;
  };

  if (!takenSet.has(base)) {
    const first = tryCandidate("");
    if (first && !takenSet.has(first)) {
      return first;
    }
  }

  for (let n = 2; n <= MAX_AUTHOR_SLUG_SUFFIX; n++) {
    const candidate = tryCandidate(String(n));
    if (!candidate) {
      break;
    }
    if (!takenSet.has(candidate)) {
      return candidate;
    }
  }
  return null;
}

export function planVisibilityTransition(
  current: ProgramVisibility,
  target: ProgramVisibility,
  program: { hiddenAt: Date | null; slug: string | null },
  author: { slug: string | null },
):
  | { ok: true; effects: TransitionEffects }
  | { ok: false; code: Extract<AppErrorCode, "INVALID_TRANSITION"> } {
  if (program.hiddenAt != null) {
    return { ok: false, code: "INVALID_TRANSITION" };
  }
  if (current === target) {
    return { ok: false, code: "INVALID_TRANSITION" };
  }

  const effects: TransitionEffects = {
    mintShareToken: false,
    clearShareToken: false,
    mintProgramSlug: program.slug == null,
    mintAuthorSlug: author.slug == null,
    profileBecomesPublic: target === "public",
  };

  if (target === "draft") {
    effects.clearShareToken = true;
    return { ok: true, effects };
  }

  if (target === "unlisted") {
    effects.mintShareToken = true;
    return { ok: true, effects };
  }

  return { ok: true, effects };
}

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

/** Author handle rename rate limit (starts after profile setup / renames). */
export const AUTHOR_SLUG_RENAME_COOLDOWN_MS = 90 * 24 * 60 * 60 * 1000;

export const MAX_AUTHOR_SLUG_HISTORY_ROWS = 3;

export type AuthorSlugLookup = {
  userId: string;
  currentAuthorSlug: string;
  viaHistory: boolean;
};

/** Map path slug to the owning user and their current handle (current row or quarantined history). */
export function resolveAuthorSlugLookup(
  slugFromPath: string,
  currentOwner: { userId: string; slug: string } | null,
  historyRow: { userId: string; createdAt: Date } | null,
  ownerCurrentSlug: string | null,
  now: Date = new Date(),
): AuthorSlugLookup | null {
  if (currentOwner && currentOwner.slug === slugFromPath) {
    return {
      userId: currentOwner.userId,
      currentAuthorSlug: currentOwner.slug,
      viaHistory: false,
    };
  }
  if (
    historyRow &&
    isSlugHistoryReserved(historyRow.createdAt, now) &&
    ownerCurrentSlug
  ) {
    return {
      userId: historyRow.userId,
      currentAuthorSlug: ownerCurrentSlug,
      viaHistory: true,
    };
  }
  return null;
}

export type PublicProgramListRow = {
  id: string;
  title: string;
  description: string | null;
  slug: string | null;
  goal: ProgramGoal;
  level: ProgramLevel;
  daysPerWeek: number;
  weeks: number;
  updatedAt: Date;
  visibility: ProgramVisibility;
  hiddenAt: Date | null;
  deletedAt: Date | null;
};

export function listPublicProgramsByAuthor<T extends PublicProgramListRow>(
  programs: readonly T[],
): T[] {
  return programs
    .filter(
      (p) =>
        p.visibility === "public" &&
        p.deletedAt == null &&
        p.hiddenAt == null &&
        p.slug != null,
    )
    .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
}

export type AuthorProfileInput = {
  displayName: string;
  authorSlug: string;
  bio: string | null;
};

export type AuthorProfileState = {
  userId: string;
  displayName: string | null;
  authorSlug: string | null;
  bio: string | null;
};

export type AuthorProfileSavePlan =
  | { ok: true; next: AuthorProfileInput; rename: AuthorSlugRenamePlan | null }
  | {
      ok: false;
      code: Extract<AppErrorCode, "SLUG_TAKEN" | "INVALID_TRANSITION">;
    };

export type AuthorSlugRenamePlan = {
  fromSlug: string;
  toSlug: string;
  reclaimingOwnHistorySlug: boolean;
};

export function authorSlugRenameAllowedAt(
  lastRenameAt: Date | null,
): Date | null {
  if (!lastRenameAt) {
    return null;
  }
  return new Date(lastRenameAt.getTime() + AUTHOR_SLUG_RENAME_COOLDOWN_MS);
}

export function planAuthorProfileSave(
  state: AuthorProfileState,
  input: AuthorProfileInput,
  takenCurrent: ReadonlySet<string> | readonly string[],
  takenHistory: ReadonlyArray<{
    slug: string;
    createdAt: Date;
    userId: string;
  }>,
  lastAuthorRenameAt: Date | null,
  now: Date = new Date(),
): AuthorProfileSavePlan {
  const trimmedName = input.displayName.trim();
  if (!trimmedName) {
    return { ok: false, code: "INVALID_TRANSITION" };
  }
  const nextSlug = input.authorSlug.trim().toLowerCase();
  const bio =
    input.bio == null || input.bio.trim() === "" ? null : input.bio.trim();

  const current = state.authorSlug;
  let rename: AuthorSlugRenamePlan | null = null;
  if (current !== nextSlug) {
    const allowedFrom = authorSlugRenameAllowedAt(lastAuthorRenameAt);
    if (current != null && allowedFrom != null && now < allowedFrom) {
      return { ok: false, code: "INVALID_TRANSITION" };
    }
    const reclaiming = takenHistory.some(
      (row) => row.slug === nextSlug && row.userId === state.userId,
    );
    const currentTaken = new Set(
      takenCurrent instanceof Set ? takenCurrent : takenCurrent,
    );
    if (current) {
      currentTaken.delete(current);
    }
    const historyForAssert = reclaiming
      ? takenHistory.filter(
          (row) => !(row.slug === nextSlug && row.userId === state.userId),
        )
      : takenHistory;
    try {
      assertSlugAvailable(nextSlug, currentTaken, historyForAssert, now);
    } catch (e) {
      if (e instanceof Error && e.message === "SLUG_TAKEN") {
        return { ok: false, code: "SLUG_TAKEN" };
      }
      throw e;
    }
    if (current) {
      rename = {
        fromSlug: current,
        toSlug: nextSlug,
        reclaimingOwnHistorySlug: reclaiming,
      };
    }
  }

  return {
    ok: true,
    next: { displayName: trimmedName, authorSlug: nextSlug, bio },
    rename,
  };
}

/** Keep the newest history rows per author; drop older redirect sources. */
export function authorSlugHistoryRowsToKeep(
  rows: ReadonlyArray<{ fromSlug: string; createdAt: Date }>,
  limit: number = MAX_AUTHOR_SLUG_HISTORY_ROWS,
): Set<string> {
  const sorted = [...rows].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
  return new Set(sorted.slice(0, limit).map((r) => r.fromSlug));
}

export type ProgramRedirectRow = {
  id: string;
  userId: string;
  slug: string | null;
  visibility: ProgramVisibility;
  hiddenAt: Date | null;
  deletedAt: Date | null;
};

export function isPublicProgramRedirectTarget(
  program: ProgramRedirectRow,
): boolean {
  return (
    program.visibility === "public" &&
    program.deletedAt == null &&
    program.hiddenAt == null &&
    program.slug != null
  );
}

export type ProgramRedirectResolution =
  | { kind: "none" }
  | { kind: "not_found" }
  | { kind: "redirect"; path: string; search: Record<string, string> };

/** Flatten stale author/program segments to the current id permalink (token query preserved). */
export function resolveProgramRedirect(
  authorSlugFromPath: string,
  programRef: string,
  author: AuthorSlugLookup | null,
  programBySlug: ProgramRedirectRow | null,
  programFromHistory: ProgramRedirectRow | null,
  shareToken: string | null | undefined,
  isProgramIdRef: boolean,
): ProgramRedirectResolution {
  if (isProgramIdRef) {
    return { kind: "none" };
  }
  if (!author) {
    return { kind: "not_found" };
  }

  const program = programBySlug ?? programFromHistory;
  if (!program || program.userId !== author.userId) {
    return { kind: "not_found" };
  }
  if (!isPublicProgramRedirectTarget(program)) {
    return { kind: "not_found" };
  }

  const needsAuthorRedirect = authorSlugFromPath !== author.currentAuthorSlug;
  const needsProgramRedirect = programRef !== program.slug;
  if (!needsAuthorRedirect && !needsProgramRedirect) {
    return { kind: "not_found" };
  }

  const path = `/u/${author.currentAuthorSlug}/p/${program.id}`;
  const search: Record<string, string> = {};
  if (shareToken) {
    search.t = shareToken;
  }
  return { kind: "redirect", path, search };
}

export function resolveAuthorProfileRedirect(
  slugFromPath: string,
  author: AuthorSlugLookup | null,
): string | null {
  if (!author?.viaHistory) {
    return null;
  }
  if (slugFromPath === author.currentAuthorSlug) {
    return null;
  }
  return `/u/${author.currentAuthorSlug}`;
}
