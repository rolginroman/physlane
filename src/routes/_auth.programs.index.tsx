import { createFileRoute } from "@tanstack/react-router";
import {
  ProgramLibrary,
  ProgramLibraryPending,
  loadProgramLibrary,
} from "#/components/programs/program-library";
import { programListRouteError } from "#/components/programs/program-route-states";

export const Route = createFileRoute("/_auth/programs/")({
  head: () => ({ meta: [{ title: "Programs · physlane" }] }),
  loader: async () => {
    try {
      const { programs, authorSlug } = await loadProgramLibrary();
      return { programs, authorSlug, loadError: false };
    } catch {
      return { programs: [], authorSlug: null, loadError: true };
    }
  },
  pendingComponent: ProgramLibraryPending,
  errorComponent: programListRouteError,
  component: ProgramsIndexPage,
});

function ProgramsIndexPage() {
  const { programs, authorSlug, loadError } = Route.useLoaderData();
  return (
    <ProgramLibrary
      programs={programs}
      authorSlug={authorSlug}
      loadError={loadError}
    />
  );
}
