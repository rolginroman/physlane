export const SITE_URL = "https://physlane.unpackit.top";

export interface SeoArgs {
  title: string;
  description: string;
  path: string;
  image: string;
  type?: "website" | "article";
  noindex?: boolean;
  jsonLd?: Record<string, unknown>;
}

export function seoHead(a: SeoArgs): {
  meta: Record<string, string>[];
  links: Record<string, string>[];
  scripts?: { type: "application/ld+json"; children: string }[];
} {
  const canonical = `${SITE_URL}${a.path.startsWith("/") ? a.path : `/${a.path}`}`;
  const ogType = a.type ?? "website";
  const robots = a.noindex
    ? "noindex, follow"
    : "index, follow, max-image-preview:large";

  const meta: Record<string, string>[] = [
    { title: a.title },
    { name: "description", content: a.description },
    { name: "robots", content: robots },
    { property: "og:site_name", content: "physlane" },
    { property: "og:type", content: ogType },
    { property: "og:url", content: canonical },
    { property: "og:title", content: a.title },
    { property: "og:description", content: a.description },
    { property: "og:image", content: a.image },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: a.title },
    { name: "twitter:description", content: a.description },
    { name: "twitter:image", content: a.image },
  ];

  const links: Record<string, string>[] = [
    { rel: "canonical", href: canonical },
  ];

  const scripts = a.jsonLd
    ? [
        {
          type: "application/ld+json" as const,
          children: JSON.stringify(a.jsonLd),
        },
      ]
    : undefined;

  return { meta, links, scripts };
}
