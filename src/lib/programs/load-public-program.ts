import { notFound } from "@tanstack/react-router";
import type { PublicProgramRemovalDTO } from "#/server/programs.fns";
import { getPublicProgramRemoval } from "#/server/programs.fns";

export async function loadPublicProgramOrNotFound<T>(
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof Error) {
      if (e.message === "PROGRAM_NOT_FOUND") {
        throw notFound();
      }
      if (
        e.message === "PROGRAM_REMOVED" ||
        e.message === "PROGRAM_UNAVAILABLE"
      ) {
        throw e;
      }
    }
    throw e;
  }
}

export async function loadPublicProgramRemovalForProgram(
  programId: string,
): Promise<PublicProgramRemovalDTO> {
  return getPublicProgramRemoval({ data: { programId } });
}
