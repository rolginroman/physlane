import { createFileRoute } from "@tanstack/react-router";
import Listing from "#/components/blog/Listing";
import SiteShell from "#/components/site/SiteShell";
import { getAllPosts } from "#/lib/blog";
import { ogUrl } from "#/lib/blog/og";
import { seoHead } from "#/lib/seo";

const DESCRIPTION =
  "Articles on training, nutrition, and health — grounded in your own numbers, not generic advice.";

export const Route = createFileRoute("/blog/")({
  staticData: { appChrome: false },
  head: () =>
    seoHead({
      title: "Blog — training, nutrition, health · physlane",
      description: DESCRIPTION,
      path: "/blog",
      image: ogUrl("/og.png", "v1"),
    }),
  component: BlogIndexPage,
});

function BlogIndexPage() {
  const posts = getAllPosts(import.meta.env.PROD);

  return (
    <SiteShell>
      <div className="wrap article">
        <header className="article-head">
          <p className="site-label">Blog</p>
          <h1 className="display-xl">Training, nutrition, and health</h1>
        </header>
        <div className="article-body">
          <Listing posts={posts} />
        </div>
      </div>
    </SiteShell>
  );
}
