import { buildSignedOAuthQuery } from "./-oauth-signed-query";

type OAuthRedirectPayload = {
  redirect?: boolean;
  url?: string;
};

function oauthQueryBody(): { oauth_query?: string } {
  const oauth_query = buildSignedOAuthQuery(window.location.search);
  return oauth_query ? { oauth_query } : {};
}

export async function signInEmailWithOAuthContinuation(
  email: string,
  password: string,
): Promise<
  | { ok: true; redirectUrl?: string }
  | { ok: false; status: number; body: Record<string, unknown> }
> {
  const res = await fetch(`${window.location.origin}/api/auth/sign-in/email`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      ...oauthQueryBody(),
    }),
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    return { ok: false, status: res.status, body };
  }
  const payload = body as OAuthRedirectPayload;
  if (payload.redirect && payload.url) {
    return { ok: true, redirectUrl: payload.url };
  }
  return { ok: true };
}

export type OAuthPublicClient = {
  client_id: string;
  client_name?: string;
  client_uri?: string;
  logo_uri?: string;
};

export async function fetchOAuthPublicClient(
  clientId: string,
): Promise<OAuthPublicClient | null> {
  const res = await fetch(
    `${window.location.origin}/api/auth/oauth2/public-client?client_id=${encodeURIComponent(clientId)}`,
    { credentials: "include", headers: { Accept: "application/json" } },
  );
  if (!res.ok) return null;
  return (await res.json()) as OAuthPublicClient;
}

export async function postOAuthConsent(
  accept: boolean,
): Promise<{ redirectUrl: string } | { error: string }> {
  const res = await fetch(`${window.location.origin}/api/auth/oauth2/consent`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      accept,
      ...oauthQueryBody(),
    }),
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message =
      typeof body.message === "string"
        ? body.message
        : "Could not complete authorization.";
    return { error: message };
  }
  const payload = body as OAuthRedirectPayload;
  if (payload.redirect && payload.url) {
    return { redirectUrl: payload.url };
  }
  if (typeof payload.url === "string") {
    return { redirectUrl: payload.url };
  }
  return { error: "Missing redirect from authorization server." };
}
