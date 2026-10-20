import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { KCAL_MAX } from "#/lib/intake-logic";
import { saveCycleForUser } from "#/server/cycles.core";
import { applyMeasuredTargetForUser } from "#/server/target-prompt.core";
import {
  isToolError,
  PRO_UPGRADE_COPY,
  requireToolUser,
  toolErr,
  toolOk,
  WRITE_SCOPE_CHALLENGE,
  WRITE_TOOL_ANNOTATIONS,
} from "#/server/mcp/tools/tool-helpers";

/** Frozen C7 bounds (cycles.core has no numeric validation). */
export const CYCLE_TARGET_RATE_MIN = -1.5;
export const CYCLE_TARGET_RATE_MAX = 1;
export const CYCLE_KCAL_TARGET_MIN = 1;
export const CYCLE_KCAL_TARGET_MAX = KCAL_MAX;

const setCycleSchema = z.object({
  phase: z.enum(["cut", "bulk", "maintain"]),
  startDate: z.string().date().optional(),
  targetRateKgPerWeek: z
    .number()
    .min(CYCLE_TARGET_RATE_MIN)
    .max(CYCLE_TARGET_RATE_MAX)
    .optional(),
  kcalTargetPerDay: z
    .number()
    .int()
    .min(CYCLE_KCAL_TARGET_MIN)
    .max(CYCLE_KCAL_TARGET_MAX)
    .optional(),
  notes: z.string().optional(),
});

const applyMeasuredTargetSchema = z.object({});

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function register(server: McpServer): void {
  server.registerTool(
    "set_cycle",
    {
      title: "Set training cycle",
      description:
        "Start a new cut/bulk/maintain cycle (ends any active cycle). Optionally set weekly rate and daily kcal target.",
      inputSchema: setCycleSchema,
      annotations: { ...WRITE_TOOL_ANNOTATIONS, destructiveHint: true },
      scopeChallenge: WRITE_SCOPE_CHALLENGE,
    },
    async (args, ctx) => {
      const user = await requireToolUser(ctx);
      if (isToolError(user)) return user;

      const startDate = args.startDate ?? todayUtcDate();
      await saveCycleForUser(user, {
        phase: args.phase,
        startDate,
        targetRateKgPerWeek: args.targetRateKgPerWeek ?? null,
        kcalTargetPerDay: args.kcalTargetPerDay ?? null,
        notes: args.notes ?? null,
      });

      return toolOk(`Started ${args.phase} cycle from ${startDate}.`, {
        phase: args.phase,
        startDate,
        targetRateKgPerWeek: args.targetRateKgPerWeek ?? null,
        kcalTargetPerDay: args.kcalTargetPerDay ?? null,
      });
    },
  );

  server.registerTool(
    "apply_measured_target",
    {
      title: "Apply measured calorie target",
      description:
        "Pro only: set the active cycle daily kcal target from your measured burn (TDEE pipeline).",
      inputSchema: applyMeasuredTargetSchema,
      annotations: WRITE_TOOL_ANNOTATIONS,
      scopeChallenge: WRITE_SCOPE_CHALLENGE,
    },
    async (_args, ctx) => {
      const user = await requireToolUser(ctx);
      if (isToolError(user)) return user;

      try {
        const result = await applyMeasuredTargetForUser(user);
        return toolOk(
          `Applied measured target: ${result.kcalTargetPerDay} kcal/day.`,
          {
            kcalTargetPerDay: result.kcalTargetPerDay,
          },
        );
      } catch (err) {
        if (err instanceof Error && err.message === "PRO_REQUIRED") {
          return toolErr(PRO_UPGRADE_COPY);
        }
        if (err instanceof Error && err.message === "NOT_READY") {
          return toolErr(
            "Measured target is not ready yet — log more weight and intake pairs first.",
          );
        }
        throw err;
      }
    },
  );
}
