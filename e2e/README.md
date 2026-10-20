# @physlane/e2e

End-to-end checks for the MCP server at `POST /mcp` (protocol `2026-07-28`
only). The package talks to the server over HTTP exactly like a foreign AI host.

## Run

```sh
pnpm e2e                                   # spawns its own dev server on :3100
E2E_PORT=3200 pnpm e2e                     # other port
E2E_BASE_URL=http://localhost:3100 pnpm e2e  # test an already-running server
```

| Variable       | Default            | Meaning                         |
| -------------- | ------------------ | ------------------------------- |
| `E2E_BASE_URL` | unset              | Test this server, spawn nothing |
| `E2E_PORT`     | `3100`             | Port for the spawned dev server |
| `E2E_PASSWORD` | `e2e-Password123!` | Password of the fresh test user |

## Boundaries

- **HTTP only.** Never import app source (no `#/` aliases, no `../src`). No
  runtime dependencies: `fetch` only.
- **Owns its process.** Without `E2E_BASE_URL`, global setup spawns
  `pnpm dev --port $E2E_PORT --strictPort` as a detached process group and
  kills the whole group (negative pid) at teardown. A server it did not spawn
  is never killed.
- **Identity-checked readiness.** The probe polls
  `GET /.well-known/oauth-protected-resource` until
  `authorization_servers[0]` has the same origin as the base URL. A foreign app
  on the port fails the probe, not the tests.
- **Stateless.** Every run signs up a fresh random user through the app's
  sign-up endpoint.
- **No database access.** Persistence is asserted through read tools
  (`get_history`) only. Never shell out to wrangler.

## Layout

- `src/env.ts` env vars
- `src/harness.ts` server lifecycle, fresh-user signup, fetch helper
- `src/oauth.ts` DCR + PKCE S256 + sign-in/consent (or consent-skip) + token
- `src/modern-client.ts` JSON-RPC client for `2026-07-28`
- `src/discovery.spec.ts`, `src/journey.spec.ts` specs
