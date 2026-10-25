import { createFileRoute } from "@tanstack/react-router";
import {
  ProgramLibrary,
  loadProgramLibrary,
} from "#/components/programs/program-library";

export const Route = createFileRoute("/_auth/programs/")({
  head: () => ({ meta: [{ title: "Programs · physlane" }] }),
  loader: async () => {
    try {
      const programs = await loadProgramLibrary();
      return { programs, loadError: false };
    } catch {
      return { programs: [], loadError: true };
    }
  },
  component: ProgramsIndexPage,
});

function ProgramsIndexPage() {
  const { programs, loadError } = Route.useLoaderData();
  return <ProgramLibrary programs={programs} loadError={loadError} />;
}
