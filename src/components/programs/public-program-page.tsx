import { useSession } from "#/lib/auth-client";
import { ProgramView } from "#/components/programs/program-view";
import type { UnitSystem } from "#/lib/units";
import type { PublicProgramDTO } from "#/server/programs.fns";

export function PublicProgramPage({
  program,
  variant,
  unitSystem,
  returnPath,
  pendingCopyIntent,
}: {
  program: PublicProgramDTO;
  variant: "public" | "unlisted";
  unitSystem: UnitSystem;
  returnPath: string;
  pendingCopyIntent?: boolean;
}) {
  const { data: session } = useSession();
  return (
    <ProgramView
      program={program}
      variant={variant}
      unitSystem={unitSystem}
      viewerUserId={session?.user?.id ?? null}
      returnPath={returnPath}
      pendingCopyIntent={pendingCopyIntent}
    />
  );
}
