import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import {
  KCAL_MAX,
  KCAL_MIN,
  PROTEIN_MAX,
  PROTEIN_MIN,
  validateIntake,
} from "#/lib/intake-logic";
import { upsertIntakeForUser } from "#/server/intake.core";
import {
  isToolError,
  requireToolUser,
  toolErr,
  toolOk,
  WRITE_SCOPE_CHALLENGE,
  WRITE_TOOL_ANNOTATIONS,
} from "#/server/mcp/tools/tool-helpers";

const logIntakeSchema = z.object({
  date: z.string().date(),
  kcal: z.number().int().min(KCAL_MIN).max(KCAL_MAX),
  proteinG: z
    .number()
    .int()
    .min(PROTEIN_MIN)
    .max(PROTEIN_MAX)
    .nullable()
    .optional(),
});

function intakeValidationMessage(err: unknown): string {
  if (!(err instanceof Error)) return "Invalid intake.";
  switch (err.message) {
    case "INVALID_DATE":
      return "Invalid date: use canonical YYYY-MM-DD.";
    case "INVALID_KCAL":
      return `Invalid kcal: must be an integer from ${KCAL_MIN} to ${KCAL_MAX}.`;
    case "INVALID_PROTEIN":
      return `Invalid proteinG: must be an integer from ${PROTEIN_MIN} to ${PROTEIN_MAX}, or omitted/null.`;
    default:
      return err.message;
  }
}

export function register(server: McpServer): void {
  server.registerTool(
    "log_intake",
    {
      title: "Log daily intake",
      description:
        "Log or update calories and optional protein for a calendar date (idempotent per date). Omit proteinG to leave any existing protein value unchanged on update.",
      inputSchema: logIntakeSchema,
      annotations: { ...WRITE_TOOL_ANNOTATIONS, idempotentHint: true },
      scopeChallenge: WRITE_SCOPE_CHALLENGE,
    },
    async (args, ctx) => {
      const user = await requireToolUser(ctx);
      if (isToolError(user)) return user;

      try {
        const validated = validateIntake(args);
        const saved = await upsertIntakeForUser(user, {
          date: validated.date,
          kcal: validated.kcal,
          ...(args.proteinG !== undefined
            ? { proteinG: validated.proteinG }
            : {}),
        });
        const proteinPart =
          saved.proteinG != null ? `, ${saved.proteinG} g protein` : "";
        return toolOk(
          `Logged ${saved.kcal} kcal for ${saved.date}${proteinPart}.`,
          {
            date: saved.date,
            kcal: saved.kcal,
            proteinG: saved.proteinG,
          },
        );
      } catch (err) {
        return toolErr(intakeValidationMessage(err));
      }
    },
  );
}
