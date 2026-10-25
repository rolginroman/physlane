import { createFileRoute } from "@tanstack/react-router";
import { ProgramNotFound } from "#/components/programs/program-not-found";
import { PublicProgramPage } from "#/components/programs/public-program-page";
import { publicProgramSeoHead } from "#/lib/programs/public-program-seo";
import {
  isProgramIdRef,
  loadUserProgramRoute,
} from "#/lib/programs/load-public-program-route";
import { publicProgramCanonicalPath } from "#/lib/programs/program-urls";

export const Route = createFileRoute("/u/$authorSlug/p/$programRef")({
  staticData: { appChrome: false },
  loader: async ({ params }) => {
    const program = await loadUserProgramRoute({
      authorSlug: params.authorSlug,
      programRef: params.programRef,
    });
    return { program };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return {};
    if (isProgramIdRef(params.programRef)) {
      const path = `/u/${params.authorSlug}/p/${params.programRef}`;
      const canonicalPath =
        loaderData.program.author.authorSlug && loaderData.program.slug
          ? publicProgramCanonicalPath(
              loaderData.program.author.authorSlug,
              loaderData.program.slug,
            )
          : path;
      return publicProgramSeoHead(loaderData.program, {
        path,
        canonicalPath,
      });
    }
    const path = publicProgramCanonicalPath(
      params.authorSlug,
      params.programRef,
    );
    return publicProgramSeoHead(loaderData.program, { path });
  },
  notFoundComponent: ProgramNotFound,
  component: PublicUserProgramPage,
});

function PublicUserProgramPage() {
  const { program } = Route.useLoaderData();
  return <PublicProgramPage program={program} variant="public" />;
}
