import { LAST_UPDATED } from "#/lib/legal";
import { SITE_URL } from "#/lib/seo";
import { publicProgramCanonicalUrl } from "#/lib/programs/program-urls";

export type ProgramSitemapEntry = {
  authorSlug: string;
  programSlug: string;
  updatedAt: string;
};

export type AuthorProfileSitemapEntry = {
  authorSlug: string;
  updatedAt: string;
};

function urlEntry(loc: string, lastmod: string): string {
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
  </url>`;
}

function lastmodFromIso(iso: string): string {
  return iso.slice(0, 10);
}

/** Static site URLs preserved from the former public/sitemap.xml. */
const STATIC_SITEMAP_LASTMOD = {
  home: "2026-11-09",
  blog: "2026-11-09",
  privacy: "2026-10-20",
  terms: "2026-10-20",
  posts: {
    "progressive-overload-basics": "2026-11-09",
    "sleep-and-recovery": "2026-10-26",
    "what-is-tdee": "2026-10-19",
    "protein-per-meal": "2026-09-28",
  },
} as const;

export function authorProfilePath(authorSlug: string): string {
  return `/u/${authorSlug}`;
}

export function buildSiteSitemapXml(
  programs: ProgramSitemapEntry[],
  authorProfiles: AuthorProfileSitemapEntry[] = [],
): string {
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urlEntry(`${SITE_URL}/`, STATIC_SITEMAP_LASTMOD.home),
    urlEntry(`${SITE_URL}/blog`, STATIC_SITEMAP_LASTMOD.blog),
    urlEntry(`${SITE_URL}/privacy`, LAST_UPDATED),
    urlEntry(`${SITE_URL}/terms`, LAST_UPDATED),
    urlEntry(
      `${SITE_URL}/blog/progressive-overload-basics`,
      STATIC_SITEMAP_LASTMOD.posts["progressive-overload-basics"],
    ),
    urlEntry(
      `${SITE_URL}/blog/sleep-and-recovery`,
      STATIC_SITEMAP_LASTMOD.posts["sleep-and-recovery"],
    ),
    urlEntry(
      `${SITE_URL}/blog/what-is-tdee`,
      STATIC_SITEMAP_LASTMOD.posts["what-is-tdee"],
    ),
    urlEntry(
      `${SITE_URL}/blog/protein-per-meal`,
      STATIC_SITEMAP_LASTMOD.posts["protein-per-meal"],
    ),
    ...programs.map((p) =>
      urlEntry(
        publicProgramCanonicalUrl(p.authorSlug, p.programSlug),
        lastmodFromIso(p.updatedAt),
      ),
    ),
    ...authorProfiles.map((a) =>
      urlEntry(
        `${SITE_URL}${authorProfilePath(a.authorSlug)}`,
        lastmodFromIso(a.updatedAt),
      ),
    ),
    "</urlset>",
  ];
  return `${lines.join("\n")}\n`;
}
