import { SITE_URL } from '../seo'

export function shortHash(input: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0').slice(0, 8)
}

export function ogUrl(path: string, version: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`
  return `${SITE_URL}${normalized}?v=${version}`
}

export function ogImageForPost(p: { slug: string; updated: string; ogImage?: string }): string {
  const version = shortHash(p.updated)
  if (p.ogImage) {
    return ogUrl(p.ogImage, version)
  }
  return ogUrl(`/og/blog/${p.slug}.png`, version)
}
