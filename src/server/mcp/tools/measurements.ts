import type { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { inToCm, lbToKg, type UnitSystem } from "#/lib/units";
import {
  saveMeasurementForUser,
  type MeasurementInput,
} from "#/server/measurements.core";
import {
  isToolError,
  requireToolUser,
  toolErr,
  toolOk,
  WRITE_SCOPE_CHALLENGE,
  WRITE_TOOL_ANNOTATIONS,
} from "#/server/mcp/tools/tool-helpers";

const positive = z.number().positive();

const logMeasurementSchema = z.object({
  unit: z.enum(["metric", "imperial"]),
  takenAt: z.string().datetime({ offset: true }).optional(),
  weight: positive.optional(),
  neck: positive.optional(),
  chest: positive.optional(),
  waist: positive.optional(),
  hips: positive.optional(),
  armLeft: positive.optional(),
  armRight: positive.optional(),
  thighLeft: positive.optional(),
  thighRight: positive.optional(),
  calf: positive.optional(),
});

function toCanonicalLength(value: number, unit: UnitSystem): number {
  return unit === "metric" ? value : inToCm(value);
}

function toCanonicalWeight(value: number, unit: UnitSystem): number {
  return unit === "metric" ? value : lbToKg(value);
}

function buildMeasurementInput(
  args: z.infer<typeof logMeasurementSchema>,
): MeasurementInput {
  const takenAt = args.takenAt ?? new Date().toISOString();
  const unit = args.unit;
  const input: MeasurementInput = { takenAt };

  if (args.weight !== undefined)
    input.weightKg = toCanonicalWeight(args.weight, unit);
  if (args.neck !== undefined)
    input.neckCm = toCanonicalLength(args.neck, unit);
  if (args.chest !== undefined)
    input.chestCm = toCanonicalLength(args.chest, unit);
  if (args.waist !== undefined)
    input.waistCm = toCanonicalLength(args.waist, unit);
  if (args.hips !== undefined)
    input.hipsCm = toCanonicalLength(args.hips, unit);
  if (args.armLeft !== undefined)
    input.armLeftCm = toCanonicalLength(args.armLeft, unit);
  if (args.armRight !== undefined)
    input.armRightCm = toCanonicalLength(args.armRight, unit);
  if (args.thighLeft !== undefined)
    input.thighLeftCm = toCanonicalLength(args.thighLeft, unit);
  if (args.thighRight !== undefined)
    input.thighRightCm = toCanonicalLength(args.thighRight, unit);
  if (args.calf !== undefined)
    input.calfCm = toCanonicalLength(args.calf, unit);

  return input;
}

export function register(server: McpServer): void {
  server.registerTool(
    "log_measurement",
    {
      title: "Log body measurement",
      description:
        "Log weight and/or body-site girths. Requires unit (metric or imperial); values are converted to kg/cm before save.",
      inputSchema: logMeasurementSchema,
      annotations: WRITE_TOOL_ANNOTATIONS,
      scopeChallenge: WRITE_SCOPE_CHALLENGE,
    },
    async (args, ctx) => {
      const user = await requireToolUser(ctx);
      if (isToolError(user)) return user;

      const hasAny =
        args.weight !== undefined ||
        args.neck !== undefined ||
        args.chest !== undefined ||
        args.waist !== undefined ||
        args.hips !== undefined ||
        args.armLeft !== undefined ||
        args.armRight !== undefined ||
        args.thighLeft !== undefined ||
        args.thighRight !== undefined ||
        args.calf !== undefined;

      if (!hasAny) {
        return toolErr(
          "Provide at least one measurement field (weight or a site).",
        );
      }

      const input = buildMeasurementInput(args);
      const saved = await saveMeasurementForUser(user, input);
      const weightPart =
        saved.weightKg != null
          ? `${saved.weightKg.toFixed(2)} kg`
          : "measurement";
      return toolOk(`Saved ${weightPart} at ${saved.takenAt}.`, {
        id: saved.id,
        takenAt: saved.takenAt,
        weightKg: saved.weightKg,
        waistCm: saved.waistCm,
      });
    },
  );
}
