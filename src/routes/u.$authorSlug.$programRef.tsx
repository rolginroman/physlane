import { createFileRoute, Outlet, useMatches } from "@tanstack/react-router";
import { z } from "zod";
import { ProgramNotFound } from "#/components/programs/program-not-found";
import { ProgramRemovedPage } from "#/components/programs/program-removed";
import { PublicProgramPage } from "#/components/programs/public-program-page";
import { loadPublicSlugProgramRoute } from "#/lib/programs/load-public-program-route";
import { isProgramPathLeaf } from "#/lib/programs/public-program-path";
import { publicProgramSeoHead } from "#/lib/programs/public-program-seo";
import { publicProgramCanonicalPath } from "#/lib/programs/program-urls";

const searchSchema = z.object({
  copy: z.coerce.boolean().optional(),
});

export const Route = createFileRoute("/u/$authorSlug/$programRef")({
  staticData: { appChrome: false },
  validateSearch: (search) => searchSchema.parse(search),
  loaderDeps: ({ search }) => ({
    copy: search.copy,
  }),
  loader: async ({ params, deps, location }) => {
    if (
      !isProgramPathLeaf(
        location.pathname,
        params.authorSlug,
        params.programRef,
      )
    ) {
      return {
        route: null,
        returnPath: location.pathname + (location.searchStr ?? ""),
        pendingCopyIntent: Boolean(deps.copy),
      };
    }
    const route = await loadPublicSlugProgramRoute({
      authorSlug: params.authorSlug,
      programSlug: params.programRef,
    });
    return {
      route,
      returnPath: location.pathname + (location.searchStr ?? ""),
      pendingCopyIntent: Boolean(deps.copy),
    };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData?.route || loaderData.route.kind === "removed") {
      return { meta: [{ name: "robots", content: "noindex" }] };
    }
    const path = publicProgramCanonicalPath(
      params.authorSlug,
      params.programRef,
    );
    return publicProgramSeoHead(loaderData.route.program, { path });
  },
  notFoundComponent: ProgramNotFound,
  component: PublicSlugProgramPage,
});

function PublicSlugProgramPage() {
  const isLeaf = useMatches({
    select: (matches) => matches.at(-1)?.routeId === Route.id,
  });
  if (!isLeaf) {
    return <Outlet />;
  }
  const { route, returnPath, pendingCopyIntent } = Route.useLoaderData();
  if (!route) {
    return null;
  }
  if (route.kind === "removed") {
    return <ProgramRemovedPage removal={route.removal} />;
  }
  return (
    <PublicProgramPage
      program={route.program}
      variant="public"
      returnPath={returnPath}
      pendingCopyIntent={pendingCopyIntent}
    />
  );
}
