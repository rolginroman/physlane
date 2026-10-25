import { createFileRoute } from "@tanstack/react-router";
import { ProgramEditor } from "#/components/programs/program-editor";
import { getMyProgram } from "#/server/programs.fns";

export const Route = createFileRoute("/_auth/programs/$programId")({
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
  return <ProgramEditor initial={program} />;
}
