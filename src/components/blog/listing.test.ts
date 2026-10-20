import { createElement } from "react";
import { renderToString } from "react-dom/server";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from "@tanstack/react-router";
import { describe, expect, it } from "vitest";
import type { BlogPost } from "#/lib/blog/posts";
import Listing, { listingModel } from "./listing";

const fixture: BlogPost[] = [
  {
    slug: "newer-post",
    title: "Newer article",
    description: "Second in the list.",
    category: "nutrition",
    published: "2026-01-10",
    updated: "2026-01-15",
    draft: false,
    Content: () => null,
  },
  {
    slug: "older-post",
    title: "Older article",
    description: "First published earlier.",
    category: "training",
    published: "2025-12-01",
    updated: "2025-12-05",
    draft: false,
    Content: () => null,
  },
];

describe("listingModel", () => {
  it("maps posts to card fields with hrefs and preserved order", () => {
    const model = listingModel(fixture);

    expect(model).toHaveLength(2);
    expect(model[0]).toMatchObject({
      href: "/blog/newer-post",
      title: "Newer article",
      description: "Second in the list.",
      categoryLabel: "Nutrition",
      updated: "2026-01-15",
    });
    expect(model[1]).toMatchObject({
      href: "/blog/older-post",
      title: "Older article",
      categoryLabel: "Training",
      updated: "2025-12-05",
    });
  });
});

describe("Listing SSR smoke", () => {
  it("renders each title and Updated line", async () => {
    const rootRoute = createRootRoute({
      component: () => createElement(Listing, { posts: fixture }),
    });
    const router = createRouter({
      routeTree: rootRoute,
      history: createMemoryHistory({ initialEntries: ["/"] }),
    });
    await router.load();

    const html = renderToString(createElement(RouterProvider, { router }));

    expect(html).toContain("Newer article");
    expect(html).toContain("Older article");
    expect(html).toContain("Updated");
  });
});
