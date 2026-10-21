import { createMcpProtectedRequestHandler } from "@better-auth/mcp";
import type { AuthInfo } from "@modelcontextprotocol/server";
import { createFileRoute } from "@tanstack/react-router";
import { createDpopReplayStore } from "better-auth/oauth2";
import { useAuth } from "#/lib/auth";
import { MCP_RESOURCE } from "#/server/mcp/config";
import { mcpHttpHandler } from "#/server/mcp/server";

function bearerToken(request: Request): string {
  const header = request.headers.get("Authorization");
  if (!header?.startsWith("Bearer ")) return "";
  return header.slice("Bearer ".length);
}

type VerifiedAccessTokenClaims = {
  scope?: string;
  scp?: unknown;
  client_id?: unknown;
  azp?: unknown;
  exp?: unknown;
  sub?: unknown;
};

function scopesFromClaims(claims: VerifiedAccessTokenClaims): string[] {
  if (typeof claims.scope === "string") {
    return claims.scope.split(/\s+/).filter(Boolean);
  }
  const scp = claims.scp;
  if (Array.isArray(scp)) {
    return scp.filter((value): value is string => typeof value === "string");
  }
  return [];
}

function authInfoFromRequest(
  request: Request,
  claims: VerifiedAccessTokenClaims,
): AuthInfo {
  const extra =
    typeof claims.sub === "string" ? { sub: claims.sub } : undefined;
  return {
    token: bearerToken(request),
    clientId: String(claims.client_id ?? claims.azp ?? ""),
    scopes: scopesFromClaims(claims),
    expiresAt: typeof claims.exp === "number" ? claims.exp : undefined,
    ...(extra ? { extra } : {}),
  };
}

async function handleMcp(request: Request): Promise<Response> {
  const origin = new URL(request.url).origin;
  // Issuer matches better-auth mount at /api/auth (RFC 8414 metadata issuer).
  const issuer = `${origin}/api/auth`;
  const { internalAdapter } = await useAuth().$context;
  const protectedHandler = createMcpProtectedRequestHandler(
    {
      issuer,
      audience: MCP_RESOURCE,
      jwksUrl: `${origin}/api/auth/jwks`,
      dpop: { replayStore: createDpopReplayStore(internalAdapter) },
    },
    (req, claims) =>
      mcpHttpHandler.fetch(req, { authInfo: authInfoFromRequest(req, claims) }),
  );
  try {
    return await protectedHandler(request);
  } catch (error) {
    // Challenge responses are returned, not thrown; a throw here is a server
    // fault that TanStack would mask behind a generic "HTTPError" body.
    console.error("mcp request failed", error);
    const message =
      error instanceof Error
        ? `${error.name}: ${error.message}`
        : String(error);
    return new Response(
      JSON.stringify({
        jsonrpc: "2.0",
        error: { code: -32603, message },
        id: null,
      }),
      { status: 500, headers: { "content-type": "application/json" } },
    );
  }
}

export const Route = createFileRoute("/mcp")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => handleMcp(request),
      POST: async ({ request }: { request: Request }) => handleMcp(request),
      DELETE: async ({ request }: { request: Request }) => handleMcp(request),
    },
  },
});
