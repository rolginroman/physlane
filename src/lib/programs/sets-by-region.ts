import {
  exerciseRegions,
  MUSCLE_REGIONS,
  type Muscle,
  type MuscleRegion,
} from "./taxonomy";

export type RegionSets = { region: MuscleRegion; sets: number };

type CountedEntry = { exerciseId: string; sets: number };
type PrimaryMuscleOf = Record<string, { musclePrimary: Muscle } | undefined>;

/** Sets per body region by primary muscle, biggest first; unknown exercises are skipped. */
export function setsByRegion(
  entries: readonly CountedEntry[],
  exercises: PrimaryMuscleOf,
): RegionSets[] {
  const totals = new Map<MuscleRegion, number>();
  for (const entry of entries) {
    const exercise = exercises[entry.exerciseId];
    if (!exercise) continue;
    const [region] = exerciseRegions(exercise.musclePrimary, []);
    if (!region) continue;
    totals.set(region, (totals.get(region) ?? 0) + entry.sets);
  }
  return MUSCLE_REGIONS.flatMap((region) => {
    const sets = totals.get(region);
    return sets ? [{ region, sets }] : [];
  }).sort((a, b) => b.sets - a.sets);
}

export function totalSets(
  sessions: readonly { entries: readonly CountedEntry[] }[],
): number {
  let sets = 0;
  for (const session of sessions) {
    for (const entry of session.entries) sets += entry.sets;
  }
  return sets;
}
