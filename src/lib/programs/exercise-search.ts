import {
  MUSCLE_GROUPS,
  type Equipment,
  type Muscle,
  type MuscleRegion,
} from "#/lib/programs/taxonomy";

export type ExerciseSearchRow = {
  name: string;
  aliases: string[];
  musclePrimary: Muscle;
  muscleSecondary: Muscle[];
  equipment: Equipment;
  /** Null or absent for catalog rows; set for user-created exercises. */
  ownerUserId?: string | null;
};

export type ExerciseSearchSource = "all" | "mine";

export function exerciseSearchRank(
  row: Pick<ExerciseSearchRow, "name" | "aliases">,
  query: string,
): number | null {
  const q = query.trim().toLowerCase();
  if (!q) {
    return 2;
  }
  const name = row.name.toLowerCase();
  if (name.startsWith(q)) {
    return 0;
  }
  if (name.includes(q)) {
    return 1;
  }
  for (const alias of row.aliases) {
    if (alias.toLowerCase().includes(q)) {
      return 2;
    }
  }
  return null;
}

export function filterExercisesForSearch<T extends ExerciseSearchRow>(
  rows: readonly T[],
  options: {
    query: string;
    equipment?: Equipment;
    muscle?: Muscle;
    region?: MuscleRegion;
    source?: ExerciseSearchSource;
  },
): T[] {
  const regionMuscles: readonly Muscle[] | null = options.region
    ? MUSCLE_GROUPS[options.region]
    : null;
  return rows.filter((row) => {
    if (options.source === "mine" && row.ownerUserId == null) {
      return false;
    }
    if (regionMuscles) {
      const hitsRegion =
        regionMuscles.includes(row.musclePrimary) ||
        row.muscleSecondary.some((m) => regionMuscles.includes(m));
      if (!hitsRegion) {
        return false;
      }
    }
    if (options.equipment && row.equipment !== options.equipment) {
      return false;
    }
    if (options.muscle) {
      const hitsPrimary = row.musclePrimary === options.muscle;
      const hitsSecondary = row.muscleSecondary.includes(options.muscle);
      if (!hitsPrimary && !hitsSecondary) {
        return false;
      }
    }
    return exerciseSearchRank(row, options.query) !== null;
  });
}

export function rankExercisesForSearch<T extends ExerciseSearchRow>(
  rows: readonly T[],
  query: string,
  limit = 50,
): T[] {
  return [...rows]
    .map((row) => ({
      row,
      rank: exerciseSearchRank(row, query) ?? 2,
    }))
    .sort((a, b) => {
      if (a.rank !== b.rank) {
        return a.rank - b.rank;
      }
      return a.row.name.localeCompare(b.row.name);
    })
    .slice(0, limit)
    .map(({ row }) => row);
}
