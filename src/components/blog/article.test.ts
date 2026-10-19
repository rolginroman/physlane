import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { createMemoryHistory, createRootRoute, createRouter, RouterProvider } from '@tanstack/react-router'
import { describe, expect, it } from 'vitest'
import { getPost } from '#/lib/blog'
import { SITE_URL } from '#/lib/seo'
import ArticleBody, { resolvePost } from './ArticleBody'
import { blogPostingJsonLd } from './jsonld'

describe('blogPostingJsonLd', () => {
  it('matches fixture post fields and URLs', () => {
    const post = getPost('what-is-tdee')
    expect(post).toBeDefined()
    const jsonLd = blogPostingJsonLd(post!)

    expect(jsonLd.dateModified).toBe(post!.updated)
    expect(jsonLd.author).toEqual({
      '@type': 'Person',
      name: 'physlane team',
      url: 'https://physlane.unpackit.top/about',
    })
    expect(jsonLd.publisher).toEqual({ '@type': 'Organization', name: 'physlane' })
    expect(jsonLd.mainEntityOfPage).toBe(`${SITE_URL}/blog/what-is-tdee`)
  })
})

describe('ArticleBody SSR smoke', () => {
  it('renders title, dates, footnote link, and chart wrapper', async () => {
    const post = getPost('what-is-tdee')
    expect(post).toBeDefined()

    const rootRoute = createRootRoute({
      component: () => createElement(ArticleBody, { post: post! }),
    })
    const router = createRouter({
      routeTree: rootRoute,
      history: createMemoryHistory({ initialEntries: ['/'] }),
    })
    await router.load()

    const html = renderToString(createElement(RouterProvider, { router }))

    expect(html).toContain(post!.title)
    expect(html).toContain('Updated')
    expect(html).toMatch(/user-content-fn/)
    expect(html).toContain('blog-chart')
  })
})

describe('resolvePost', () => {
  it('returns undefined for unknown slugs', () => {
    expect(resolvePost('nonexistent')).toBeUndefined()
  })
})
