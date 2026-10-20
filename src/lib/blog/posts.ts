import type { ComponentType } from "react";
import type { BlogFrontmatter } from "./schema";
import { BlogFrontmatter as BlogFrontmatterSchema } from "./schema";

export interface BlogPost extends BlogFrontmatter {
  slug: string;
  Content: ComponentType<{ components?: Record<string, unknown> }>;
}

type MdxModule = {
  frontmatter: unknown;
  default: ComponentType<{ components?: Record<string, unknown> }>;
};

const mdxModules = import.meta.glob("../../../content/blog/*.mdx", {
  eager: true,
}) as Record<string, MdxModule>;

function slugFromPath(path: string): string {
  const base = path.split("/").pop() ?? path;
  return base.replace(/\.mdx$/, "");
}

function toPost(path: string, mod: MdxModule): BlogPost {
  const slug = slugFromPath(path);
  const parsed = BlogFrontmatterSchema.safeParse(mod.frontmatter);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path.join(".") ?? "frontmatter";
    throw new Error(
      `${slug}.mdx: ${field}: ${parsed.error.issues[0]?.message ?? "invalid"}`,
    );
  }
  if (parsed.data.updated < parsed.data.published) {
    throw new Error(`${slug}.mdx: updated must be >= published`);
  }
  return { slug, ...parsed.data, Content: mod.default };
}

const allPosts: BlogPost[] = Object.entries(mdxModules).map(([path, mod]) =>
  toPost(path, mod),
);

export function selectVisible(posts: BlogPost[], isProd: boolean): BlogPost[] {
  const visible = isProd ? posts.filter((p) => !p.draft) : posts;
  return [...visible].sort((a, b) =>
    a.published < b.published ? 1 : a.published > b.published ? -1 : 0,
  );
}

export function getAllPosts(isProd: boolean): BlogPost[] {
  return selectVisible(allPosts, isProd);
}

export function getPost(slug: string): BlogPost | undefined {
  return allPosts.find((p) => p.slug === slug);
}

export function visibleSlugs(isProd: boolean): string[] {
  return getAllPosts(isProd).map((p) => p.slug);
}
