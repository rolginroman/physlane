import { createRouter as createTanStackRouter, Link } from '@tanstack/react-router'
import { routeTree } from './routeTree.gen'

function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-col items-start px-4 pt-16">
      <h1 className="m-0 text-xl font-semibold tracking-tight">This page does not exist.</h1>
      <Link
        to="/"
        className="mt-4 inline-flex min-h-11 items-center rounded-lg border border-line px-4 text-sm font-medium text-dim hover:text-text"
      >
        Home
      </Link>
    </main>
  )
}

export function getRouter() {
  const router = createTanStackRouter({
    routeTree,
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    defaultNotFoundComponent: NotFound,
  })

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
  interface StaticDataRouteOption {
    /** Set false on routes that render their own shell (no app Header/Footer). Any matched route can opt out. */
    appChrome?: boolean
  }
}
