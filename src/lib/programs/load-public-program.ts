import { notFound } from "@tanstack/react-router";
import type { PublicProgramRemovalDTO } from "#/server/programs.fns";
import {
  getAuthorProgramSuggestions,
  getPublicProgramRemoval,
} from "#/server/programs.fns";

/**
 * Every miss under /u/ looks the same; the only extra is the author's public
 * programs when the author part of the path resolves to a live profile.
 */
export async function throwProgramNotFound(
  authorSlug?: string,
): Promise<never> {
  let suggestions = null;
  if (authorSlug) {
    try {
      suggestions = await getAuthorProgramSuggestions({ data: { authorSlug } });
    } catch {
      // A failed lookup must not turn a 404 into a 500.
    }
  }
  throw notFound({ data: suggestions ?? undefined });
}

export async function loadPublicProgramOrNotFound<T>(
  fn: () => Promise<T>,
  authorSlug?: string,
): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof Error) {
      if (e.message === "PROGRAM_NOT_FOUND") {
        return throwProgramNotFound(authorSlug);
      }
      if (
        e.message === "PROGRAM_REMOVED" ||
        e.message === "PROGRAM_UNAVAILABLE"
      ) {
        throw e;
      }
    }
    throw e;
  }
}

export async function loadPublicProgramRemovalForProgram(
  programId: string,
  shareToken?: string,
): Promise<PublicProgramRemovalDTO> {
  return getPublicProgramRemoval({ data: { programId, shareToken } });
}
