import { useSession } from "#/lib/auth-client";
import { ProgramView } from "#/components/programs/program-view";
import type { PublicProgramDTO } from "#/server/programs.fns";

export function PublicProgramPage({
  program,
  variant,
}: {
  program: PublicProgramDTO;
  variant: "public" | "unlisted";
}) {
  const { data: session } = useSession();
  return (
    <ProgramView
      program={program}
      variant={variant}
      viewerUserId={session?.user?.id ?? null}
    />
  );
}
