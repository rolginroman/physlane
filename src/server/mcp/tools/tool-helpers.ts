import type {
  CallToolResult,
  ServerContext,
  ToolAnnotations,
} from "@modelcontextprotocol/server";
import { requireScopes } from "@modelcontextprotocol/server";
import { loadUserById } from "#/server/auth.core";
import type { SessionUser } from "#/server/auth.core";
import {
  writeScopeGuardResult,
  WRITE_SCOPE,
} from "#/server/mcp/tools/scope-guard";

export const WRITE_TOOL_ANNOTATIONS: ToolAnnotations = {
  openWorldHint: false,
};

export const WRITE_SCOPE_CHALLENGE = requireScopes(WRITE_SCOPE);

export function toolOk(
  summary: string,
  structuredContent: Record<string, unknown>,
): CallToolResult {
  return {
    content: [{ type: "text", text: summary }],
    structuredContent,
  };
}

export function toolErr(message: string): CallToolResult {
  return {
    isError: true,
    content: [{ type: "text", text: message }],
  };
}

function userIdFromVerifiedClaims(
  extra: Record<string, unknown> | undefined,
): string | null {
  const fromSub = extra?.sub;
  if (typeof fromSub === "string" && fromSub) return fromSub;
  const fromUserId = extra?.userId;
  if (typeof fromUserId === "string" && fromUserId) return fromUserId;
  return null;
}

export async function requireToolUser(
  ctx: ServerContext,
): Promise<SessionUser | CallToolResult> {
  const auth = ctx.http?.authInfo;
  const scopeErr = writeScopeGuardResult(auth?.scopes);
  if (scopeErr) return scopeErr;

  if (!auth) {
    return toolErr("Authentication required.");
  }

  const userId = userIdFromVerifiedClaims(auth.extra);
  if (!userId) {
    return toolErr("Could not resolve user from verified claims.");
  }

  const user = await loadUserById(userId);
  if (!user) {
    return toolErr("User not found.");
  }

  return user;
}

export function isToolError<T>(
  value: T | CallToolResult,
): value is CallToolResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "isError" in value &&
    value.isError === true
  );
}

export const PRO_UPGRADE_COPY =
  "Apply measured target requires Pro. Pro reveals the number, its spread, the projection, and the verdict — and realigns your daily target in one tap. Unlock with Pro ($10/mo or $100/yr).";
