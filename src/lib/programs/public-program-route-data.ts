import { notFound } from "@tanstack/react-router";
import type {
  PublicProgramDTO,
  PublicProgramRemovalDTO,
} from "#/server/programs.fns";

export type PublicProgramRouteData =
  | {
      kind: "program";
      program: PublicProgramDTO;
      variant: "public" | "unlisted";
    }
  | { kind: "removed"; removal: PublicProgramRemovalDTO };

export function unwrapPublicProgramRouteData(
  data: PublicProgramRouteData,
): PublicProgramDTO {
  if (data.kind === "removed") {
    throw notFound();
  }
  return data.program;
}
