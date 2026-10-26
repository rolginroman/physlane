import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  programRouteError,
  PublicProgramViewPending,
} from "#/components/programs/program-route-states";
import { ProgramNotFound } from "#/components/programs/program-not-found";
import { ProgramRemovedPage } from "#/components/programs/program-removed";
import { PublicProgramPage } from "#/components/programs/public-program-page";
import { loadPublicSlugProgramRoute } from "#/lib/programs/load-public-program-route";
import { loadViewerUnitSystem } from "#/lib/programs/viewer-unit-system";
import { publicProgramSeoHead } from "#/lib/programs/public-program-seo";
import { publicProgramCanonicalPath } from "#/lib/programs/program-urls";

const searchSchema = z.object({
  copy: z.coerce.boolean().optional(),
});

export const Route = createFileRoute("/u/$authorSlug/$programRef/")({
  validateSearch: (search) => searchSchema.parse(search),
  loaderDeps: ({ search }) => ({
    copy: search.copy,
  }),
  loader: async ({ params, deps, location }) => {
    const [route, unitSystem] = await Promise.all([
      loadPublicSlugProgramRoute({
        authorSlug: params.authorSlug,
        programSlug: params.programRef,
      }),
      loadViewerUnitSystem(),
    ]);
    return {
      route,
      unitSystem,
      returnPath: location.pathname + (location.searchStr ?? ""),
      pendingCopyIntent: Boolean(deps.copy),
    };
  },
  pendingComponent: PublicProgramViewPending,
  errorComponent: programRouteError,
  head: ({ loaderData, params }) => {
    if (!loaderData || loaderData.route.kind === "removed") {
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
  const { route, unitSystem, returnPath, pendingCopyIntent } =
    Route.useLoaderData();
  if (route.kind === "removed") {
    return <ProgramRemovedPage removal={route.removal} />;
  }
  return (
    <PublicProgramPage
      program={route.program}
      variant="public"
      unitSystem={unitSystem}
      returnPath={returnPath}
      pendingCopyIntent={pendingCopyIntent}
    />
  );
}
