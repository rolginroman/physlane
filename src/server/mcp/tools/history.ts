import type { CallToolResult, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { intakeRangeForUser } from "#/server/intake.core";
import { listCyclesForUser } from "#/server/cycles.core";
import { listMeasurementsForUser } from "#/server/measurements.core";
import { readScopeGuardResult } from "#/server/mcp/tools/scope-guard";
import { resolveMcpSessionUser } from "#/server/mcp/tools/status";

const GET_HISTORY_DESCRIPTION =
  "Fetch historical intake days, body measurements, or training cycles. For kind=intake, from/to are YYYY-MM-DD (defaults to the last 90 days through today when omitted). Results are ascending by date; limit keeps the newest rows (max 400).";

export { GET_HISTORY_DESCRIPTION };

const historyInputSchema = z.object({
  kind: z.enum(["intake", "measurements", "cycles"]),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  limit: z.number().int().min(1).max(400).default(120),
});

function mcpToolError(message: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text: message }] };
}

const toDate = (d: Date): string => d.toISOString().slice(0, 10);

function defaultIntakeRange(): { from: string; to: string } {
  const to = toDate(new Date());
  const from = toDate(new Date(Date.now() - 90 * 86_400_000));
  return { from, to };
}

function applyLimit<T>(rows: T[], limit: number): T[] {
  if (rows.length <= limit) return rows;
  return rows.slice(-limit);
}

function historySummary(
  kind: z.infer<typeof historyInputSchema>["kind"],
  count: number,
): string {
  return `${kind}: ${count} row(s)`;
}

export function register(server: McpServer): void {
  server.registerTool(
    "get_history",
    {
      description: GET_HISTORY_DESCRIPTION,
      inputSchema: historyInputSchema,
      annotations: { readOnlyHint: true, idempotentHint: true },
    },
    async (args, ctx) => {
      const scopeErr = readScopeGuardResult(ctx.http?.authInfo?.scopes);
      if (scopeErr) return scopeErr;

      const user = await resolveMcpSessionUser(ctx);
      if (!user) {
        return mcpToolError(
          "Not authenticated: connect with a valid MCP access token.",
        );
      }

      let rows: unknown[];
      switch (args.kind) {
        case "intake": {
          const range = defaultIntakeRange();
          const from = args.from ?? range.from;
          const to = args.to ?? range.to;
          rows = applyLimit(
            await intakeRangeForUser(user, { from, to }),
            args.limit,
          );
          break;
        }
        case "measurements":
          rows = applyLimit(await listMeasurementsForUser(user), args.limit);
          break;
        case "cycles": {
          const cyclesNewestFirst = await listCyclesForUser(user);
          const cyclesAscending = [...cyclesNewestFirst].reverse();
          rows = applyLimit(cyclesAscending, args.limit);
          break;
        }
        default: {
          const _exhaustive: never = args.kind;
          return mcpToolError(
            `Unsupported history kind: ${String(_exhaustive)}`,
          );
        }
      }

      return {
        content: [
          { type: "text", text: historySummary(args.kind, rows.length) },
        ],
        structuredContent: { kind: args.kind, items: rows },
      };
    },
  );
}
