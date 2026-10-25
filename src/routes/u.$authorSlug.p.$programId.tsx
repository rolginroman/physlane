import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ProgramNotFound } from "#/components/programs/program-not-found";
import { ProgramRemovedPage } from "#/components/programs/program-removed";
import { PublicProgramPage } from "#/components/programs/public-program-page";
import { loadPermalinkProgramRoute } from "#/lib/programs/load-public-program-route";
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
    const route = await loadPermalinkProgramRoute({
      programId: params.programId,
    });
    return {
      route,
      returnPath: location.pathname + (location.searchStr ?? ""),
      pendingCopyIntent: Boolean(deps.copy),
    };
  },
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
  const { route, returnPath, pendingCopyIntent } = Route.useLoaderData();
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
