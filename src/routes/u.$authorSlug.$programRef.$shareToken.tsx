import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ProgramNotFound } from "#/components/programs/program-not-found";
import { ProgramRemovedPage } from "#/components/programs/program-removed";
import { PublicProgramPage } from "#/components/programs/public-program-page";
import { loadShareTokenProgramRoute } from "#/lib/programs/load-public-program-route";
import { publicProgramSeoHead } from "#/lib/programs/public-program-seo";
import { shareLinkPath } from "#/lib/programs/program-urls";

const searchSchema = z.object({
  copy: z.coerce.boolean().optional(),
});

export const Route = createFileRoute("/u/$authorSlug/$programRef/$shareToken")({
  staticData: { appChrome: false },
  validateSearch: (search) => searchSchema.parse(search),
  loaderDeps: ({ search }) => ({
    copy: search.copy,
  }),
  loader: async ({ params, deps, location }) => {
    const route = await loadShareTokenProgramRoute({
      authorSlug: params.authorSlug,
      programSlug: params.programRef,
      shareToken: params.shareToken,
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
    const path = shareLinkPath(
      params.authorSlug,
      params.programRef,
      params.shareToken,
    );
    return publicProgramSeoHead(loaderData.route.program, {
      path,
      canonicalPath: path,
      noindex: true,
    });
  },
  notFoundComponent: ProgramNotFound,
  component: ShareTokenProgramPage,
});

function ShareTokenProgramPage() {
  const { route, returnPath, pendingCopyIntent } = Route.useLoaderData();
  if (route.kind === "removed") {
    return <ProgramRemovedPage removal={route.removal} />;
  }
  return (
    <PublicProgramPage
      program={route.program}
      variant="unlisted"
      returnPath={returnPath}
      pendingCopyIntent={pendingCopyIntent}
    />
  );
}
