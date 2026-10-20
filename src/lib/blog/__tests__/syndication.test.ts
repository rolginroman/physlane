import { describe, expect, it } from "vitest";
import { SITE_URL } from "#/lib/seo";
import {
  buildRssXml,
  buildSitemapXml,
  type SyndicationPost,
} from "../syndication";

const postA: SyndicationPost = {
  slug: "what-is-tdee",
  title: "What is TDEE?",
  description: "Calories & energy — a plain guide.",
  published: "2026-10-10",
  updated: "2026-10-15",
};

const postB: SyndicationPost = {
  slug: "macros-basics",
  title: "Macros <101>",
  description: "Protein, carbs, and fat explained.",
  published: "2026-10-19",
  updated: "2026-10-19",
};

describe("buildSitemapXml", () => {
  it("emits loc/lastmod for home, blog index, and each post", () => {
    const xml = buildSitemapXml([postA, postB]);
    expect(xml).toContain(`<loc>${SITE_URL}/</loc>`);
    expect(xml).toContain(`<loc>${SITE_URL}/blog</loc>`);
    expect(xml).toContain(`<loc>${SITE_URL}/blog/what-is-tdee</loc>`);
    expect(xml).toContain(`<loc>${SITE_URL}/blog/macros-basics</loc>`);

    expect(xml).toMatch(
      new RegExp(
        `<loc>${SITE_URL}/blog/what-is-tdee</loc>\\s*<lastmod>2026-10-15</lastmod>`,
      ),
    );
    expect(xml).toMatch(
      new RegExp(
        `<loc>${SITE_URL}/blog/macros-basics</loc>\\s*<lastmod>2026-10-19</lastmod>`,
      ),
    );

    const homeBlock = xml.match(
      new RegExp(`<loc>${SITE_URL}/</loc>\\s*<lastmod>([^<]+)</lastmod>`),
    );
    expect(homeBlock?.[1]).toBe("2026-10-19");
  });

  it("adds a sitemap loc when a third post is included", () => {
    const two = buildSitemapXml([postA, postB]);
    const third: SyndicationPost = {
      slug: "sleep-and-recovery",
      title: "Sleep and recovery",
      description: "Rest matters.",
      published: "2026-10-20",
      updated: "2026-10-20",
    };
    const three = buildSitemapXml([postA, postB, third]);
    expect(three).toContain(`<loc>${SITE_URL}/blog/sleep-and-recovery</loc>`);
    expect(three.match(/<loc>/g)?.length).toBe(
      (two.match(/<loc>/g)?.length ?? 0) + 1,
    );
  });
});

describe("buildRssXml", () => {
  it("uses RFC-822 pubDate from published and escapes text", () => {
    const xml = buildRssXml([postA, postB]);
    expect(xml).toContain(
      `<pubDate>${new Date(postA.published).toUTCString()}</pubDate>`,
    );
    expect(xml).toContain(
      `<pubDate>${new Date(postB.published).toUTCString()}</pubDate>`,
    );
    expect(xml).toContain("<title>Macros &lt;101&gt;</title>");
    expect(xml).toContain("Calories &amp; energy");
    expect(xml).toContain(`<link>${SITE_URL}/blog</link>`);
  });

  it("only includes posts passed in (caller filters drafts)", () => {
    const xml = buildRssXml([postA]);
    expect(xml).toContain("what-is-tdee");
    expect(xml).not.toContain("macros-basics");
  });
});
