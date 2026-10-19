import { Link } from '@tanstack/react-router'
import type { BlogPost } from '#/lib/blog'

const categoryLabel: Record<BlogPost['category'], string> = {
  training: 'Training',
  nutrition: 'Nutrition',
  health: 'Health',
}

export function listingModel(posts: BlogPost[]) {
  return posts.map((post) => ({
    href: `/blog/${post.slug}`,
    title: post.title,
    description: post.description,
    categoryLabel: categoryLabel[post.category],
    updated: post.updated,
    slug: post.slug,
  }))
}

export default function Listing({ posts }: { posts: BlogPost[] }) {
  const cards = listingModel(posts)

  if (cards.length === 0) {
    return <p className="body-md">New articles are on the way.</p>
  }

  return (
    <ul className="blog-listing">
      {cards.map((card) => (
        <li key={card.slug}>
          <Link to="/blog/$slug" params={{ slug: card.slug }} className="site-card blog-listing-card">
            <p className="site-label">{card.categoryLabel}</p>
            <h2 className="heading-lg">{card.title}</h2>
            <p className="body-md">{card.description}</p>
            <p className="blog-meta caption">
              Updated <time dateTime={card.updated}>{card.updated}</time>
            </p>
          </Link>
        </li>
      ))}
    </ul>
  )
}
