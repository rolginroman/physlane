import type { AuthorProgramSuggestionsDTO } from "#/server/programs.fns";

/** notFound() carries unknown data; accept only the suggestions shape. */
export function readNotFoundSuggestions(
  data: unknown,
): AuthorProgramSuggestionsDTO | null {
  if (typeof data !== "object" || data === null) return null;
  const { authorSlug, displayName, programs } = data as Record<string, unknown>;
  if (typeof authorSlug !== "string" || typeof displayName !== "string") {
    return null;
  }
  if (!Array.isArray(programs) || programs.length === 0) return null;
  return data as AuthorProgramSuggestionsDTO;
}
