import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { BASE_URL, E2E_BASE_URL, E2E_PASSWORD, E2E_PORT } from "./env";

export type HttpResult<T = unknown> = {
  status: number;
  headers: Headers;
  text: string;
  json: T;
};

/** fetch + capture status/headers; `json` is null when the body is not JSON. */
export async function fetchJson<T = unknown>(
  url: string,
  init?: RequestInit,
): Promise<HttpResult<T>> {
  const res = await fetch(url, { redirect: "manual", ...init });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    // SSE framing: take the first data line.
    const line = text.split(/\r?\n/).find((l) => l.startsWith("data: "));
    if (line) {
      try {
        json = JSON.parse(line.slice(6));
      } catch {
        json = null;
      }
    }
  }
  return { status: res.status, headers: res.headers, text, json: json as T };
}

/** Readiness = identity: the app, not just any server, owns this port. */
async function isOurApp(base: string): Promise<boolean> {
  try {
    const res = await fetch(`${base}/.well-known/oauth-protected-resource`);
    if (!res.ok) return false;
    const body = (await res.json()) as { authorization_servers?: unknown };
    const first = Array.isArray(body.authorization_servers)
      ? body.authorization_servers[0]
      : undefined;
    return (
      typeof first === "string" &&
      new URL(first).origin === new URL(base).origin
    );
  } catch {
    return false;
  }
}

async function waitReady(
  base: string,
  child: ChildProcess | null,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (child && child.exitCode !== null) {
      throw new Error(`dev server exited early (code ${child.exitCode})`);
    }
    if (await isOurApp(base)) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(
    `${base} never answered /.well-known/oauth-protected-resource with this app's identity`,
  );
}

export type DevServer = { baseUrl: string; stop: () => Promise<void> };

export async function startDevServer(): Promise<DevServer> {
  if (E2E_BASE_URL) {
    await waitReady(E2E_BASE_URL, null, 30_000);
    return { baseUrl: E2E_BASE_URL, stop: async () => {} };
  }

  // Squatter guard: a foreign listener would pass nothing but fail late.
  if (await isOurApp(BASE_URL)) {
    throw new Error(
      `${BASE_URL} already serves the app; set E2E_PORT or E2E_BASE_URL`,
    );
  }

  const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
  const child = spawn(
    "pnpm",
    ["dev", "--port", String(E2E_PORT), "--strictPort"],
    {
      cwd: repoRoot,
      detached: true, // own process group so the whole tree can be killed
      stdio: "ignore",
    },
  );
  child.unref();
  const pid = child.pid;

  const stop = async (): Promise<void> => {
    if (pid === undefined) return;
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      return;
    }
    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline) {
      try {
        process.kill(-pid, 0);
      } catch {
        return;
      }
      await new Promise((r) => setTimeout(r, 100));
    }
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      // already gone
    }
  };

  try {
    await waitReady(BASE_URL, child, 90_000);
  } catch (err) {
    await stop();
    throw err;
  }
  return { baseUrl: BASE_URL, stop };
}

export type TestUser = { email: string; password: string; name: string };

/** Fresh random user via the app's sign-up endpoint (stateless runs). */
export async function signUpFreshUser(): Promise<TestUser> {
  const user: TestUser = {
    email: `e2e-${randomBytes(6).toString("hex")}@e2e.test`,
    password: E2E_PASSWORD,
    name: "E2E User",
  };
  const res = await fetchJson(`${BASE_URL}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: BASE_URL },
    body: JSON.stringify(user),
  });
  if (res.status !== 200 && res.status !== 201) {
    throw new Error(`sign-up failed: HTTP ${res.status} ${res.text}`);
  }
  return user;
}
