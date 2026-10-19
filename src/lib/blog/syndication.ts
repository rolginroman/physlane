import { SITE_URL } from '../seo'

export interface SyndicationPost {
  slug: string
  title: string
  description: string
  published: string
  updated: string
}

function escapeXml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function newestUpdated(posts: SyndicationPost[]): string {
  if (posts.length === 0) return todayIso()
  return posts.reduce((max, p) => (p.updated > max ? p.updated : max), posts[0].updated)
}

function urlEntry(loc: string, lastmod: string): string {
  return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
  </url>`
}

export function buildSitemapXml(posts: SyndicationPost[]): string {
  const homeLastmod = newestUpdated(posts)
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urlEntry(`${SITE_URL}/`, homeLastmod),
    urlEntry(`${SITE_URL}/blog`, homeLastmod),
    ...posts.map((p) => urlEntry(`${SITE_URL}/blog/${p.slug}`, p.updated)),
    '</urlset>',
  ]
  return `${lines.join('\n')}\n`
}

export function buildRssXml(posts: SyndicationPost[]): string {
  const channelLink = `${SITE_URL}/blog`
  const items = posts
    .map((p) => {
      const link = `${SITE_URL}/blog/${p.slug}`
      const pubDate = new Date(p.published).toUTCString()
      return `    <item>
      <title>${escapeXml(p.title)}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapeXml(p.description)}</description>
    </item>`
    })
    .join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>physlane blog</title>
    <link>${channelLink}</link>
    <description>Training, nutrition, and health articles from physlane.</description>
${items}
  </channel>
</rss>
`
}
