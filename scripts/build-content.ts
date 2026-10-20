import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseBlogFile } from "../src/lib/blog/schema";
import {
  buildRssXml,
  buildSitemapXml,
  type SyndicationPost,
} from "../src/lib/blog/syndication";

const contentDir = join(import.meta.dirname, "../content/blog");
const publicDir = join(import.meta.dirname, "../public");

function slugFromFilename(filename: string): string {
  return filename.replace(/\.mdx$/, "");
}

function sortNewestFirst(posts: SyndicationPost[]): SyndicationPost[] {
  return [...posts].sort((a, b) =>
    a.published < b.published ? 1 : a.published > b.published ? -1 : 0,
  );
}

function loadPosts(): SyndicationPost[] {
  const files = readdirSync(contentDir).filter((f) => f.endsWith(".mdx"));
  const posts: SyndicationPost[] = [];
  for (const file of files) {
    const raw = readFileSync(join(contentDir, file), "utf8");
    const fm = parseBlogFile(raw, file);
    if (fm.draft) continue;
    posts.push({
      slug: slugFromFilename(file),
      title: fm.title,
      description: fm.description,
      published: fm.published,
      updated: fm.updated,
    });
  }
  return sortNewestFirst(posts);
}

function main(): void {
  const posts = loadPosts();
  const sitemapPath = join(publicDir, "sitemap.xml");
  const rssPath = join(publicDir, "rss.xml");
  writeFileSync(sitemapPath, buildSitemapXml(posts), "utf8");
  writeFileSync(rssPath, buildRssXml(posts), "utf8");
  console.log(
    `build-content: ${posts.length} post(s) → ${sitemapPath}, ${rssPath}`,
  );
}

main();
