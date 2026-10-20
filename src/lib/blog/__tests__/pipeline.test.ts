import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { getAllPosts, selectVisible, type BlogPost } from "../posts";
import { parseBlogFile } from "../schema";
import { ogImageForPost } from "../og";
import { seoHead, SITE_URL } from "#/lib/seo";

const contentDir = join(import.meta.dirname, "../../../../content/blog");

describe("blog schema", () => {
  it("parses every committed MDX file", () => {
    const files = readdirSync(contentDir).filter((f) => f.endsWith(".mdx"));
    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      const raw = readFileSync(join(contentDir, file), "utf8");
      const data = parseBlogFile(raw, file);
      expect(file.replace(/\.mdx$/, "")).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(["training", "nutrition", "health"]).toContain(data.category);
    }
  });

  it("rejects malformed frontmatter", () => {
    const raw = `---
title: x
description: too short
category: nutrition
published: 2026-01-01
updated: 2026-01-01
---
body`;
    expect(() => parseBlogFile(raw, "bad.mdx")).toThrow(/bad\.mdx/);
  });
});

describe("blog index", () => {
  it("compile smoke: committed what-is-tdee post parses with expected metadata", () => {
    const posts = getAllPosts(false);
    const tdee = posts.find((p) => p.slug === "what-is-tdee");
    expect(tdee?.title.length).toBeGreaterThan(0);
    expect(tdee?.category).toBe("nutrition");
  });

  it("selectVisible hides drafts in prod and sorts by published desc", () => {
    const fixtures: BlogPost[] = [
      {
        slug: "old",
        title: "Old",
        description: "x".repeat(40),
        category: "health",
        published: "2026-01-01",
        updated: "2026-01-01",
        draft: false,
        Content: () => null,
      },
      {
        slug: "new",
        title: "New",
        description: "y".repeat(40),
        category: "health",
        published: "2026-06-01",
        updated: "2026-06-01",
        draft: false,
        Content: () => null,
      },
      {
        slug: "draft",
        title: "Draft",
        description: "z".repeat(40),
        category: "health",
        published: "2026-12-01",
        updated: "2026-12-01",
        draft: true,
        Content: () => null,
      },
    ];
    const prod = selectVisible(fixtures, true);
    expect(prod.map((p) => p.slug)).toEqual(["new", "old"]);
    const dev = selectVisible(fixtures, false);
    expect(dev.map((p) => p.slug)).toEqual(["draft", "new", "old"]);
  });
});

describe("seoHead", () => {
  it("emits guide-aligned meta plus robots and json-ld", () => {
    const head = seoHead({
      title: "Test · physlane",
      description: "A long enough description for SEO testing purposes here.",
      path: "/blog/what-is-tdee",
      image: `${SITE_URL}/og.png`,
      type: "article",
      jsonLd: {
        "@type": "BlogPosting",
        dateModified: "2026-10-19",
      },
    });
    const robots = head.meta.find((m) => m.name === "robots")?.content;
    expect(robots).toContain("max-image-preview:large");
    expect(head.links[0]?.href).toBe(`${SITE_URL}/blog/what-is-tdee`);
    expect(head.meta.some((m) => m.property === "og:title")).toBe(true);
    expect(head.meta.some((m) => m.name === "twitter:image")).toBe(true);
    expect(head.scripts?.[0]?.children).toContain("dateModified");
  });
});

describe("ogImageForPost", () => {
  it("resolves default and override URLs with cache-bust from updated", () => {
    const a = ogImageForPost({ slug: "what-is-tdee", updated: "2026-10-19" });
    const b = ogImageForPost({ slug: "what-is-tdee", updated: "2026-10-20" });
    expect(a).toContain("/og/blog/what-is-tdee.png?v=");
    expect(a).not.toBe(b);
    const override = ogImageForPost({
      slug: "what-is-tdee",
      updated: "2026-10-19",
      ogImage: "/custom.png",
    });
    expect(override).toContain("/custom.png?v=");
  });
});
