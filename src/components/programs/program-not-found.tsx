import { Link } from "@tanstack/react-router";
import { buttonVariants } from "#/components/ui/button";
import { cn } from "#/lib/cn";
import { PublicProgramShell } from "#/components/programs/public-program-shell";

export function ProgramNotFound() {
  return (
    <PublicProgramShell>
      <main className="mx-auto max-w-xl px-4 py-12 sm:py-16">
        <p className="m-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Not found
        </p>
        <h1 className="mt-2 font-display text-4xl leading-tight text-balance text-foreground">
          This program isn&apos;t available
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-text-secondary">
          The link may have been replaced, or this program may be unlisted or
          removed. If someone sent you the link, ask them for a new one.
        </p>
        <Link
          to="/"
          className={cn(
            buttonVariants({ variant: "outline", size: "touch" }),
            "mt-8",
          )}
        >
          Go to physlane
        </Link>
      </main>
    </PublicProgramShell>
  );
}
