import { Link } from "@tanstack/react-router";
import { ArrowUpRight } from "lucide-react";
import { PublicProgramShell } from "#/components/programs/public-program-shell";
import { buttonVariants } from "#/components/ui/button";
import { useSession } from "#/lib/auth-client";
import { cn } from "#/lib/cn";
import { readNotFoundSuggestions } from "#/lib/programs/not-found-data";
import {
  goalDisplayLabel,
  levelDisplayLabel,
} from "#/lib/programs/display-labels";
import { publicProgramCanonicalPath } from "#/lib/programs/program-urls";

/** `data` is whatever the loader passed to notFound(); only author suggestions are read. */
export function ProgramNotFound({ data }: { data?: unknown }) {
  const { data: session } = useSession();
  const suggestions = readNotFoundSuggestions(data);
  const signedIn = Boolean(session?.user);

  return (
    <PublicProgramShell>
      <main className="mx-auto max-w-xl px-4 py-12 sm:py-16">
        <p className="m-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          404
        </p>
        <h1 className="mt-2 font-display text-4xl leading-tight text-balance text-foreground">
          This program isn&apos;t here
        </h1>
        <p className="mt-4 text-sm leading-relaxed text-text-secondary">
          The link may be mistyped, or it no longer opens a program.
          {suggestions
            ? null
            : " If someone sent it to you, ask them for a new link."}
        </p>

        {suggestions ? (
          <section className="mt-8" aria-labelledby="author-programs">
            <h2
              id="author-programs"
              className="m-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              Public programs by {suggestions.displayName}
            </h2>
            <ul className="m-0 mt-3 flex list-none flex-col gap-2 p-0">
              {suggestions.programs.map((program) => (
                <li key={program.id}>
                  <Link
                    to={publicProgramCanonicalPath(
                      suggestions.authorSlug,
                      program.slug,
                    )}
                    className="flex min-h-14 items-center gap-3 rounded-xl border border-border bg-card px-4 py-2 no-underline hover:bg-muted/40"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold break-words text-foreground">
                        {program.title}
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        {goalDisplayLabel(program.goal)} ·{" "}
                        {levelDisplayLabel(program.level)} · {program.weeks}{" "}
                        weeks
                      </span>
                    </span>
                    <ArrowUpRight
                      className="size-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                  </Link>
                </li>
              ))}
            </ul>
            <Link
              to="/u/$authorSlug"
              params={{ authorSlug: suggestions.authorSlug }}
              className={cn(
                buttonVariants({ variant: "link", size: "touch" }),
                "mt-3 px-0 text-brand-text",
              )}
            >
              View {suggestions.displayName}&apos;s profile
            </Link>
          </section>
        ) : (
          <Link
            to={signedIn ? "/programs" : "/"}
            className={cn(
              buttonVariants({ variant: "outline", size: "touch" }),
              "mt-8",
            )}
          >
            {signedIn ? "Go to your programs" : "Go to physlane"}
          </Link>
        )}
      </main>
    </PublicProgramShell>
  );
}
