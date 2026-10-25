import { notFound } from "@tanstack/react-router";
import {
  throwProgramPathHistoryRedirect,
  throwHistoryRedirect,
} from "#/lib/programs/history-redirect";
import {
  loadPublicProgramOrNotFound,
  loadPublicProgramRemovalForProgram,
} from "#/lib/programs/load-public-program";
import type { PublicProgramRouteData } from "#/lib/programs/public-program-route-data";
import {
  getPublicProgramById,
  getPublicProgramBySlug,
  getPublicProgramByToken,
  resolveProgramIdForPublicPath,
  resolvePublicProgramRedirect,
  type PublicProgramDTO,
} from "#/server/programs.fns";

import { isProgramIdRef } from "#/lib/programs/program-id-ref";

export { isProgramIdRef };

async function loadProgramOrRemoval(
  load: () => Promise<PublicProgramDTO>,
  resolveProgramId: () => Promise<string | null>,
  variant: "public" | "unlisted",
): Promise<PublicProgramRouteData> {
  try {
    const program = await loadPublicProgramOrNotFound(load);
    return { kind: "program", program, variant };
  } catch (e) {
    if (
      e instanceof Error &&
      (e.message === "PROGRAM_REMOVED" || e.message === "PROGRAM_UNAVAILABLE")
    ) {
      const programId = await resolveProgramId();
      if (!programId) {
        throw notFound();
      }
      const removal = await loadPublicProgramRemovalForProgram(programId);
      return { kind: "removed", removal };
    }
    throw e;
  }
}

function throwPublicCanonicalRedirect(
  authorSlug: string,
  programSlug: string,
): never {
  throwHistoryRedirect({
    to: "/u/$authorSlug/$programRef",
    params: { authorSlug, programRef: programSlug },
  });
}

function throwShareTokenPathRedirect(
  authorSlug: string,
  programSlug: string,
  shareToken: string,
): never {
  throwHistoryRedirect({
    to: "/u/$authorSlug/$programRef/$shareToken",
    params: { authorSlug, programRef: programSlug, shareToken },
  });
}

async function tryResolveSlugHistoryRedirect(args: {
  authorSlug: string;
  programSlug: string;
}): Promise<void> {
  const resolved = await resolvePublicProgramRedirect({
    data: {
      authorSlug: args.authorSlug,
      programRef: args.programSlug,
    },
  });
  if (resolved.kind === "redirect") {
    throwProgramPathHistoryRedirect(resolved.path);
  }
}

export async function loadPublicSlugProgramRoute(args: {
  authorSlug: string;
  programSlug: string;
}): Promise<PublicProgramRouteData> {
  if (isProgramIdRef(args.programSlug)) {
    throw notFound();
  }
  try {
    const program = await getPublicProgramBySlug({
      data: {
        authorSlug: args.authorSlug,
        programSlug: args.programSlug,
      },
    });
    return { kind: "program", program, variant: "public" };
  } catch (e) {
    if (
      e instanceof Error &&
      (e.message === "PROGRAM_REMOVED" || e.message === "PROGRAM_UNAVAILABLE")
    ) {
      const programId = await resolveProgramIdForPublicPath({
        data: {
          authorSlug: args.authorSlug,
          programRef: args.programSlug,
        },
      });
      if (!programId) {
        throw notFound();
      }
      const removal = await loadPublicProgramRemovalForProgram(programId);
      return { kind: "removed", removal };
    }
    if (e instanceof Error && e.message === "PROGRAM_NOT_FOUND") {
      await tryResolveSlugHistoryRedirect(args);
      throw notFound();
    }
    throw e;
  }
}

export async function loadShareTokenProgramRoute(args: {
  authorSlug: string;
  programSlug: string;
  shareToken: string;
}): Promise<PublicProgramRouteData> {
  try {
    const program = await loadPublicProgramOrNotFound(() =>
      getPublicProgramByToken({ data: { token: args.shareToken } }),
    );
    const currentAuthor = program.author.authorSlug;
    const currentSlug = program.slug;
    if (program.visibility === "public" && currentAuthor && currentSlug) {
      throwPublicCanonicalRedirect(currentAuthor, currentSlug);
    }
    if (currentAuthor && currentSlug) {
      if (
        args.authorSlug !== currentAuthor ||
        args.programSlug !== currentSlug
      ) {
        throwShareTokenPathRedirect(
          currentAuthor,
          currentSlug,
          args.shareToken,
        );
      }
    }
    if (program.visibility !== "unlisted") {
      throw notFound();
    }
    return { kind: "program", program, variant: "unlisted" };
  } catch (e) {
    if (
      e instanceof Error &&
      (e.message === "PROGRAM_REMOVED" || e.message === "PROGRAM_UNAVAILABLE")
    ) {
      const programId = await resolveProgramIdForPublicPath({
        data: { shareToken: args.shareToken, programRef: args.programSlug },
      });
      if (!programId) {
        throw notFound();
      }
      const removal = await loadPublicProgramRemovalForProgram(programId);
      return { kind: "removed", removal };
    }
    throw e;
  }
}

export async function loadPermalinkProgramRoute(args: {
  programId: string;
}): Promise<PublicProgramRouteData> {
  return loadProgramOrRemoval(
    () => getPublicProgramById({ data: { programId: args.programId } }),
    async () => args.programId,
    "public",
  );
}
