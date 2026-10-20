import type {
  CallToolResult,
  McpServer,
  ServerContext,
} from "@modelcontextprotocol/server";
import { z } from "zod";
import { fmtWeight } from "#/lib/units";
import { loadUserById, type SessionUser } from "#/server/auth.core";
import { readScopeGuardResult } from "#/server/mcp/tools/scope-guard";
import {
  buildTdeeStatusForUser,
  intakeStreakForUser,
  loadActiveCycle,
} from "#/server/intake.core";
import { latestMeasurementForUser } from "#/server/measurements.core";

const GET_STATUS_DESCRIPTION =
  "Call this first; it tells you the user's units, plan, active cycle and today's snapshot.";

export { GET_STATUS_DESCRIPTION };

function mcpToolError(message: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text: message }] };
}

export async function resolveMcpSessionUser(
  ctx: ServerContext,
): Promise<SessionUser | null> {
  const extra = ctx.http?.authInfo?.extra;
  const userId =
    (typeof extra?.sub === "string" && extra.sub) ||
    (typeof extra?.userId === "string" && extra.userId) ||
    null;
  if (!userId) return null;
  return loadUserById(userId);
}

function statusSummaryLine(
  user: SessionUser,
  streak: number,
  latestWeightKg: number | null,
  tdeeStatus: Awaited<ReturnType<typeof buildTdeeStatusForUser>>,
  activeCycle: Awaited<ReturnType<typeof loadActiveCycle>>,
): string {
  const parts: string[] = [
    user.unitSystem,
    user.plan,
    activeCycle ? `cycle ${activeCycle.phase}` : "no active cycle",
    `streak ${streak}`,
    `weight ${fmtWeight(latestWeightKg, user.unitSystem)}`,
  ];
  if (tdeeStatus.status === "collecting") {
    parts.push(`TDEE collecting (${tdeeStatus.pairs}/14 pairs)`);
  } else if (tdeeStatus.gated) {
    parts.push("TDEE ready (upgrade for estimate kcal)");
  } else if (tdeeStatus.kcal != null) {
    parts.push(`TDEE ~${tdeeStatus.kcal} kcal`);
  } else {
    parts.push("TDEE ready");
  }
  return parts.join(" · ");
}

export function register(server: McpServer): void {
  server.registerTool(
    "get_status",
    {
      description: GET_STATUS_DESCRIPTION,
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async (_args, ctx) => {
      const scopeErr = readScopeGuardResult(ctx.http?.authInfo?.scopes);
      if (scopeErr) return scopeErr;

      const user = await resolveMcpSessionUser(ctx);
      if (!user) {
        return mcpToolError(
          "Not authenticated: connect with a valid MCP access token.",
        );
      }

      const [tdeeStatus, activeCycle, streak, latest] = await Promise.all([
        buildTdeeStatusForUser(user),
        loadActiveCycle(user.id),
        intakeStreakForUser(user),
        latestMeasurementForUser(user),
      ]);

      const structuredContent = {
        units: user.unitSystem,
        plan: user.plan,
        activeCycle,
        tdeeStatus,
        streak,
        latestWeight: latest,
      };

      return {
        content: [
          {
            type: "text",
            text: statusSummaryLine(
              user,
              streak,
              latest?.weightKg ?? null,
              tdeeStatus,
              activeCycle,
            ),
          },
        ],
        structuredContent,
      };
    },
  );
}
