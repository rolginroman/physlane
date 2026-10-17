import { createServerFn } from '@tanstack/react-start'
import { applySettings, loadSessionUser, requireUser, type SettingsPatch } from '#/server/auth.core'

/**
 * Client-safe bridge for route guards and onboarding mutations.
 *
 * `#/server/auth.core` holds only plain functions (no createServerFn), so
 * composing them inside these handlers stays a direct call in the built
 * worker (calling one server fn from another compiles to an RPC round-trip
 * whose inner fn id is missing from the manifest). This module exports
 * nothing but server fns, so the compiler strips its server imports from
 * the client bundle.
 */
export const getViewer = createServerFn({ method: 'GET' }).handler(async () => {
  return loadSessionUser()
})

export const saveSettings = createServerFn({ method: 'POST' })
  .validator((d: SettingsPatch) => d)
  .handler(async ({ data }) => {
    const me = await requireUser()
    return applySettings(me, data)
  })
