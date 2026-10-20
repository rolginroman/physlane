import { createHash, randomBytes } from "node:crypto";
import { BASE_URL } from "./env";
import { fetchJson, type TestUser } from "./harness";

export const REDIRECT_URI = "http://127.0.0.1:9999/callback";
export const FULL_SCOPE = "openid profile offline_access mcp:read mcp:write";
export const READ_ONLY_SCOPE = "openid profile offline_access mcp:read";

export type OAuthClient = { clientId: string; clientSecret: string };
export type MintedToken = {
  accessToken: string;
  scope: string;
  /** How the code was obtained: consent page POST or direct (consent-skip). */
  path: "consent" | "skip-consent";
};

/** Minimal cookie jar: fetch has none and the sign-in flow is cookie-bound. */
class CookieJar {
  private cookies = new Map<string, string>();
  header(): Record<string, string> {
    if (this.cookies.size === 0) return {};
    const v = [...this.cookies].map(([k, val]) => `${k}=${val}`).join("; ");
    return { Cookie: v };
  }
  absorb(headers: Headers): void {
    for (const line of headers.getSetCookie()) {
      const pair = line.split(";")[0] ?? "";
      const i = pair.indexOf("=");
      if (i > 0) this.cookies.set(pair.slice(0, i).trim(), pair.slice(i + 1));
    }
  }
}

const JSON_HEADERS = {
  "Content-Type": "application/json",
  Accept: "application/json",
  Origin: BASE_URL,
};

/** Resource indicator comes from metadata, as a foreign host would do it. */
export async function discoverResource(): Promise<string> {
  const res = await fetchJson<{ resource?: string }>(
    `${BASE_URL}/.well-known/oauth-protected-resource`,
  );
  if (typeof res.json?.resource !== "string") {
    throw new Error(`protected-resource metadata has no resource: ${res.text}`);
  }
  return res.json.resource;
}

export async function registerClient(): Promise<OAuthClient> {
  const res = await fetchJson<{ client_id?: string; client_secret?: string }>(
    `${BASE_URL}/api/auth/oauth2/register`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_name: `physlane-e2e-${randomBytes(4).toString("hex")}`,
        redirect_uris: [REDIRECT_URI],
        token_endpoint_auth_method: "client_secret_basic",
      }),
    },
  );
  const { client_id, client_secret } = res.json ?? {};
  if (
    (res.status !== 200 && res.status !== 201) ||
    !client_id ||
    !client_secret
  ) {
    throw new Error(`DCR failed: HTTP ${res.status} ${res.text}`);
  }
  return { clientId: client_id, clientSecret: client_secret };
}

/** Keep only the signed OAuth params better-auth expects back as oauth_query. */
function oauthQuery(search: string): string {
  const params = new URLSearchParams(search);
  if (!params.has("sig")) throw new Error(`no sig in query: ${search}`);
  const names = new Set(params.getAll("ba_param"));
  const out = new URLSearchParams();
  for (const [k, v] of params) {
    if (k === "sig" || k === "ba_param" || names.has(k)) out.append(k, v);
  }
  return out.toString();
}

function absolute(url: string): URL {
  return new URL(url, BASE_URL);
}

function redirectUrl(res: { headers: Headers; json: unknown }): string | null {
  const loc = res.headers.get("location");
  if (loc) return loc;
  const j = res.json as { url?: unknown; redirect?: unknown } | null;
  if (typeof j?.url === "string") return j.url;
  if (typeof j?.redirect === "string") return j.redirect;
  return null;
}

export async function mintAccessToken(args: {
  client: OAuthClient;
  user: TestUser;
  scope: string;
  resource: string;
}): Promise<MintedToken> {
  const { client, user, scope, resource } = args;
  // Fresh jar = unauthenticated, so authorize always starts at /sign-in.
  const jar = new CookieJar();

  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const query = new URLSearchParams({
    client_id: client.clientId,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope,
    state: `e2e-${randomBytes(4).toString("hex")}`,
    code_challenge: challenge,
    code_challenge_method: "S256",
    resource,
  });

  const auth = await fetchJson(
    `${BASE_URL}/api/auth/oauth2/authorize?${query}`,
    { headers: { Accept: "application/json", ...jar.header() } },
  );
  jar.absorb(auth.headers);
  const first = redirectUrl(auth);
  if (!first) {
    throw new Error(
      `authorize gave no redirect: HTTP ${auth.status} ${auth.text}`,
    );
  }

  let next = absolute(first);
  let path: MintedToken["path"] = "consent";

  if (next.pathname === "/sign-in") {
    const signIn = await fetchJson(`${BASE_URL}/api/auth/sign-in/email`, {
      method: "POST",
      headers: { ...JSON_HEADERS, ...jar.header() },
      body: JSON.stringify({
        email: user.email,
        password: user.password,
        oauth_query: oauthQuery(next.search),
      }),
    });
    jar.absorb(signIn.headers);
    if (signIn.status !== 200) {
      throw new Error(`sign-in failed: HTTP ${signIn.status} ${signIn.text}`);
    }
    const after = redirectUrl(signIn);
    if (!after) throw new Error(`sign-in gave no continuation: ${signIn.text}`);
    next = absolute(after);
  }

  let callback: URL;
  if (next.searchParams.has("code")) {
    // Already consented for this client/scope: server skipped the consent page.
    path = "skip-consent";
    callback = next;
  } else if (next.pathname === "/consent") {
    const consent = await fetchJson(`${BASE_URL}/api/auth/oauth2/consent`, {
      method: "POST",
      headers: { ...JSON_HEADERS, ...jar.header() },
      body: JSON.stringify({
        accept: true,
        oauth_query: oauthQuery(next.search),
      }),
    });
    jar.absorb(consent.headers);
    if (consent.status !== 200) {
      throw new Error(`consent failed: HTTP ${consent.status} ${consent.text}`);
    }
    const url = redirectUrl(consent);
    if (!url) throw new Error(`consent gave no callback: ${consent.text}`);
    callback = absolute(url);
  } else {
    throw new Error(`unexpected continuation: ${next.href}`);
  }

  const code = callback.searchParams.get("code");
  if (!code) throw new Error(`callback has no code: ${callback.href}`);

  const basic = Buffer.from(
    `${client.clientId}:${client.clientSecret}`,
  ).toString("base64");
  const token = await fetchJson<{ access_token?: string; scope?: string }>(
    `${BASE_URL}/api/auth/oauth2/token`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        code_verifier: verifier,
      }),
    },
  );
  if (token.status !== 200 || !token.json?.access_token) {
    throw new Error(
      `token exchange failed: HTTP ${token.status} ${token.text}`,
    );
  }
  return {
    accessToken: token.json.access_token,
    scope: token.json.scope ?? scope,
    path,
  };
}
