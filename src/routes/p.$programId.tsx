import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { ProgramNotFound } from "#/components/programs/program-not-found";
import { PublicProgramPage } from "#/components/programs/public-program-page";
import { loadPublicProgramOrNotFound } from "#/lib/programs/load-public-program";
import { publicProgramSeoHead } from "#/lib/programs/public-program-seo";
import { publicProgramCanonicalPath } from "#/lib/programs/program-urls";
import {
  getPublicProgramById,
  getPublicProgramByToken,
} from "#/server/programs.fns";

const searchSchema = z.object({
  t: z.string().optional(),
});

export const Route = createFileRoute("/p/$programId")({
  staticData: { appChrome: false },
  validateSearch: (search) => searchSchema.parse(search),
  loaderDeps: ({ search }) => ({ token: search.t }),
  loader: async ({ params, deps }) => {
    if (deps.token) {
      const program = await loadPublicProgramOrNotFound(() =>
        getPublicProgramByToken({ data: { token: deps.token! } }),
      );
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
      return { program, variant: "unlisted" as const };
    }
    const program = await loadPublicProgramOrNotFound(() =>
      getPublicProgramById({ data: { programId: params.programId } }),
    );
    return { program, variant: "public" as const };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const { program, variant } = loaderData;
    const path = `/p/${program.id}${variant === "unlisted" && program.shareToken ? `?t=${encodeURIComponent(program.shareToken)}` : ""}`;
    const canonicalPath =
      program.author.authorSlug && program.slug
        ? publicProgramCanonicalPath(program.author.authorSlug, program.slug)
        : path;
    return publicProgramSeoHead(program, {
      path,
      canonicalPath,
      noindex: variant === "unlisted",
    });
  },
  notFoundComponent: ProgramNotFound,
  component: TokenProgramPage,
});

function TokenProgramPage() {
  const { program, variant } = Route.useLoaderData();
  return <PublicProgramPage program={program} variant={variant} />;
}
