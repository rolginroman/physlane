export const MUSCLES = [
  "chest",
  "upper-chest",
  "lats",
  "traps",
  "rhomboids",
  "lower-back",
  "front-delts",
  "side-delts",
  "rear-delts",
  "biceps",
  "brachialis",
  "triceps",
  "forearms",
  "abs",
  "obliques",
  "serratus-anterior",
  "glutes",
  "adductors",
  "abductors",
  "hip-flexors",
  "quads",
  "hamstrings",
  "calves",
  "tibialis-anterior",
  "neck",
] as const;

export const MUSCLE_GROUPS = {
  chest: ["chest", "upper-chest"],
  back: ["lats", "traps", "rhomboids", "lower-back"],
  shoulders: ["front-delts", "side-delts", "rear-delts"],
  arms: ["biceps", "brachialis", "triceps", "forearms"],
  core: ["abs", "obliques", "serratus-anterior"],
  hips: ["glutes", "adductors", "abductors", "hip-flexors"],
  legs: ["quads", "hamstrings", "calves", "tibialis-anterior"],
  neck: ["neck"],
} as const;

export const MUSCLE_REGIONS = [
  "chest",
  "back",
  "shoulders",
  "arms",
  "core",
  "hips",
  "legs",
  "neck",
] as const satisfies readonly (keyof typeof MUSCLE_GROUPS)[];

export const EQUIPMENT = [
  "barbell",
  "dumbbell",
  "machine",
  "cable",
  "bodyweight",
  "kettlebell",
  "band",
  "other",
] as const;

export const PROGRAM_GOALS = [
  "strength",
  "hypertrophy",
  "fat-loss",
  "general",
] as const;

export const PROGRAM_LEVELS = ["beginner", "intermediate", "advanced"] as const;

export type Muscle = (typeof MUSCLES)[number];
export type MuscleRegion = keyof typeof MUSCLE_GROUPS;
export type Equipment = (typeof EQUIPMENT)[number];
export type ProgramGoal = (typeof PROGRAM_GOALS)[number];
export type ProgramLevel = (typeof PROGRAM_LEVELS)[number];

const muscleToRegion = new Map<Muscle, MuscleRegion>();
for (const [region, muscles] of Object.entries(MUSCLE_GROUPS) as [
  MuscleRegion,
  readonly Muscle[],
][]) {
  for (const muscle of muscles) {
    muscleToRegion.set(muscle, region);
  }
}

/** Body regions implied by primary + secondary muscles (derived, not stored). */
export function exerciseRegions(
  musclePrimary: Muscle,
  muscleSecondary: readonly Muscle[],
): MuscleRegion[] {
  const seen = new Set<MuscleRegion>();
  const add = (muscle: Muscle) => {
    const region = muscleToRegion.get(muscle);
    if (region) seen.add(region);
  };
  add(musclePrimary);
  for (const m of muscleSecondary) add(m);
  return [...seen];
}

/** Hyphenated muscle id → display label (e.g. upper-chest → Upper chest). */
export function muscleDisplayLabel(muscle: Muscle): string {
  const parts = muscle.split("-");
  const head = parts[0] ?? "";
  const tail = parts.slice(1);
  const label = head.charAt(0).toUpperCase() + head.slice(1);
  if (tail.length === 0) return label;
  return `${label} ${tail.join(" ")}`;
}

export function regionDisplayLabel(region: MuscleRegion): string {
  return region.charAt(0).toUpperCase() + region.slice(1);
}
