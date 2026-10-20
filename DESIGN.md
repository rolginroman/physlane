# Physlane Design Language System v2

## Persistent Brand, UI, Illustration & Responsive Design Specification

**Version:** 2.0  
**Product:** Physlane  
**Scope:** Marketing website, web application, mobile-responsive experience, dashboards, charts, onboarding, and future product surfaces.

> **Status:** Source of truth as of 2026-10-19. It supersedes the earlier dark-only "gym-web slate + emerald" design system. Where `PRODUCT.md`, `README.md`, or existing code disagree with this document, this document wins. Appendix A records contrast-validated token adjustments (applied under §3.2's accessibility precedence clause). Appendix B tracks implementation status.

---

# 1. Role and operating principles

Act as a senior product designer, design-system architect, visual art director, and frontend UX specialist.

Design and evolve Physlane as one coherent product. Treat this document as the persistent source of truth for its visual identity, interaction patterns, responsive behavior, and component architecture.

Do not reinvent the visual language for each new request. Extend existing patterns and tokens, and introduce new patterns only when they solve a clear product or usability problem.

The design language must work consistently across:

- Marketing website and landing pages.
- Desktop and tablet layouts.
- Mobile web experiences.
- Product dashboards and data-entry forms.
- Light and dark themes.
- Product illustrations, feature graphics, and onboarding.
- Empty, loading, error, and success states.

**Core principle: one identity, two themes, every screen size.**

## 1.1 Product positioning

Physlane helps people understand their body's energy expenditure using their own weight and calorie-intake data.

Its differentiator is simple: instead of relying only on generic calorie calculators, Physlane estimates personal daily energy expenditure from observed trends.

Core brand message:

**“Calorie apps guess. This one measures.”**

Supporting message:

“Log your weight and daily calories. Get a personalized estimate of your actual burn rate — from your own data.”

The experience should communicate:

- Personal measurement over generic assumptions.
- Simple daily inputs that lead to useful insights.
- Transparent estimation rather than false precision.
- Performance and body awareness without aggressive diet culture.
- User control, privacy, and a clear relationship between inputs and results.

The audience includes general weight-management users, gym-goers, strength-training enthusiasts, people interested in body composition, and users who dislike the friction of conventional calorie-tracking apps.

Do not position Physlane exclusively as a bodybuilding app, a women's wellness app, or a medical product.

## 1.2 Brand personality

- Intelligent and measured.
- Strong, confident, and understated.
- Editorial and design-conscious.
- Analytical but approachable.
- Performance-oriented, not intimidating.
- Human without being cute.
- Premium without feeling exclusive.

The visual metaphor is **a refined measurement instrument art-directed like a contemporary editorial publication**.

---

# 2. Core visual identity

Blend three pillars:

### A. Editorial minimalism

Large, expressive serif headlines; clean sans-serif interface typography; asymmetric compositions; generous whitespace; decisive hierarchy.

### B. Illustrated athletic energy

Stylized adult athletes, controlled shadows, geometric shapes, cropped compositions, print-like textures, and purposeful movement.

### C. Precision analytics

Clear data visualizations, considered numerical hierarchy, thin grids, well-structured dashboard cards, and restrained technical details.

The illustration creates emotion and recognizability. Typography creates the editorial identity. The product UI proves the value.

Never let decoration obscure the product's actual promise or daily logging experience.

## 2.1 Visual balance

Use the following as a qualitative guide:

- Editorial layout and typography: dominant.
- Athletic illustration: distinctive supporting element.
- Product analytics: highly visible and functional.

The relative balance may change by context:

- Marketing hero: illustration and headline establish the identity.
- Product dashboard: data and controls dominate; illustration is minimal or absent.
- Mobile logging: input speed and legibility dominate.
- Onboarding: illustration may be more prominent if it helps explain a concept.

## 2.2 Avoid

Do not use:

- Photorealistic people, stock fitness photography, or realistic 3D human renders.
- Cute, whimsical, childish, or overly soft wellness aesthetics.
- Excessive botanical decoration, pastel gradients, or lifestyle imagery.
- Aggressive bodybuilding clichés, flames, skulls, and exaggerated gym tropes.
- Neon gaming aesthetics, glowing borders, or rainbow gradients.
- Generic purple-blue SaaS styling.
- Excessive glassmorphism, floating pills, or rounded-card overload.
- Overly dense trading-terminal dashboards.
- Calorie-shaming, guilt, body comparison, or guaranteed transformation messaging.

---

# 3. Color architecture

Physlane has two fully designed themes: **Light Editorial** and **Dark Performance**.

Both themes use the same semantic token names and component architecture. They are alternate expressions of the same brand, not separate design systems.

Light Editorial is the primary marketing direction. Dark Performance is a fully supported alternative for users who prefer dark interfaces, for the dark landing-page concept, and for future product surfaces.

Do not treat dark mode as a simple inversion of the light theme. Re-art-direct all surfaces, illustrations, charts, borders, and shadows for each theme.

## 3.1 Light Editorial palette

| Token            | Value     | Purpose                            |
| ---------------- | --------- | ---------------------------------- |
| `canvas`         | `#F7F4EE` | Main page background               |
| `surface`        | `#FFFEFC` | Cards and primary surfaces         |
| `surface-muted`  | `#EEEAE2` | Subtle alternate sections          |
| `surface-raised` | `#FFFFFF` | High-clarity overlay surfaces      |
| `ink`            | `#171717` | Main text and headlines            |
| `text-secondary` | `#62615E` | Body text and descriptions         |
| `text-muted`     | `#898781` | Captions and metadata              |
| `border`         | `#E3DED5` | Dividers and card outlines         |
| `brand`          | `#D92F28` | Primary action and brand emphasis  |
| `brand-hover`    | `#B92520` | Hover and pressed states           |
| `brand-soft`     | `#F5DCD7` | Subtle highlights and chart ranges |
| `chart-grid`     | `#E7E2D9` | Chart grid lines                   |
| `chart-neutral`  | `#777773` | Secondary data series              |
| `data-positive`  | `#426C56` | Contextual positive indicators     |
| `focus-ring`     | `#345B9A` | Visible keyboard focus             |

## 3.2 Dark Performance palette

| Token            | Value     | Purpose                           |
| ---------------- | --------- | --------------------------------- |
| `canvas`         | `#101112` | Main dark background              |
| `surface`        | `#171819` | Cards and primary surfaces        |
| `surface-muted`  | `#1E2021` | Secondary sections                |
| `surface-raised` | `#242526` | Overlays and elevated surfaces    |
| `ink`            | `#F4F1EA` | Main text and headlines           |
| `text-secondary` | `#B6B3AD` | Body text and descriptions        |
| `text-muted`     | `#8D8A84` | Captions and metadata             |
| `border`         | `#343332` | Dividers and card outlines        |
| `brand`          | `#E63A33` | Primary action and brand emphasis |
| `brand-hover`    | `#F04A42` | Hover and pressed states          |
| `brand-soft`     | `#482321` | Subtle red-tinted surfaces        |
| `chart-grid`     | `#343332` | Chart grid lines                  |
| `chart-neutral`  | `#AAA79F` | Secondary data series             |
| `data-positive`  | `#8DB69A` | Contextual positive indicators    |
| `focus-ring`     | `#A8C7FF` | Visible keyboard focus            |

These values are canonical starting tokens. Validate text, button, chart, and focus contrast before production. Accessibility requirements take precedence over exact decorative color values.

## 3.3 Shared color rules

- Red is the signature brand accent in both themes.
- Reserve red for primary actions, headline emphasis, selected states, and meaningful chart highlights.
- Keep most dashboard surfaces neutral.
- Never use red by default to imply that weight change is a personal failure.
- Green indicates a contextual state only when its meaning is explicitly defined.
- Never depend on color alone to explain a chart or status.
- Use borders and tonal differences to separate surfaces; do not add shadows to every card.
- Avoid introducing new accent colors without a documented purpose.
- Maintain clear contrast for text, controls, charts, and focus indicators.

## 3.4 Theme behavior

Use semantic tokens throughout the interface. Components must not contain unrelated, scattered light- and dark-mode hex values.

When the product supports user-selected themes:

- Support Light, Dark, and System preferences as appropriate.
- Respect the system preference by default unless product requirements specify otherwise.
- Persist the user's theme selection.
- Avoid a flash of the wrong theme during initial loading.
- Keep component layout, hierarchy, spacing, and interaction behavior consistent between themes.
- Adapt shadows, texture, illustration contrast, chart colors, and borders independently for each theme.

Do not simulate dark mode with a CSS filter or invert the entire page.

---

# 4. Typography system

Typography is a defining brand asset.

## 4.1 Display typography

Use a high-contrast editorial serif for hero headlines and selected major section headings.

Preferred starting font: **Instrument Serif**.  
Alternatives: DM Serif Display or an equivalent high-quality editorial serif.

Characteristics:

- Large scale and confident line breaks.
- Tight but readable leading.
- Strong contrast between thick and thin strokes.
- Minimal use of decorative effects.
- Selective red emphasis on the defining word or phrase.

Hero example:

“Calorie apps guess.  
This one **measures.**”

Use near-black in the light theme and warm white in the dark theme, keeping the emphasized word in the brand-red family.

Do not use the display serif for all interface elements. Its scarcity is part of its impact.

## 4.2 Interface typography

Use Inter or Manrope for:

- Body copy.
- Navigation.
- Buttons.
- Inputs and controls.
- Dashboard labels.
- Charts and tables.
- Tooltips and data explanations.

Use clear, stable numeric forms for weights, calorie values, percentages, dates, and measurement units.

## 4.3 Type tokens

Define reusable tokens for:

- `display-xl`, `display-lg`, `display-md`
- `heading-xl`, `heading-lg`, `heading-md`
- `card-title`
- `body-lg`, `body-md`, `body-sm`
- `label`, `caption`
- `metric-xl`, `metric-lg`, `metric-md`

Document font family, size, weight, line height, letter spacing, and responsive behavior for each token.

Avoid arbitrary font sizes and cramped text. Always prioritize readability over matching a static mockup exactly.

---

# 5. Athletic illustration language

Illustration is a core signature, not generic decoration.

## 5.1 Style definition

Use a **stylized editorial illustration with vector-led shapes, dimensional shading, and subtle screen-print or graphic-novel influences**.

The desired result sits between flat vector art and painterly editorial illustration:

- Clearly illustrated, never photographic.
- Strong, recognizable silhouettes.
- Intentional anatomy and simplified muscular planes.
- Angular shadow shapes and controlled highlights.
- Confident contours and deliberate linework.
- Restrained grain and print texture.
- Limited tonal variation.
- Graphic backgrounds built from geometric planes and measurement motifs.

Aim for sophisticated visual storytelling rather than cartoon characters or hyperreal digital paintings.

Do not let high-frequency texture or excessive anatomical detail make the illustration resemble a photograph.

## 5.2 Subjects and representation

The identity must be appealing to men, women, strength-training enthusiasts, and everyday weight-management users.

- Illustrate adults with believable, varied body types.
- Use athletic or muscular figures where appropriate without making extreme physiques the default.
- Include men and women naturally across the full experience.
- Use poses that suggest strength, composure, movement, focus, or self-awareness.
- Avoid gender-coded color schemes.
- Do not imply that a particular physique is a measure of health or worth.
- Avoid overly sexualized poses and exaggerated bodybuilding stereotypes.

Figures should feel confident and aspirational without pressuring users to look a certain way.

## 5.3 Composition

For desktop marketing heroes:

- Place the headline and primary actions in a relatively calm text column.
- Anchor the illustration predominantly on the right or upper-right.
- Allow larger figures to extend past hero boundaries where compositionally appropriate.
- Use cropped poses for visual energy.
- Introduce circles, technical grid lines, graph paths, geometric shapes, and subtle tonal overlays behind figures.
- Let the dashboard partially overlap the illustration.
- Ensure the dashboard and headline remain the first two important visual anchors.

The illustration should frame the product, not obstruct it.

## 5.4 Light-theme illustration treatment

- Use charcoal, warm gray, cream, restrained skin tones, and brand red.
- Use warm off-white negative space.
- Prefer light backgrounds with subtle grain, large geometric forms, or thin technical lines.
- Keep dark anatomical forms sufficiently separated from the page background.
- Use red shapes as deliberate compositional anchors rather than decorative confetti.

## 5.5 Dark-theme illustration treatment

- Use near-black backgrounds with warm highlights and cool charcoal shadows.
- Preserve visible edges between dark clothing, skin, background, and dashboard surfaces.
- Add enough warm-gray and cream highlights to retain shape definition.
- Use red geometric backdrops, cropped circles, and measurement lines sparingly.
- Use lighter contours only where needed to preserve silhouette clarity.
- Avoid turning every edge into a neon glow.
- Keep texture visible but restrained.

The dark illustration must feel like the dark-theme version of the same artwork, not a separate cyberpunk direction.

## 5.6 Illustration consistency

Document and reuse:

- Contour style and weight.
- Shadow construction.
- Grain intensity.
- Palette limits.
- Figure proportions.
- Background geometry.
- Cropping and overlap rules.
- Illustration-to-interface contrast.

All future illustrations should clearly belong to the same visual family.

---

# 6. Layout and spacing

Use a flexible editorial grid with deliberate asymmetry.

## 6.1 Desktop marketing layout

At large viewport sizes, use a two-column hero:

- Left: eyebrow, headline, concise proposition, primary CTA, secondary action, and compact benefits.
- Right: athletic illustration with a floating analytics dashboard.
- Header: wordmark, restrained navigation, and one prominent app-access action.
- Below the hero: a three-step explanation — Log, Learn, Adjust.
- Further down: feature explanations, dashboard details, privacy information, and relevant supporting sections.

Use a maximum content width around 1,400–1,500 px and page margins around 5–6% of the viewport as starting points. Adjust to the actual viewport and content.

The headline, illustration, and dashboard must create one coherent composition instead of three unrelated visual elements.

## 6.2 Spacing tokens

Use a documented scale based on a 4- or 8-point grid:

`4, 8, 12, 16, 24, 32, 48, 64, 80, 96, 128`

Create reusable tokens for:

- Component gaps.
- Card padding.
- Section spacing.
- Page margins.
- Navigation height.
- Text-to-button spacing.
- Grid gutters.

Use a deliberate, consistent vertical rhythm. Do not solve individual layout problems by adding arbitrary one-off margins everywhere.

## 6.3 Surfaces and borders

- Moderate card rounding, typically 8–14 px.
- Fine, low-contrast borders.
- Minimal shadows.
- Slightly raised dashboard surfaces.
- Clear spacing between unrelated content groups.
- Large, expressive geometry only in marketing compositions.

Avoid using a card for every piece of content. Use whitespace and typography before adding containers.

---

# 7. Responsive design: mobile is a first-class layout

Do not simply scale down the desktop interface. The content hierarchy, illustration composition, and product interactions must adapt intentionally.

Use content-driven breakpoints, starting around:

- Mobile: below 640 px.
- Tablet: 640–1023 px.
- Desktop: 1024–1439 px.
- Wide desktop: 1440 px and above.

Adjust these to the actual project and component behavior rather than treating them as immutable device categories.

## 7.1 Desktop

Use the complete editorial hero composition:

- Spacious headline column.
- Large illustrated athletes.
- Dashboard overlapping the illustration.
- Visible navigation.
- Three compact product benefits.
- Full three-step process below the hero.

Maintain negative space around the headline and a strong visual separation between marketing copy and dashboard data.

## 7.2 Tablet

Rebalance the illustration and dashboard:

- Reduce headline scale and horizontal gaps.
- Reduce figure size or crop the composition.
- Keep enough dashboard detail to explain the product.
- Move supporting benefits into a compact row or stack.
- Prevent the illustration from pushing the primary action below the fold unnecessarily.

If a two-column layout no longer has room, transition to a vertically stacked hero rather than squeezing every element into one row.

## 7.3 Mobile marketing page

The mobile layout should be a designed composition in its own right.

Recommended order:

1. Compact header with wordmark and menu.
2. Eyebrow.
3. Headline, with controlled line breaks.
4. Short explanatory copy.
5. Prominent full-width or near-full-width primary CTA.
6. Secondary action.
7. Compact benefit row or list.
8. Illustrated composition.
9. Compact analytics preview.
10. Three-step “Log, Learn, Adjust” explanation.
11. Supporting product sections.

The order may change when testing shows a clearer way to communicate the product, but the main proposition and CTA must remain immediately visible.

### Mobile illustration behavior

- Use a dedicated mobile composition, not a cropped desktop screenshot.
- Place the athlete below, behind, or beside the hero text only when readability remains excellent.
- Prefer a strong crop, close-up silhouette, shoulder or torso detail, or contained illustration panel.
- Use limited geometric accents and red shapes.
- Reduce texture density and background detail.
- Keep faces, contours, and key shapes from colliding with the headline.
- Do not create an excessively tall hero solely to display a large illustration.

The illustration should set the mood without delaying access to the main action.

### Mobile dashboard preview

Do not compress a full desktop dashboard into an unreadable miniature.

Instead:

- Show one primary chart or one principal metric.
- Use a single large weight-trend visualization with a small estimate card, or a compact burn-rate card with a short trend.
- Keep metric labels and units legible.
- Eliminate nonessential desktop-only controls.
- Use horizontal scrolling only for content that genuinely benefits from it, not to compensate for poor responsive layout.

## 7.4 Mobile application

Treat marketing and product interaction as separate layouts within the same design language.

The application should prioritize daily logging speed and clear navigation.

Use a compact navigation model, such as:

- Overview.
- Log.
- Analytics.
- More.

Adapt labels and the number of destinations to the real information architecture. Keep the main daily action easy to reach.

### Mobile Overview

Show:

- Estimated daily burn.
- Current weight or recent weight trend.
- A concise progress summary.
- A direct entry point to today's log.

Avoid making the user scroll through a long marketing-style section before reaching important data.

### Mobile Log

- Place weight and calorie inputs near the top.
- Use numeric keyboards and appropriate input modes.
- Minimize unnecessary fields and steps.
- Group optional measurements separately.
- Use clear units.
- Keep the save action visible and accessible.
- Provide clear validation, saving, and saved states.
- Never make the form depend on hover.

### Mobile Analytics

- Prioritize one chart at a time.
- Use readable axes, labels, and touch targets.
- Allow understandable period selection.
- Use concise summaries to supplement visual charts.
- Support scrolling and accessible alternatives for complex charts.

## 7.5 General responsive rules

- Prevent horizontal overflow.
- Do not reduce body text to make a layout fit.
- Maintain comfortable touch targets, ideally around 44 × 44 CSS pixels or larger.
- Keep focus states visible at every breakpoint.
- Respect safe-area insets on modern mobile devices.
- Handle browser zoom and user font-size preferences.
- Respect reduced-motion settings.
- Test narrow devices, landscape layouts, and long translated strings.
- Never let decorative artwork overlap essential controls or make text illegible.

---

# 8. Analytics UI and data visualization

The application dashboard must be visually related to the marketing page while prioritizing function over illustration.

## 8.1 Dashboard surfaces

- Neutral cards appropriate to the active theme.
- Fine borders and minimal shadows.
- Moderate corner rounding.
- Consistent internal padding.
- Clear separation of metrics, labels, and explanations.
- No excessive glass effects or gradient backgrounds.

## 8.2 Core reusable components

Define reusable components for:

- Weight-trend chart.
- Estimated daily burn metric.
- Daily calorie intake.
- Daily logging form.
- Measurement history.
- Date-range selection.
- Summary statistics.
- Trend explanation.
- Confidence or uncertainty disclosure.
- Empty, loading, error, and success states.

## 8.3 Chart styling

Charts should be accurate, restrained, and readable.

- Use dark neutral series and brand red as a selective highlight.
- Apply thin grid lines appropriate to the theme.
- Make axes and labels legible.
- Use simple data points and direct labels where useful.
- Avoid 3D effects, ornamental gradients, and unnecessary legends.
- Distinguish lines using markers, labels, or patterns as well as color.
- Ensure charts remain understandable on narrow screens.

When presenting calorie-burn estimates, explicitly distinguish estimates from directly measured values. Do not invent statistical confidence, precision, or medical certainty. Example values in mockups are illustrative placeholders, not promises about actual users.

---

# 9. Components and interaction rules

Build a coherent reusable system for:

- Header and navigation.
- Footer.
- Primary and secondary buttons.
- Text links.
- Benefit rows.
- Hero sections.
- Illustration panels.
- Metric cards.
- Chart cards.
- Form fields.
- Number inputs.
- Date selectors.
- Tabs and segmented controls.
- Tooltips and explanations.
- Feature sections.
- Onboarding prompts.
- Empty and error states.

## 9.1 Buttons

### Primary

- Brand red background.
- White, sufficiently contrasted label.
- Clear text and optional arrow.
- Moderate corner radius.
- Comfortable vertical and horizontal padding.
- Visible hover, active, focus, loading, and disabled states.

### Secondary

- Transparent, canvas, or surface background.
- Near-black or theme-appropriate text.
- Minimal border or understated underline.
- Never compete with the primary CTA.

Do not use different button visual languages in separate parts of the product without a functional reason.

## 9.2 Interaction and motion

Use subtle and purposeful motion:

- Short transitions.
- Restrained chart animation.
- Clear tab and selected states.
- Quiet navigation feedback.
- Subtle illustration movement only when it improves comprehension or adds an intentional moment of delight.

Avoid bouncing elements, distracting loops, and constantly moving decorative backgrounds.

Every interactive control must have a meaningful action. Respect reduced-motion preferences.

---

# 10. Copywriting system

Physlane should sound confident, knowledgeable, direct, and honest.

Prefer:

- Short sentences.
- Active voice.
- Specific explanations.
- Clear units and numerical terms.
- Transparent language about estimates.
- Calm, nonjudgmental descriptions of weight trends.

Approved core messaging:

- “Calorie apps guess. This one measures.”
- “Your weight and daily calories. Your estimated burn rate.”
- “Simple inputs. Real insights.”
- “Track the trend, not one day.”
- “Log. Learn. Adjust.”

Avoid:

- “Crush your goals.”
- “No excuses.”
- “Burn fat faster.”
- Guaranteed weight-loss outcomes.
- Shame, guilt, or fear.
- Misleading scientific claims.
- Copy that implies users must have a certain physique to succeed.

Short UI copy should explain the feature or action without unnecessary marketing language.

---

# 11. Accessibility and usability

All themes and breakpoints must satisfy accessibility requirements.

- Use suitable text contrast.
- Provide visible keyboard focus.
- Use semantic heading hierarchy.
- Associate labels with form controls.
- Provide accessible error messages.
- Never rely on color alone to communicate meaning.
- Provide chart summaries or tabular alternatives.
- Support keyboard navigation.
- Respect reduced-motion preferences.
- Ensure illustrated backgrounds never interfere with readable content.
- Make interactive targets usable by touch.
- Maintain readability at browser zoom and increased text size.

Where aesthetics and accessibility conflict, preserve usability and improve the visual solution.

---

# 12. Design tokens and implementation

Store reusable tokens in centralized definitions, not scattered hardcoded values.

Document:

- Color and semantic theme tokens.
- Typography.
- Font weights and line heights.
- Spacing and grid.
- Widths and breakpoints.
- Radius and borders.
- Shadows.
- Z-index layers.
- Motion.
- Chart colors and styles.
- Illustration palette and treatment.
- Responsive component variants.

Suggested semantic variables:

`--color-canvas`  
`--color-surface`  
`--color-surface-raised`  
`--color-ink`  
`--color-text-secondary`  
`--color-text-muted`  
`--color-border`  
`--color-brand`  
`--color-brand-hover`  
`--color-chart-grid`  
`--font-display`  
`--font-body`  
`--space-section`  
`--radius-card`

Theme-specific values should map to shared semantic names. Components should consume the same tokens in both themes.

Create shared components with documented props, responsive behavior, interaction states, and accessibility expectations. Do not fork components unnecessarily just to support a different theme.

---

# 13. Maintaining the system over time

For every new page, screen, component, or illustration:

1. Reuse existing tokens and components first.
2. Preserve the typography, color, and illustration identity.
3. Verify the composition in both light and dark themes.
4. Design mobile behavior deliberately, not as an afterthought.
5. Keep data legible and actions obvious.
6. Ensure illustrative figures remain stylized, not photorealistic.
7. Check contrast and accessibility.
8. Document new patterns and why they are needed.
9. Avoid adding new colors, typefaces, or effects without a clear reason.
10. Check the result beside existing Physlane screens for visual consistency.

When a new requirement conflicts with the system, identify the conflict and solve it with the smallest reasonable extension rather than replacing the system wholesale.

---

# 14. Required design-system deliverables

Create and maintain:

1. Brand principles and positioning.
2. Light and dark semantic color tokens.
3. Typography scale and usage rules.
4. Spacing, grid, radius, border, shadow, and motion tokens.
5. Illustration art direction, examples, and prohibited treatments.
6. Desktop, tablet, and mobile layout rules.
7. Component library with interaction and accessibility states.
8. Dashboard and chart standards.
9. Copywriting guidelines.
10. Responsive marketing hero examples.
11. Mobile Overview, Log, and Analytics examples.
12. Light/dark comparisons using matching content.
13. Implementation-ready token definitions.
14. A quality-control checklist.

Deliver examples with consistent content across both themes, so differences in theme styling can be evaluated without confusing them with layout changes.

---

# 15. Final quality gate

Before presenting any new design, ask:

- Does it clearly look like Physlane?
- Does it combine editorial typography, stylized athletic energy, and precise analytics?
- Does it appeal to lifters and general weight-management users?
- Does the main proposition become clear within a few seconds?
- Does the artwork look deliberately illustrated rather than photographic?
- Are the dashboard metrics easy to interpret?
- Does the design work in both light and dark themes?
- Is mobile a genuine composition rather than a reduced desktop screenshot?
- Can users log their data quickly on a phone?
- Is the UI accessible and honest about estimated results?
- Could this screen sit beside other Physlane screens without looking like a different product?

Revise any output that fails these criteria.

## Governing principle

**One identity. Two themes. Every screen size. Illustrated athletic energy, editorial restraint, and data you can understand.**

---

# Appendix A. Contrast validation (2026-10-19)

WCAG 2.x contrast ratios of the canonical tokens from §3.1 and §3.2. AA requires 4.5:1 for normal text and 3:1 for large text (≥24px, or ≥18.66px bold) and UI components. Under §3.2, accessibility takes precedence. The adjustments below are the smallest changes that pass.

| Pair                                               | Ratio                  | Result                        | Resolution                                                                                                                       |
| -------------------------------------------------- | ---------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Light: white on `brand` (primary button)           | 4.79                   | Pass                          | None                                                                                                                             |
| Light: `brand` as text on `canvas`                 | 4.36                   | Fails for small text          | Use red text at display or large sizes only. Small red text uses `brand-hover` `#B92520` (5.71)                                  |
| Light: `text-muted` `#898781` on `canvas`          | 3.27                   | Fails for normal text         | **`text-muted` → `#6B6964`** (4.99 on `canvas`, 4.57 on `surface-muted`)                                                         |
| Light: `text-secondary` on `canvas`                | 5.64                   | Pass                          | None                                                                                                                             |
| Light: `data-positive` on `canvas`                 | 5.45                   | Pass                          | None                                                                                                                             |
| Light: `focus-ring` on `canvas`                    | 6.15                   | Pass                          | None                                                                                                                             |
| Dark: white on `brand` `#E63A33` (primary button)  | 4.19                   | Fails                         | **Dark primary button label = `canvas` `#101112`** (4.52 on `brand`, 5.19 on `brand-hover`). White on `brand-hover` is only 3.64 |
| Dark: `brand` as text on `canvas`                  | 4.52                   | Pass                          | None                                                                                                                             |
| Dark: `text-muted` on `canvas` / `surface-raised`  | 5.49 / 4.46            | Borderline on raised surfaces | Do not set body-size muted text on `surface-raised`                                                                              |
| Dark: `focus-ring` on `canvas`                     | 11.05                  | Pass                          | None                                                                                                                             |
| `border`, `chart-grid` vs background (both themes) | 1.22 to 1.50           | Decorative only               | Never let a border or grid line carry meaning alone, such as a target-range edge                                                 |
| `brand` vs `data-positive` (red vs green)          | 1.25 light / 1.85 dark | Nearly the same lightness     | Red/green states are indistinguishable under deuteranopia. Always pair them with a sign, icon, or label (§3.3, §11)              |

Consequence for §9.1: in Dark Performance, the primary button label is `canvas`, not white. Every other §9.1 rule stands.

# Appendix B. Implementation status

This document describes the target system. As of 2026-10-19, the shipped code still implements the superseded v1 system. That system is a single dark slate theme with an emerald `#34d399` accent and Geist plus JetBrains Mono. Its tokens are in `src/styles.css`. Hex values are also hardcoded in `src/components/TrendChart.tsx` and `src/routes/__root.tsx`. Migration to v2 tokens, the Light/Dark/System theme switch, the editorial typography, and the illustration set is pending. Treat any v1 styling found in code as legacy to replace, not as precedent to extend.
