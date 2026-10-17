import { createServerFn } from '@tanstack/react-start'
import { getSessionUser, updateSettings } from '#/server/auth.fns'

/**
 * Client-safe bridge for route guards and onboarding mutations.
 *
 * `#/server/auth.fns` also exports plain server helpers (requireUser) that pull
 * server-only imports, so importing that module from a route file (client graph)
 * fails the build's import protection. This module exports nothing but server
 * fns, so the compiler strips its server imports from the client bundle.
 */
export const getViewer = createServerFn({ method: 'GET' }).handler(async () => {
  return getSessionUser()
})

export const saveSettings = createServerFn({ method: 'POST' })
  .validator((d: { unitSystem?: 'metric' | 'imperial' }) => d)
  .handler(async ({ data }) => {
    return updateSettings({ data })
  })
