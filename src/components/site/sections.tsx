import type { ComponentProps, ReactNode } from 'react'

/** WebP widths exported for every illustration in public/art (masters: design/art/masters). */
const ART_WIDTHS = [768, 1536]

/**
 * CSS width of a half-column `.art-panel` (home people, PageHero) in site.css:
 * desktop column = (wrap - 2 * 5.5vw margin - gap) / 2 ≈ 42vw, wrap max 1440px;
 * at <=1100px one column, 100vw - 11vw margins, capped at 768px.
 */
export const ART_PANEL_SIZES = '(max-width: 1100px) min(89vw, 768px), min(42vw, 600px)'

/**
 * Illustration (DESIGN.md §5) as a responsive WebP: /art/<name>-<w>.webp.
 * `sizes` must match the CSS width of the slot it sits in. Lazy by default;
 * pass loading="eager" (and fetchPriority) for art above the fold.
 */
export function ArtImage({
  name,
  sizes,
  ...img
}: { name: string; sizes: string; alt: string } & Omit<ComponentProps<'img'>, 'src' | 'srcSet'>) {
  return (
    <img
      src={`/art/${name}-1536.webp`}
      srcSet={ART_WIDTHS.map((w) => `/art/${name}-${w}.webp ${w}w`).join(', ')}
      sizes={sizes}
      width={1536}
      height={1024}
      loading="lazy"
      decoding="async"
      {...img}
    />
  )
}

/** Page hero (DESIGN.md §6.1): copy column on the left, figure on the right. */
export function PageHero({
  eyebrow,
  title,
  sub,
  actions,
  art,
  figure,
}: {
  eyebrow: string
  title: ReactNode
  sub: ReactNode
  actions: ReactNode
  /** Illustration above the figure; the figure overlaps its lower edge (§5.3). */
  art?: ReactNode
  figure?: ReactNode
}) {
  return (
    <div className="wrap hero page-hero">
      <div className="hero-copy">
        <p className="site-label">{eyebrow}</p>
        <h1 className="display-xl">{title}</h1>
        <p className="body-lg">{sub}</p>
        <div className="actions">{actions}</div>
      </div>
      <div className="hero-figure">
        {art && <figure className="art-panel">{art}</figure>}
        {/* Wrapper takes the overlap offset, so figures with inline margins still overlap. */}
        {figure && <div>{figure}</div>}
      </div>
    </div>
  )
}

export type StepItem = { icon: ReactNode; title: string; body: ReactNode }

/**
 * Numbered 01/02/03 row. `flow` draws arrows between items; turn it off when
 * the items are not a sequence.
 */
export function Steps({ label, items, flow = true }: { label: string; items: StepItem[]; flow?: boolean }) {
  return (
    <ol className={flow ? 'steps' : 'steps no-flow'} aria-label={label}>
      {items.map((item, i) => (
        <li className="step" key={item.title}>
          <span className="n">{String(i + 1).padStart(2, '0')}</span>
          {item.icon}
          <div>
            <h3>{item.title}</h3>
            <p className="body-md">{item.body}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

/** Ruled row of key figures with a caption below. */
export function Facts({ items, note }: { items: [value: string, text: string][]; note: string }) {
  return (
    <section className="wrap" style={{ padding: 'var(--space-section) var(--page-margin)' }} aria-label="Key figures">
      <dl className="trio">
        {items.map(([value, text]) => (
          <div key={value}>
            <dt className="metric-md site-num">{value}</dt>
            <dd className="body-sm">{text}</dd>
          </div>
        ))}
      </dl>
      <p className="caption" style={{ marginTop: 'var(--space-5)' }}>
        {note}
      </p>
    </section>
  )
}

/** Page closer: display h2 with a red second line, then copy and a CTA. */
export function Closer({
  id,
  lead,
  accent,
  children,
}: {
  id?: string
  lead: ReactNode
  accent: ReactNode
  children: ReactNode
}) {
  return (
    <section className="wrap closer" id={id}>
      <h2 className="display-md">
        {lead}
        <br />
        <span className="em">{accent}</span>
      </h2>
      <div>{children}</div>
    </section>
  )
}
