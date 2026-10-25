import { z } from "zod";
import {
  EQUIPMENT,
  PROGRAM_GOALS,
  PROGRAM_LEVELS,
} from "#/lib/programs/taxonomy";

const repsTypeSchema = z.enum(["count", "max", "seconds"]);
const loadTypeSchema = z.enum(["none", "kg", "percent1rm"]);
const intensityTypeSchema = z.enum(["none", "rpe", "rir"]);

const httpUrlSchema = z
  .string()
  .url()
  .refine((u) => u.startsWith("http://") || u.startsWith("https://"), {
    message: "URL must use http or https",
  });

export const entrySchema = z
  .object({
    exerciseId: z.string().min(1),
    groupTag: z.string().nullable().optional(),
    sets: z.number().int().min(1).max(20),
    repsType: repsTypeSchema,
    repsValue: z.number().int().nullable(),
    loadType: loadTypeSchema,
    loadValue: z.number().nullable(),
    intensityType: intensityTypeSchema,
    intensityValue: z.number().nullable(),
    restSeconds: z.number().int().min(0).max(900).nullable(),
    cues: z.string().nullable().optional(),
    refUrl: z.string().nullable().optional(),
  })
  .superRefine((entry, ctx) => {
    if (entry.repsType === "max") {
      if (entry.repsValue !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "repsValue must be null when repsType is max",
          path: ["repsValue"],
        });
      }
    } else if (entry.repsValue === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "repsValue is required for count and seconds",
        path: ["repsValue"],
      });
    } else if (entry.repsType === "count") {
      if (entry.repsValue < 1 || entry.repsValue > 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "count reps must be between 1 and 100",
          path: ["repsValue"],
        });
      }
    } else if (entry.repsType === "seconds") {
      if (entry.repsValue < 5 || entry.repsValue > 3600) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "seconds reps must be between 5 and 3600",
          path: ["repsValue"],
        });
      }
    }

    if (entry.loadType === "none") {
      if (entry.loadValue !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "loadValue must be null when loadType is none",
          path: ["loadValue"],
        });
      }
    } else if (entry.loadValue === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "loadValue is required when load is set",
        path: ["loadValue"],
      });
    } else if (entry.loadType === "kg") {
      if (entry.loadValue <= 0 || entry.loadValue > 600) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "kg load must be greater than 0 and at most 600",
          path: ["loadValue"],
        });
      }
    } else if (entry.loadType === "percent1rm") {
      if (entry.loadValue <= 0 || entry.loadValue > 200) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "percent1rm must be greater than 0 and at most 200",
          path: ["loadValue"],
        });
      }
    }

    if (entry.intensityType === "none") {
      if (entry.intensityValue !== null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "intensityValue must be null when intensityType is none",
          path: ["intensityValue"],
        });
      }
    } else if (entry.intensityValue === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "intensityValue is required when intensity is set",
        path: ["intensityValue"],
      });
    } else if (entry.intensityType === "rpe") {
      if (entry.intensityValue < 1 || entry.intensityValue > 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "RPE must be between 1 and 10",
          path: ["intensityValue"],
        });
      }
    } else if (entry.intensityType === "rir") {
      if (entry.intensityValue < 0 || entry.intensityValue > 12) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "RIR must be between 0 and 12",
          path: ["intensityValue"],
        });
      }
    }

    if (entry.refUrl != null && entry.refUrl !== "") {
      const parsed = httpUrlSchema.safeParse(entry.refUrl);
      if (!parsed.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "refUrl must be a valid http(s) URL",
          path: ["refUrl"],
        });
      }
    }
  });

export const sessionSchema = z.object({
  weekNumber: z.number().int().min(1),
  orderIndex: z.number().int().min(0),
  title: z.string().min(1).max(120),
  notes: z.string().nullable().optional(),
  entries: z.array(entrySchema),
});

export const programMetaSchema = z.object({
  title: z.string().min(1).max(120),
  description: z.string().max(2000).nullable().optional(),
  weeks: z.number().int().min(1).max(52),
  goal: z.enum(PROGRAM_GOALS),
  level: z.enum(PROGRAM_LEVELS),
  daysPerWeek: z.number().int().min(1).max(7),
  equipmentTags: z.array(z.enum(EQUIPMENT)),
});

export type ProgramEntry = z.infer<typeof entrySchema>;
export type ProgramSession = z.infer<typeof sessionSchema>;
export type ProgramMeta = z.infer<typeof programMetaSchema>;

export function validateProgramShape(
  meta: ProgramMeta,
  sessions: ProgramSession[],
): string[] | null {
  const errors: string[] = [];
  for (const session of sessions) {
    if (session.weekNumber > meta.weeks) {
      errors.push(
        `Session "${session.title}" week ${session.weekNumber} exceeds program length (${meta.weeks} weeks)`,
      );
    }
    const parsed = sessionSchema.safeParse(session);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        errors.push(issue.message);
      }
    }
  }
  const metaParsed = programMetaSchema.safeParse(meta);
  if (!metaParsed.success) {
    for (const issue of metaParsed.error.issues) {
      errors.push(issue.message);
    }
  }
  return errors.length > 0 ? errors : null;
}
