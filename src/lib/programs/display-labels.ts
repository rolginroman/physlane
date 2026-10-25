import type {
  Equipment,
  ProgramGoal,
  ProgramLevel,
} from "#/lib/programs/taxonomy";
import {
  muscleDisplayLabel,
  regionDisplayLabel,
} from "#/lib/programs/taxonomy";
import type { Muscle, MuscleRegion } from "#/lib/programs/taxonomy";

export function goalDisplayLabel(goal: ProgramGoal): string {
  switch (goal) {
    case "strength":
      return "Strength";
    case "hypertrophy":
      return "Hypertrophy";
    case "fat-loss":
      return "Fat loss";
    case "general":
      return "General";
    default: {
      const _exhaustive: never = goal;
      return _exhaustive;
    }
  }
}

export function levelDisplayLabel(level: ProgramLevel): string {
  switch (level) {
    case "beginner":
      return "Beginner";
    case "intermediate":
      return "Intermediate";
    case "advanced":
      return "Advanced";
    default: {
      const _exhaustive: never = level;
      return _exhaustive;
    }
  }
}

export function equipmentDisplayLabel(equipment: Equipment): string {
  switch (equipment) {
    case "barbell":
      return "Barbell";
    case "dumbbell":
      return "Dumbbell";
    case "machine":
      return "Machine";
    case "cable":
      return "Cable";
    case "bodyweight":
      return "Bodyweight";
    case "kettlebell":
      return "Kettlebell";
    case "band":
      return "Band";
    case "other":
      return "Other";
    default: {
      const _exhaustive: never = equipment;
      return _exhaustive;
    }
  }
}

export function visibilityDisplayLabel(
  visibility: "draft" | "unlisted" | "public",
): string {
  switch (visibility) {
    case "draft":
      return "Draft";
    case "unlisted":
      return "Unlisted";
    case "public":
      return "Public";
    default: {
      const _exhaustive: never = visibility;
      return _exhaustive;
    }
  }
}

export function programMetaLine(meta: {
  goal: ProgramGoal;
  level: ProgramLevel;
  daysPerWeek: number;
  weeks: number;
}): string {
  return `${goalDisplayLabel(meta.goal)} · ${levelDisplayLabel(meta.level)} · ${meta.daysPerWeek} sessions / week · ${meta.weeks} weeks`;
}

export { muscleDisplayLabel, regionDisplayLabel };
export type { Muscle, MuscleRegion };
