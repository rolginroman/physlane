import { createFileRoute } from "@tanstack/react-router";
import { ProgramNotFound } from "#/components/programs/program-not-found";
import { PublicProgramPage } from "#/components/programs/public-program-page";
import { loadPublicProgramOrNotFound } from "#/lib/programs/load-public-program";
import { publicProgramSeoHead } from "#/lib/programs/public-program-seo";
import { publicProgramCanonicalPath } from "#/lib/programs/program-urls";
import {
  getPublicProgramById,
  getPublicProgramBySlug,
} from "#/server/programs.fns";

// TanStack Router cannot host two dynamic segments at the same path; disambiguate at load time.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isProgramIdRef(ref: string): boolean {
  return UUID_RE.test(ref);
}

export const Route = createFileRoute("/u/$authorSlug/p/$programRef")({
  staticData: { appChrome: false },
  loader: async ({ params }) => {
    const program = await loadPublicProgramOrNotFound(() =>
      isProgramIdRef(params.programRef)
        ? getPublicProgramById({
            data: { programId: params.programRef },
          })
        : getPublicProgramBySlug({
            data: {
              authorSlug: params.authorSlug,
              programSlug: params.programRef,
            },
          }),
    );
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
