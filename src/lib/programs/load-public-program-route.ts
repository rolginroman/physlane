import { notFound } from "@tanstack/react-router";
import { throwProgramPathHistoryRedirect } from "#/lib/programs/history-redirect";
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

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isProgramIdRef(ref: string): boolean {
  return UUID_RE.test(ref);
}

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

export async function loadUserProgramRoute(args: {
  authorSlug: string;
  programRef: string;
  shareToken?: string;
}): Promise<PublicProgramRouteData> {
  try {
    if (isProgramIdRef(args.programRef)) {
      return loadProgramOrRemoval(
        () =>
          getPublicProgramById({
            data: { programId: args.programRef },
          }),
        async () => args.programRef,
        "public",
      );
    }
    return loadProgramOrRemoval(
      () =>
        getPublicProgramBySlug({
          data: {
            authorSlug: args.authorSlug,
            programSlug: args.programRef,
          },
        }),
      () =>
        resolveProgramIdForPublicPath({
          data: {
            authorSlug: args.authorSlug,
            programRef: args.programRef,
            shareToken: args.shareToken,
          },
        }),
      "public",
    );
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

export async function loadTokenProgramRoute(args: {
  programId: string;
  token: string;
}): Promise<PublicProgramRouteData> {
  return loadProgramOrRemoval(
    () => getPublicProgramByToken({ data: { token: args.token } }),
    () =>
      resolveProgramIdForPublicPath({
        data: { programRef: args.programId, shareToken: args.token },
      }),
    "unlisted",
  );
}

export async function loadProgramOrRemovalFromId(
  programId: string,
): Promise<PublicProgramRouteData> {
  return loadProgramOrRemoval(
    () => getPublicProgramById({ data: { programId } }),
    async () => programId,
    "public",
  );
}
