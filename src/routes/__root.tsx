import { TanStackDevtools } from '@tanstack/react-devtools'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { HeadContent, Scripts, createRootRoute, useRouterState } from '@tanstack/react-router'
import Footer from '../components/Footer'
import Header from '../components/Header'

import appCss from '../styles.css?url'

const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'physlane · adaptive TDEE for lifters',
      },
      {
        name: 'description',
        content:
          'Body-recomposition tracker for lifters. Two numbers a day, adaptive TDEE from your own data.',
      },
      {
        name: 'theme-color',
        content: '#0b0d10',
      },
    ],
    links: [
      {
        rel: 'icon',
        type: 'image/svg+xml',
        href: '/favicon.svg',
      },
      {
        rel: 'preconnect',
        href: 'https://fonts.googleapis.com',
      },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: '',
      },
      {
        rel: 'stylesheet',
        href: FONTS_HREF,
      },
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
})

/*
 * Public landing pages (variant C) ship their own shell (LandingShell) and
 * must not carry the dark app chrome. Every other route, including all
 * signed-in app surfaces, keeps Header and Footer exactly as before.
 */
const LANDING_PATHS = new Set(['/', '/guide', '/glp-1', '/analytics', '/tracking'])

function RootDocument({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const isLanding = LANDING_PATHS.has(pathname)
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Telegram WebApp SDK: inert outside Telegram (initData stays '').
          Rendered directly in the head JSX (not via head() scripts, which
          HeadContent re-appends after hydration) so it reliably executes
          before our bundle; `defer` keeps it non-blocking for the landing.
        */}
        <script src="https://telegram.org/js/telegram-web-app.js" defer />
        <HeadContent />
      </head>
      <body className="font-sans antialiased">
        {!isLanding && <Header />}
        {children}
        {!isLanding && <Footer />}
        {import.meta.env.DEV && (
          <TanStackDevtools
            config={{
              position: 'bottom-right',
            }}
            plugins={[
              {
                name: 'Tanstack Router',
                render: <TanStackRouterDevtoolsPanel />,
              },
            ]}
          />
        )}
        <Scripts />
      </body>
    </html>
  )
}
