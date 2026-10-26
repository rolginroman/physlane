import { libraryAddress } from "#/lib/programs/library-rows";
import type { ShareVisibility } from "#/lib/programs/share-plan";

/** Where an owner viewing their program belongs after its visibility changed. */
export function ownerViewPath(
  program: {
    id: string;
    visibility: ShareVisibility;
    slug: string | null;
    shareToken: string | null;
    hiddenAt: string | null;
  },
  authorSlug: string | null,
): string {
  return libraryAddress(program, authorSlug)?.path ?? `/programs/${program.id}`;
}
