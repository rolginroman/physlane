import type { CallToolResult } from "@modelcontextprotocol/server";

/** Matches `MCP_SCOPES.read` / `MCP_SCOPES.write` in config (avoid importing config in unit tests). */
export const READ_SCOPE = "mcp:read";
export const WRITE_SCOPE = "mcp:write";

/** RFC 6750-style insufficient_scope message for tool-layer results. */
export function insufficientWriteScopeResult(): CallToolResult {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: `insufficient_scope: missing required OAuth scope "${WRITE_SCOPE}"`,
      },
    ],
  };
}

/** RFC 6750-style insufficient_scope when neither read nor write MCP scope is granted. */
export function insufficientReadScopeResult(): CallToolResult {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: `insufficient_scope: missing required OAuth scope "${READ_SCOPE}" or "${WRITE_SCOPE}"`,
      },
    ],
  };
}

/** Returns an error result when `mcp:read` and `mcp:write` are both absent; otherwise null. */
export function readScopeGuardResult(
  grantedScopes: readonly string[] | undefined,
): CallToolResult | null {
  if (
    grantedScopes?.includes(READ_SCOPE) ||
    grantedScopes?.includes(WRITE_SCOPE)
  ) {
    return null;
  }
  return insufficientReadScopeResult();
}

/** Returns an error result when `mcp:write` is absent; otherwise null. */
export function writeScopeGuardResult(
  grantedScopes: readonly string[] | undefined,
): CallToolResult | null {
  if (!grantedScopes?.includes(WRITE_SCOPE)) {
    return insufficientWriteScopeResult();
  }
  return null;
}
