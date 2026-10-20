import { env } from "cloudflare:workers";

const DEV_APP_URL = "http://localhost:3000";

/** Derive the MCP protected-resource identifier from an app base URL (no trailing slash). */
export function mcpResourceFromAppUrl(appUrl: string): string {
  return `${appUrl.replace(/\/$/, "")}/mcp`;
}

function resolveAppUrl(): string {
  if (import.meta.env.DEV) {
    return DEV_APP_URL;
  }
  return env.APP_URL ?? DEV_APP_URL;
}

/** Canonical MCP resource URL (`${APP_URL}/mcp`; dev uses loopback :3000). */
export const MCP_RESOURCE: string = mcpResourceFromAppUrl(resolveAppUrl());

export const MCP_SCOPES = { read: "mcp:read", write: "mcp:write" } as const;
