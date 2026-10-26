import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import {
  programRouteError,
  PublicProgramViewPending,
} from "#/components/programs/program-route-states";
import { ProgramNotFound } from "#/components/programs/program-not-found";
import { ProgramRemovedPage } from "#/components/programs/program-removed";
import { PublicProgramPage } from "#/components/programs/public-program-page";
import { loadPermalinkProgramRoute } from "#/lib/programs/load-public-program-route";
import { loadViewerUnitSystem } from "#/lib/programs/viewer-unit-system";
import { publicProgramSeoHead } from "#/lib/programs/public-program-seo";
import {
  publicProgramCanonicalPath,
  publicProgramIdPermalinkPath,
} from "#/lib/programs/program-urls";

const searchSchema = z.object({
  copy: z.coerce.boolean().optional(),
});

export const Route = createFileRoute("/u/$authorSlug/p/$programId")({
  staticData: { appChrome: false },
  validateSearch: (search) => searchSchema.parse(search),
  loaderDeps: ({ search }) => ({
    copy: search.copy,
  }),
  loader: async ({ params, deps, location }) => {
    const [route, unitSystem] = await Promise.all([
      loadPermalinkProgramRoute({
        authorSlug: params.authorSlug,
        programId: params.programId,
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
    const { program } = loaderData.route;
    const path = publicProgramIdPermalinkPath(
      params.authorSlug,
      params.programId,
    );
    const canonicalPath =
      program.author.authorSlug && program.slug
        ? publicProgramCanonicalPath(program.author.authorSlug, program.slug)
        : path;
    return publicProgramSeoHead(program, {
      path,
      canonicalPath,
    });
  },
  notFoundComponent: ProgramNotFound,
  component: PermalinkProgramPage,
});

function PermalinkProgramPage() {
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
