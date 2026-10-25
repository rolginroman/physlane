import type { Equipment, Muscle } from "#/lib/programs/taxonomy";

export type ExerciseSearchRow = {
  name: string;
  aliases: string[];
  musclePrimary: Muscle;
  muscleSecondary: Muscle[];
  equipment: Equipment;
};

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
  },
): T[] {
  return rows.filter((row) => {
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
