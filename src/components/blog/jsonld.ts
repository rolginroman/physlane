import type { BlogPost } from "#/lib/blog";
import { ogImageForPost } from "#/lib/blog/og";
import { SITE_URL } from "#/lib/seo";

export function blogPostingJsonLd(post: BlogPost) {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.published,
    dateModified: post.updated,
    image: ogImageForPost(post),
    author: {
      "@type": "Person",
      name: "physlane team",
      url: "https://physlane.unpackit.top/about",
    },
    publisher: {
      "@type": "Organization",
      name: "physlane",
    },
    mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
  };
}
