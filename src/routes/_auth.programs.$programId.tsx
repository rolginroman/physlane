import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ProgramEditor } from "#/components/programs/program-editor";
import { getViewer } from "#/lib/auth-guard.fns";
import { getMyProgram } from "#/server/programs.fns";

const editorSearchSchema = z.object({
  forked: z.coerce.boolean().optional(),
});

export const Route = createFileRoute("/_auth/programs/$programId")({
  validateSearch: (search) => editorSearchSchema.parse(search),
  head: () => ({ meta: [{ title: "Program editor · physlane" }] }),
  loader: async ({ params }) => {
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
