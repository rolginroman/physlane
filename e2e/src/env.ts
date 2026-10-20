export const E2E_BASE_URL: string | undefined =
  process.env.E2E_BASE_URL?.replace(/\/$/, "") || undefined;

export const E2E_PORT = Number(process.env.E2E_PORT ?? 3100);

export const E2E_PASSWORD = process.env.E2E_PASSWORD ?? "e2e-Password123!";

/** Server under test: the external one if given, else the spawned dev server. */
export const BASE_URL = E2E_BASE_URL ?? `http://localhost:${E2E_PORT}`;
