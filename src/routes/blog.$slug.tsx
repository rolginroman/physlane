import { createFileRoute, notFound } from "@tanstack/react-router";
import ArticleBody, { resolvePost } from "#/components/blog/ArticleBody";
import { blogPostingJsonLd } from "#/components/blog/jsonld";
import { ogImageForPost } from "#/lib/blog/og";
import { seoHead } from "#/lib/seo";

export const Route = createFileRoute("/blog/$slug")({
  staticData: { appChrome: false },
  beforeLoad: ({ params }) => {
    const post = resolvePost(params.slug);
    if (!post) throw notFound();
  },
  head: ({ params }) => {
    const post = resolvePost(params.slug);
    if (!post) return {};
    const title = `${post.title} · physlane`;
    return seoHead({
      title,
      description: post.description,
      path: `/blog/${params.slug}`,
      image: ogImageForPost(post),
      type: "article",
      jsonLd: blogPostingJsonLd(post),
    });
  },
  component: BlogPostPage,
});

function BlogPostPage() {
  const { slug } = Route.useParams();
  const post = resolvePost(slug);
  if (!post) throw notFound();
  return <ArticleBody post={post} />;
}
