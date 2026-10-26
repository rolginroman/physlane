import { publicProgramCanonicalPath } from "#/lib/programs/program-urls";
import { SITE_URL, seoHead } from "#/lib/seo";
import type { PublicProgramDTO } from "#/server/programs.fns";

const DEFAULT_OG_IMAGE = `${SITE_URL}/og.png`;

export function publicProgramSeoHead(
  program: PublicProgramDTO,
  options: {
    path: string;
    canonicalPath?: string;
    noindex?: boolean;
  },
) {
  const authorName = program.author.displayName ?? "Author";
  const title = `${program.title} · ${authorName}`;
  const description =
    program.description?.trim() ||
    `${goalLine(program)} training program on physlane.`;
  const canonicalPath =
    options.canonicalPath ??
    (program.author.authorSlug && program.slug
      ? publicProgramCanonicalPath(program.author.authorSlug, program.slug)
      : options.path);

  return seoHead({
    title,
    description,
    path: options.path,
    canonicalPath,
    image: DEFAULT_OG_IMAGE,
    noindex: options.noindex,
  });
}

function goalLine(program: PublicProgramDTO): string {
  return program.goal.replace("-", " ");
}
