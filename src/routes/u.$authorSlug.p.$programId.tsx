import { createFileRoute } from "@tanstack/react-router";
import { ProgramNotFound } from "#/components/programs/program-not-found";
import { PublicProgramPage } from "#/components/programs/public-program-page";
import { loadPublicProgramOrNotFound } from "#/lib/programs/load-public-program";
import { publicProgramSeoHead } from "#/lib/programs/public-program-seo";
import { publicProgramCanonicalPath } from "#/lib/programs/program-urls";
import { getPublicProgramById } from "#/server/programs.fns";

export const Route = createFileRoute("/u/$authorSlug/p/$programId")({
  staticData: { appChrome: false },
  loader: async ({ params }) => {
    const program = await loadPublicProgramOrNotFound(() =>
      getPublicProgramById({ data: { programId: params.programId } }),
    );
    return { program };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData) return {};
    const path = `/u/${params.authorSlug}/p/${params.programId}`;
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
  },
  notFoundComponent: ProgramNotFound,
  component: IdPermalinkProgramPage,
});

function IdPermalinkProgramPage() {
  const { program } = Route.useLoaderData();
  return <PublicProgramPage program={program} variant="public" />;
}
