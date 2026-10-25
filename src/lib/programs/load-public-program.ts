import { notFound } from "@tanstack/react-router";

export async function loadPublicProgramOrNotFound<T>(
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof Error && e.message === "PROGRAM_NOT_FOUND") {
      throw notFound();
    }
    throw e;
  }
}
