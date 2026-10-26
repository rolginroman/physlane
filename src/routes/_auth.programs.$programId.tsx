import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ProgramEditor } from "#/components/programs/program-editor";
import {
  ProgramEditorPending,
  programRouteError,
} from "#/components/programs/program-route-states";
import { getViewer } from "#/lib/auth-guard.fns";
import { getMyProgram } from "#/server/programs.fns";

const editorSearchSchema = z.object({
  forked: z.coerce.boolean().optional(),
});

export const Route = createFileRoute("/_auth/programs/$programId")({
  validateSearch: (search) => editorSearchSchema.parse(search),
  head: () => ({ meta: [{ title: "Program editor · physlane" }] }),
  // ProgramEditor seeds local state from the loader once, so a cached match
  // must never render ahead of a fresh load (default is stale-while-revalidate).
  loader: {
    staleReloadMode: "blocking",
    handler: async ({ params }) => {
      const [program, viewer] = await Promise.all([
        getMyProgram({ data: { programId: params.programId } }),
        getViewer(),
      ]);
      if (!program.sessions || !program.exercises) {
        throw new Error("PROGRAM_NOT_FOUND");
      }
      return {
        program: {
          ...program,
          sessions: program.sessions,
          exercises: program.exercises,
        },
        unitSystem: viewer?.unitSystem ?? "metric",
      };
    },
  },
  pendingComponent: ProgramEditorPending,
  errorComponent: programRouteError,
  component: ProgramEditorPage,
});

function ProgramEditorPage() {
  const { program, unitSystem } = Route.useLoaderData();
  const { forked } = Route.useSearch();
  return (
    <ProgramEditor
      initial={program}
      showForkBanner={Boolean(forked)}
      unitSystem={unitSystem}
    />
  );
}
