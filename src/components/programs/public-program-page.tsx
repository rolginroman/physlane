import { useSession } from "#/lib/auth-client";
import { ProgramView } from "#/components/programs/program-view";
import type { PublicProgramDTO } from "#/server/programs.fns";

export function PublicProgramPage({
  program,
  variant,
  returnPath,
  pendingCopyIntent,
}: {
  program: PublicProgramDTO;
  variant: "public" | "unlisted";
  returnPath: string;
  pendingCopyIntent?: boolean;
}) {
  const { data: session } = useSession();
  return (
    <ProgramView
      program={program}
      variant={variant}
      viewerUserId={session?.user?.id ?? null}
      returnPath={returnPath}
      pendingCopyIntent={pendingCopyIntent}
    />
  );
}
