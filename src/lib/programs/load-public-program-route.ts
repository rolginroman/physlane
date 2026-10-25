import { notFound } from "@tanstack/react-router";
import { throwProgramPathHistoryRedirect } from "#/lib/programs/history-redirect";
import {
  getPublicProgramById,
  getPublicProgramBySlug,
  resolvePublicProgramRedirect,
  type PublicProgramDTO,
} from "#/server/programs.fns";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isProgramIdRef(ref: string): boolean {
  return UUID_RE.test(ref);
}

export async function loadUserProgramRoute(args: {
  authorSlug: string;
  programRef: string;
  shareToken?: string;
}): Promise<PublicProgramDTO> {
  try {
    if (isProgramIdRef(args.programRef)) {
      return await getPublicProgramById({
        data: { programId: args.programRef },
      });
    }
    return await getPublicProgramBySlug({
      data: {
        authorSlug: args.authorSlug,
        programSlug: args.programRef,
      },
    });
  } catch (e) {
    if (!(e instanceof Error) || e.message !== "PROGRAM_NOT_FOUND") {
      throw e;
    }
    const resolved = await resolvePublicProgramRedirect({
      data: {
        authorSlug: args.authorSlug,
        programRef: args.programRef,
        shareToken: args.shareToken,
      },
    });
    if (resolved.kind === "redirect") {
      throwProgramPathHistoryRedirect(resolved.path, resolved.search);
    }
    throw notFound();
  }
}
