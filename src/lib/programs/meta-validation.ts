import {
  programMetaSchema,
  type ProgramMeta,
} from "#/lib/programs/program-shape";

export type MetaField = "title" | "description" | "weeks" | "daysPerWeek";

export type MetaErrors = Partial<Record<MetaField, string>>;

const MESSAGES: Record<MetaField, string> = {
  title: "Give the program a title of up to 120 characters.",
  description: "Keep the description under 2000 characters.",
  weeks: "Weeks must be a whole number from 1 to 52.",
  daysPerWeek: "Sessions per week must be a whole number from 1 to 7.",
};

function isMetaField(value: unknown): value is MetaField {
  return typeof value === "string" && value in MESSAGES;
}

/** Field errors for a settings draft, or null when it can be saved. */
export function validateMetaDraft(draft: ProgramMeta): MetaErrors | null {
  const parsed = programMetaSchema.safeParse(draft);
  if (parsed.success) return null;
  const errors: MetaErrors = {};
  for (const issue of parsed.error.issues) {
    const field = issue.path[0];
    if (isMetaField(field)) errors[field] = MESSAGES[field];
  }
  return errors;
}
