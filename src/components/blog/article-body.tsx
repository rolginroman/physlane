import SiteShell from "#/components/site/site-shell";
import { getPost, type BlogPost } from "#/lib/blog/posts";
import Chart from "./chart";

const categoryLabel: Record<BlogPost["category"], string> = {
  training: "Training",
  nutrition: "Nutrition",
  health: "Health",
};

export function resolvePost(slug: string): BlogPost | undefined {
  return getPost(slug);
}

export default function ArticleBody({ post }: { post: BlogPost }) {
  const showPublished = post.updated !== post.published;

  return (
    <SiteShell>
      <div className="wrap article">
        <header className="article-head">
          <p className="site-label">{categoryLabel[post.category]}</p>
          <h1 className="display-xl">{post.title}</h1>
          <p className="body-lg">{post.description}</p>
          <p className="blog-meta caption">
            Updated <time dateTime={post.updated}>{post.updated}</time>
            {showPublished ? (
              <>
                {" · Published "}
                <time dateTime={post.published}>{post.published}</time>
              </>
            ) : null}
          </p>
          {post.hero ? (
            <img
              className="blog-hero"
              src={post.hero}
              alt={post.heroAlt ?? ""}
              loading="eager"
              fetchPriority="high"
            />
          ) : null}
        </header>

        <div className="article-body prose blog-body">
          <post.Content components={{ Chart }} />
        </div>
      </div>
    </SiteShell>
  );
}
