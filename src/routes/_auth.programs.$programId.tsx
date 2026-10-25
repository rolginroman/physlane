import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { ProgramEditor } from "#/components/programs/program-editor";
import { getMyProgram } from "#/server/programs.fns";

const editorSearchSchema = z.object({
  forked: z.coerce.boolean().optional(),
});

export const Route = createFileRoute("/_auth/programs/$programId")({
  validateSearch: (search) => editorSearchSchema.parse(search),
  head: () => ({ meta: [{ title: "Program editor · physlane" }] }),
  loader: async ({ params }) => {
    const program = await getMyProgram({
      data: { programId: params.programId },
    });
    if (!program.sessions || !program.exercises) {
      throw new Error("PROGRAM_NOT_FOUND");
    }
    return {
      program: {
        ...program,
        sessions: program.sessions,
        exercises: program.exercises,
      },
    };
  },
  component: ProgramEditorPage,
});

function ProgramEditorPage() {
  const { program } = Route.useLoaderData();
  const { forked } = Route.useSearch();
  return <ProgramEditor initial={program} showForkBanner={Boolean(forked)} />;
}
