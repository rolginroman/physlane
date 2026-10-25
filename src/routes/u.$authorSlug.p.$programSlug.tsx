import { createFileRoute } from "@tanstack/react-router";
import { ProgramNotFound } from "#/components/programs/program-not-found";
import { PublicProgramPage } from "#/components/programs/public-program-page";
import { loadPublicProgramOrNotFound } from "#/lib/programs/load-public-program";
import { publicProgramSeoHead } from "#/lib/programs/public-program-seo";
import { publicProgramCanonicalPath } from "#/lib/programs/program-urls";
import { getPublicProgramBySlug } from "#/server/programs.fns";

export const Route = createFileRoute("/u/$authorSlug/p/$programSlug")({
  staticData: { appChrome: false },
  loader: async ({ params }) => {
    const program = await loadPublicProgramOrNotFound(() =>
      getPublicProgramBySlug({
        data: {
          authorSlug: params.authorSlug,
          programSlug: params.programSlug,
        },
      }),
    );
    return { program };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return {};
    const path = publicProgramCanonicalPath(
      params.authorSlug,
      params.programSlug,
    );
    return publicProgramSeoHead(loaderData.program, { path });
  },
  notFoundComponent: ProgramNotFound,
  component: CanonicalProgramPage,
});

function CanonicalProgramPage() {
  const { program } = Route.useLoaderData();
  return <PublicProgramPage program={program} variant="public" />;
}
