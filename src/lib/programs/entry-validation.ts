import {
  sessionSchema,
  type ProgramEntry,
  type ProgramSession,
} from "#/lib/programs/program-shape";
import { countLabel } from "#/lib/programs/count-label";
import { loadToInput, loadUnitLabel } from "#/lib/programs/load-units";
import type { UnitSystem } from "#/lib/units";
import type { ProgramEntryDTO, ProgramSessionDTO } from "#/server/programs.fns";

export type EntryField =
  | "sets"
  | "repsValue"
  | "loadValue"
  | "intensityValue"
  | "restSeconds"
  | "cues"
  | "refUrl";

export type EntryErrors = Partial<Record<EntryField, string>>;

export type SessionErrors = {
  title?: string;
  notes?: string;
  entriesLimit?: string;
  /** Keyed by entry id; only entries with at least one error appear. */
  entries: Record<string, EntryErrors>;
};

export type SaveBlockers = {
  /** Sessions that cannot be sent, keyed by session id. */
  bySession: Record<string, SessionErrors>;
  entryCount: number;
  otherCount: number;
};

function nullIfEmpty(value: string | null | undefined): string | null {
  if (value == null || value.trim() === "") {
    return null;
  }
  return value;
}

/** Number field text to a value: blank is null, non-numeric text is NaN. */
export function parseNumberInput(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : Number.NaN;
}

/** Number to field text; null and NaN (cleared or unparsable) show blank. */
export function numberToInput(value: number | null | undefined): string {
  return value == null || Number.isNaN(value) ? "" : String(value);
}

/**
 * Wire shape for one entry. Values the author typed are sent as typed, so
 * validation reports them instead of the payload rewriting them. Only fields
 * made meaningless by the chosen type are cleared.
 */
export function entryToPayload(
  entry: ProgramEntryDTO,
  keepId = true,
): ProgramEntry {
  return {
    id: keepId ? entry.id : undefined,
    exerciseId: entry.exerciseId,
    groupTag: entry.groupTag,
    sets: entry.sets,
    repsType: entry.repsType,
    repsValue: entry.repsType === "max" ? null : entry.repsValue,
    loadType: entry.loadType,
    loadValue: entry.loadType === "none" ? null : entry.loadValue,
    intensityType: entry.intensityType,
    intensityValue:
      entry.intensityType === "none" ? null : entry.intensityValue,
    restSeconds: entry.restSeconds,
    cues: nullIfEmpty(entry.cues),
    refUrl: nullIfEmpty(entry.refUrl),
  };
}

/** Entries with an exercise; the rest are unfinished rows that are not sent. */
function sendableEntries(session: ProgramSessionDTO): ProgramEntryDTO[] {
  return session.entries.filter((e) => e.exerciseId.length > 0);
}

export function sessionToPayload(session: ProgramSessionDTO): ProgramSession {
  return {
    weekNumber: session.weekNumber,
    orderIndex: session.orderIndex,
    title: session.title,
    notes: nullIfEmpty(session.notes),
    entries: sendableEntries(session).map((entry) => entryToPayload(entry)),
  };
}

function isBlank(value: number | null | undefined): boolean {
  return value == null || Number.isNaN(value);
}

function fieldMessage(
  field: EntryField,
  entry: ProgramEntryDTO,
  units: UnitSystem,
): string {
  switch (field) {
    case "sets":
      return "Sets must be a whole number from 1 to 20.";
    case "repsValue":
      if (entry.repsType === "seconds") {
        return isBlank(entry.repsValue)
          ? "Add seconds, or choose Max."
          : "Seconds must be a whole number from 5 to 3600.";
      }
      return isBlank(entry.repsValue)
        ? "Add reps, or choose Max."
        : "Reps must be a whole number from 1 to 100.";
    case "loadValue":
      if (entry.loadType === "percent1rm") {
        return isBlank(entry.loadValue)
          ? "Add a percentage of 1RM."
          : "Percentage must be above 0 and at most 200.";
      }
      return isBlank(entry.loadValue)
        ? `Add a load in ${loadUnitLabel(units)}.`
        : `Load must be above 0 and at most ${loadToInput(600, units)} ${loadUnitLabel(units)}.`;
    case "intensityValue":
      if (entry.intensityType === "rir") {
        return isBlank(entry.intensityValue)
          ? "Add reps in reserve."
          : "RIR must be from 0 to 12.";
      }
      return isBlank(entry.intensityValue)
        ? "Add an RPE."
        : "RPE must be from 1 to 10.";
    case "restSeconds":
      return "Rest must be a whole number of seconds from 0 to 900.";
    case "cues":
      return "Cues are too long.";
    case "refUrl":
      return "Use a link that starts with http:// or https://.";
  }
}

const ENTRY_FIELDS: readonly string[] = [
  "sets",
  "repsValue",
  "loadValue",
  "intensityValue",
  "restSeconds",
  "cues",
  "refUrl",
];

function isEntryField(value: unknown): value is EntryField {
  return typeof value === "string" && ENTRY_FIELDS.includes(value);
}

/** Checks a session against the shared schema before it is sent. */
export function validateSession(
  session: ProgramSessionDTO,
  units: UnitSystem,
): SessionErrors | null {
  const sent = sendableEntries(session);
  const parsed = sessionSchema.safeParse(sessionToPayload(session));
  if (parsed.success) return null;

  const errors: SessionErrors = { entries: {} };
  for (const issue of parsed.error.issues) {
    const [head, entryIndex, field] = issue.path;
    if (head === "title") {
      errors.title = "Give this session a title of up to 120 characters.";
    } else if (head === "notes") {
      errors.notes = "Notes are too long.";
    } else if (head === "entries" && entryIndex === undefined) {
      errors.entriesLimit = "A session holds at most 60 exercises.";
    } else if (
      head === "entries" &&
      typeof entryIndex === "number" &&
      isEntryField(field)
    ) {
      const entry = sent[entryIndex];
      if (entry) {
        const entryErrors = (errors.entries[entry.id] ??= {});
        entryErrors[field] ??= fieldMessage(field, entry, units);
      }
    }
  }
  return errors;
}

/** Sessions that fail validation and so must not be sent. */
export function collectSaveBlockers(
  sessions: readonly ProgramSessionDTO[],
  units: UnitSystem,
): SaveBlockers {
  const bySession: Record<string, SessionErrors> = {};
  let entryCount = 0;
  let otherCount = 0;
  for (const session of sessions) {
    const errors = validateSession(session, units);
    if (!errors) continue;
    bySession[session.id] = errors;
    entryCount += Object.keys(errors.entries).length;
    otherCount +=
      (errors.title ? 1 : 0) +
      (errors.notes ? 1 : 0) +
      (errors.entriesLimit ? 1 : 0);
  }
  return { bySession, entryCount, otherCount };
}

/** Header text for sessions that cannot save, or null when none are blocked. */
export function saveBlockedLabel(blockers: SaveBlockers): string | null {
  const { entryCount, otherCount } = blockers;
  if (entryCount + otherCount === 0) return null;
  if (otherCount === 0) {
    return `Fix ${countLabel(entryCount, "entry", "entries")} to save`;
  }
  const total = entryCount + otherCount;
  return `Fix ${countLabel(total, "issue")} to save`;
}
