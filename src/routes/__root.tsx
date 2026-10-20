import { TanStackDevtools } from "@tanstack/react-devtools";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import {
  HeadContent,
  Scripts,
  createRootRoute,
  useMatches,
} from "@tanstack/react-router";
import { Footer } from "#/components/footer";
import { Header } from "#/components/header";

import { THEME_COLORS, themeBootstrapScript } from "#/lib/theme";
import appCss from "#/styles.css?url";

// Self-hosted, declared in styles.css @font-face; preloaded so first paint rarely needs the fallback faces.
const FONT_PRELOADS = [
  "/fonts/instrument-serif-latin.woff2",
  "/fonts/inter-latin-var.woff2",
];

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "physlane · adaptive TDEE for lifters",
      },
      {
        name: "description",
        content:
          "Body-recomposition tracker for lifters. Two numbers a day, adaptive TDEE from your own data.",
      },
      {
        name: "color-scheme",
        content: "light dark",
      },
      {
        name: "theme-color",
        content: THEME_COLORS.light,
      },
    ],
    links: [
      {
        rel: "icon",
        type: "image/svg+xml",
        href: "/favicon.svg",
      },
      ...FONT_PRELOADS.map((href) => ({
        rel: "preload",
        href,
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous" as const,
      })),
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  const appChrome = useMatches({
    select: (ms) => ms.every((m) => m.staticData.appChrome !== false),
  });
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
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
        {appChrome && <Header />}
        {children}
        {appChrome && <Footer />}
        {import.meta.env.DEV && (
          <TanStackDevtools
            config={{
              position: "bottom-right",
            }}
            plugins={[
              {
                name: "Tanstack Router",
                render: <TanStackRouterDevtoolsPanel />,
              },
            ]}
          />
        )}
        <Scripts />
      </body>
    </html>
  );
}
