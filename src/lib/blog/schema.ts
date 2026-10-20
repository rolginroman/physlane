import { z } from "zod";

export const BlogFrontmatter = z.object({
  title: z.string().min(1).max(90),
  description: z.string().min(40).max(180),
  category: z.enum(["training", "nutrition", "health"]),
  published: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  hero: z.string().startsWith("/blog/").optional(),
  heroAlt: z.string().min(1).optional(),
  ogImage: z.string().startsWith("/").optional(),
  draft: z.boolean().optional().default(false),
});
export type BlogFrontmatter = z.infer<typeof BlogFrontmatter>;
export const CATEGORIES = ["training", "nutrition", "health"] as const;

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---/;

export function parseBlogFile(raw: string, filename: string): BlogFrontmatter {
  const prefix = `${filename}: `;
  const match = FRONTMATTER_RE.exec(raw);
  if (!match) {
    throw new Error(`${prefix}missing YAML frontmatter`);
  }
  const yaml = match[1];
  const lines = yaml.split(/\r?\n/);
  const data: Record<string, unknown> = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const colon = trimmed.indexOf(":");
    if (colon === -1) {
      throw new Error(`${prefix}invalid frontmatter line: ${line}`);
    }
    const key = trimmed.slice(0, colon).trim();
    let value: unknown = trimmed.slice(colon + 1).trim();
    if (value === "true") value = true;
    else if (value === "false") value = false;
    else if (
      typeof value === "string" &&
      value.startsWith('"') &&
      value.endsWith('"')
    ) {
      value = value.slice(1, -1);
    }
    data[key] = value;
  }
  const parsed = BlogFrontmatter.safeParse(data);
  if (!parsed.success) {
    const field = parsed.error.issues[0]?.path.join(".") ?? "frontmatter";
    throw new Error(
      `${prefix}${field}: ${parsed.error.issues[0]?.message ?? "invalid"}`,
    );
  }
  if (parsed.data.updated < parsed.data.published) {
    throw new Error(`${prefix}updated must be >= published`);
  }
  return parsed.data;
}
