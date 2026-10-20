import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import mdx from "@mdx-js/rollup";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import remarkMdxFrontmatter from "remark-mdx-frontmatter";
import rehypeSlug from "rehype-slug";

export default defineConfig({
	plugins: [
		mdx({
			include: /content\/blog\/.*\.mdx$/,
			remarkPlugins: [remarkGfm, remarkFrontmatter, remarkMdxFrontmatter],
			rehypePlugins: [rehypeSlug],
		}),
	],
	resolve: {
		alias: {
			"#": fileURLToPath(new URL("./src", import.meta.url)),
		},
	},
	test: {
		// TODO(3e): drop src/**/*.test.ts once tests move
		include: ["src/**/*.test.ts", "src/**/__tests__/**/*.test.{ts,tsx}"],
	},
});
