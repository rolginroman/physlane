import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ProgramNotFound } from "#/components/programs/program-not-found";
import { ProgramRemovedPage } from "#/components/programs/program-removed";
import { PublicProgramPage } from "#/components/programs/public-program-page";
import {
  isProgramIdRef,
  loadUserProgramRoute,
} from "#/lib/programs/load-public-program-route";
import { publicProgramSeoHead } from "#/lib/programs/public-program-seo";
import { publicProgramCanonicalPath } from "#/lib/programs/program-urls";

const searchSchema = z.object({
  t: z.string().optional(),
  copy: z.coerce.boolean().optional(),
});

export const Route = createFileRoute("/u/$authorSlug/p/$programRef")({
  staticData: { appChrome: false },
  validateSearch: (search) => searchSchema.parse(search),
  loaderDeps: ({ search }) => ({
    shareToken: search.t,
    copy: search.copy,
  }),
  loader: async ({ params, deps, location }) => {
    const data = await loadUserProgramRoute({
      authorSlug: params.authorSlug,
      programRef: params.programRef,
      shareToken: deps.shareToken,
    });
    return {
      route: data,
      returnPath: location.pathname + (location.searchStr ?? ""),
      pendingCopyIntent: Boolean(deps.copy),
    };
  },
  head: ({ loaderData, params }) => {
    if (!loaderData || loaderData.route.kind === "removed") {
      return { meta: [{ name: "robots", content: "noindex" }] };
    }
    const { program } = loaderData.route;
    if (isProgramIdRef(params.programRef)) {
      const path = `/u/${params.authorSlug}/p/${params.programRef}`;
      const canonicalPath =
        program.author.authorSlug && program.slug
          ? publicProgramCanonicalPath(program.author.authorSlug, program.slug)
          : path;
      return publicProgramSeoHead(loaderData.route.program, {
        path,
        canonicalPath,
      });
    }
    const path = publicProgramCanonicalPath(
      params.authorSlug,
      params.programRef,
    );
    return publicProgramSeoHead(loaderData.route.program, { path });
  },
  notFoundComponent: ProgramNotFound,
  component: PublicUserProgramPage,
});

function PublicUserProgramPage() {
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
