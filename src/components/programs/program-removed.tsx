import { Link } from "@tanstack/react-router";
import { buttonVariants } from "#/components/ui/button";
import { cn } from "#/lib/cn";
import { PublicProgramShell } from "#/components/programs/public-program-shell";
import type { PublicProgramRemovalDTO } from "#/server/programs.fns";

export function ProgramRemovedPage({
  removal,
}: {
  removal: PublicProgramRemovalDTO;
}) {
  const isAuthor = removal.variant === "author";
  const title = isAuthor
    ? "Removed by its author"
    : "This program isn't available";
  const body = isAuthor
    ? "This program is no longer available. Copies people made before it was removed are theirs and still work."
    : "It can't be viewed right now.";

  const showProfileLink =
    isAuthor &&
    removal.hasPublicProfile &&
    removal.authorSlug &&
    removal.authorDisplayName;

  return (
    <PublicProgramShell>
      <main className="mx-auto max-w-lg px-4 py-16 sm:px-8">
        <h1 className="m-0 font-display text-4xl leading-tight text-foreground">
          {title}
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-text-secondary">
          {body}
        </p>
        {showProfileLink ? (
          <Link
            to="/u/$authorSlug"
            params={{ authorSlug: removal.authorSlug! }}
            className={cn(
              buttonVariants({ variant: "link", size: "touch" }),
              "mt-6 px-0 text-brand-text",
            )}
          >
            See {removal.authorDisplayName}'s public programs
          </Link>
        ) : (
          <Link
            to="/"
            className={cn(
              buttonVariants({ variant: "outline", size: "touch" }),
              "mt-6",
            )}
          >
            Go to physlane
          </Link>
        )}
      </main>
    </PublicProgramShell>
  );
}
