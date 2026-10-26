import type { ShareVisibility } from "#/lib/programs/share-plan";
import {
  publicProgramCanonicalPath,
  shareLinkPath,
} from "#/lib/programs/program-urls";

export type LibraryAddress = {
  kind: "public" | "unlisted";
  /** Full path; Copy always writes the whole link. */
  path: string;
  /** Path with the share token cut short so a row stays one line. */
  display: string;
};

const TOKEN_PREFIX_LENGTH = 4;

/** Null when the row has no address: drafts, hidden programs, or no slug yet. */
export function libraryAddress(
  program: {
    visibility: ShareVisibility;
    slug: string | null;
    shareToken: string | null;
    hiddenAt: string | null;
  },
  authorSlug: string | null,
): LibraryAddress | null {
  if (program.hiddenAt != null || !authorSlug || !program.slug) return null;
  if (program.visibility === "public") {
    const path = publicProgramCanonicalPath(authorSlug, program.slug);
    return { kind: "public", path, display: path };
  }
  if (program.visibility === "unlisted" && program.shareToken) {
    const path = shareLinkPath(authorSlug, program.slug, program.shareToken);
    const short = shareLinkPath(
      authorSlug,
      program.slug,
      `${program.shareToken.slice(0, TOKEN_PREFIX_LENGTH)}…`,
    );
    return { kind: "unlisted", path, display: short };
  }
  return null;
}

/** Drafts have no links, so their delete copy omits the link sentence. */
export function deleteConfirmBody(visibility: ShareVisibility): string {
  const removed =
    "People who open its links see a page saying the author removed it.";
  const copies = "Copies other people made stay theirs.";
  const final = "You can't undo this.";
  switch (visibility) {
    case "draft":
      return `It leaves your programs. ${final}`;
    case "unlisted":
      return `It leaves your programs. ${removed} ${copies} ${final}`;
    case "public":
      return `It leaves your profile and your programs. ${removed} ${copies} ${final}`;
    default: {
      const _exhaustive: never = visibility;
      return _exhaustive;
    }
  }
}
