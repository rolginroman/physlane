import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { ProgramNotFound } from "#/components/programs/program-not-found";
import { ProgramRemovedPage } from "#/components/programs/program-removed";
import { PublicProgramPage } from "#/components/programs/public-program-page";
import {
  loadProgramOrRemovalFromId,
  loadTokenProgramRoute,
} from "#/lib/programs/load-public-program-route";
import { publicProgramSeoHead } from "#/lib/programs/public-program-seo";
import { publicProgramCanonicalPath } from "#/lib/programs/program-urls";

const searchSchema = z.object({
  t: z.string().optional(),
  copy: z.coerce.boolean().optional(),
});

export const Route = createFileRoute("/p/$programId")({
  staticData: { appChrome: false },
  validateSearch: (search) => searchSchema.parse(search),
  loaderDeps: ({ search }) => ({ token: search.t, copy: search.copy }),
  loader: async ({ params, deps, location }) => {
    const returnPath = location.pathname + (location.searchStr ?? "");
    const pendingCopyIntent = Boolean(deps.copy);

    if (deps.token) {
      const data = await loadTokenProgramRoute({
        programId: params.programId,
        token: deps.token,
      });
      if (data.kind === "removed") {
        return { route: data, returnPath, pendingCopyIntent };
      }
      const { program } = data;
      if (
        program.visibility === "public" &&
        program.author.authorSlug &&
        program.slug
      ) {
        throw redirect({
          to: "/u/$authorSlug/p/$programRef",
          params: {
            authorSlug: program.author.authorSlug,
            programRef: program.slug,
          },
          statusCode: 301,
        });
      }
      if (program.visibility !== "unlisted") {
        throw notFound();
      }
      return { route: data, returnPath, pendingCopyIntent };
    }

    const data = await loadProgramOrRemovalFromId(params.programId);
    return { route: data, returnPath, pendingCopyIntent };
  },
  head: ({ loaderData }) => {
    if (!loaderData || loaderData.route.kind === "removed") {
      return { meta: [{ name: "robots", content: "noindex" }] };
    }
    const { program, variant } = loaderData.route;
    const path = `/p/${program.id}${variant === "unlisted" && program.shareToken ? `?t=${encodeURIComponent(program.shareToken)}` : ""}`;
    if (variant === "unlisted") {
      return publicProgramSeoHead(program, {
        path,
        canonicalPath: path,
        noindex: true,
      });
    }
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
  component: TokenProgramPage,
});

function TokenProgramPage() {
  const { route, returnPath, pendingCopyIntent } = Route.useLoaderData();
  if (route.kind === "removed") {
    return <ProgramRemovedPage removal={route.removal} />;
  }
  return (
    <PublicProgramPage
      program={route.program}
      variant={route.variant}
      returnPath={returnPath}
      pendingCopyIntent={pendingCopyIntent}
    />
  );
}
