import { fmtWeight, type UnitSystem } from "#/lib/units";
import type { ProgramEntryDTO } from "#/server/programs.fns";

export function formatEntryReps(entry: ProgramEntryDTO): string {
  if (entry.repsType === "max") {
    return "max";
  }
  if (entry.repsType === "seconds") {
    return `${entry.repsValue ?? 0} s`;
  }
  return String(entry.repsValue ?? 0);
}

export function formatEntrySetsReps(entry: ProgramEntryDTO): string {
  return `${entry.sets} × ${formatEntryReps(entry)}`;
}

export function formatEntryLoad(
  entry: ProgramEntryDTO,
  units: UnitSystem = "metric",
): string | null {
  if (entry.loadType === "none" || entry.loadValue == null) {
    return null;
  }
  if (entry.loadType === "percent1rm") {
    return `${entry.loadValue}% 1RM`;
  }
  return fmtWeight(entry.loadValue, units);
}

export function formatEntryIntensity(entry: ProgramEntryDTO): string | null {
  if (entry.intensityType === "none" || entry.intensityValue == null) {
    return null;
  }
  if (entry.intensityType === "rpe") {
    return `RPE ${entry.intensityValue}`;
  }
  return `RIR ${entry.intensityValue}`;
}

export function formatRestSeconds(seconds: number | null): string | null {
  if (seconds == null || seconds <= 0) {
    return null;
  }
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `Rest ${m}:${s.toString().padStart(2, "0")}`;
}
