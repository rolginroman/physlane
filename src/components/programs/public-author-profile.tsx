import { Link } from "@tanstack/react-router";
import { Flag, Globe, Pencil } from "lucide-react";
import { useState } from "react";
import { PublicProgramShell } from "#/components/programs/public-program-shell";
import { ReportSheet } from "#/components/programs/report-sheet";
import { Button, buttonVariants } from "#/components/ui/button";
import { cn } from "#/lib/cn";
import {
  goalDisplayLabel,
  levelDisplayLabel,
  programMetaLine,
} from "#/lib/programs/display-labels";
import { publicProgramCanonicalPath } from "#/lib/programs/program-urls";
import {
  reportProfile,
  type PublicAuthorProfileDTO,
} from "#/server/programs.fns";

type PublicAuthorProfileProps = {
  profile: PublicAuthorProfileDTO;
  onEditProfile?: () => void;
};

export function PublicAuthorProfile({
  profile,
  onEditProfile,
}: PublicAuthorProfileProps) {
  const [reportOpen, setReportOpen] = useState(false);
  const initial = profile.displayName.slice(0, 1).toUpperCase();

  if (profile.unavailable) {
    return (
      <PublicProgramShell>
        <main className="mx-auto max-w-lg px-4 py-16 sm:px-8">
          <h1 className="m-0 font-display text-4xl leading-tight text-foreground">
            This profile is unavailable
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-text-secondary">
            It can&apos;t be viewed right now.
          </p>
          <Link
            to="/"
            className={cn(
              buttonVariants({ variant: "outline", size: "touch" }),
              "mt-6",
            )}
          >
            Go to physlane
          </Link>
        </main>
      </PublicProgramShell>
    );
  }

  return (
    <PublicProgramShell>
      {profile.isOwner ? (
        <div className="flex min-h-13 flex-wrap items-center gap-2 border-b border-border bg-muted px-4 py-2 sm:px-8">
          <Globe className="size-4 text-text-secondary" aria-hidden />
          <span className="flex-1 text-sm text-foreground">
            Your public profile
          </span>
          <ButtonEditProfile onClick={onEditProfile} />
        </div>
      ) : null}

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
        <section className="flex flex-col gap-6 sm:flex-row sm:items-start">
          <span
            className="flex size-18 shrink-0 items-center justify-center rounded-full border border-border bg-muted font-display text-3xl text-text-secondary"
            aria-hidden
          >
            {initial}
          </span>
          <div className="min-w-0 flex-1 space-y-3">
            <h1 className="font-display text-4xl tracking-tight text-foreground">
              {profile.displayName}
            </h1>
            {profile.bio ? (
              <p className="max-w-2xl text-base leading-relaxed text-text-secondary">
                {profile.bio}
              </p>
            ) : null}
          </div>
        </section>

        <div className="mt-10 flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-semibold text-foreground">
            Public programs
          </h2>
          {profile.programs.length > 0 ? (
            <span className="text-sm tabular-nums text-muted-foreground">
              {profile.programs.length}
            </span>
          ) : null}
        </div>

        {profile.programs.length === 0 ? (
          <p className="mt-6 rounded-xl border border-border bg-card p-8 text-center text-text-secondary">
            {profile.displayName} has no public programs right now.
          </p>
        ) : (
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {profile.programs.map((program) => (
              <li key={program.id}>
                <Link
                  to={publicProgramCanonicalPath(
                    profile.authorSlug,
                    program.slug,
                  )}
                  className="flex min-h-11 flex-col gap-2 rounded-xl border border-border bg-card p-4 no-underline transition-colors hover:border-primary/30 hover:bg-muted/40"
                >
                  <span className="font-semibold break-words text-foreground">
                    {program.title}
                  </span>
                  {program.description ? (
                    <span className="line-clamp-2 text-sm text-text-secondary">
                      {program.description}
                    </span>
                  ) : null}
                  <span className="flex flex-wrap gap-2 pt-1">
                    <span className="rounded-md border border-border bg-background px-2.5 py-0.5 text-xs font-medium text-text-secondary">
                      {goalDisplayLabel(program.goal)}
                    </span>
                    <span className="rounded-md border border-border bg-background px-2.5 py-0.5 text-xs font-medium text-text-secondary">
                      {levelDisplayLabel(program.level)}
                    </span>
                    <span className="rounded-md border border-border bg-background px-2.5 py-0.5 text-xs font-medium text-text-secondary">
                      {program.daysPerWeek} / week
                    </span>
                    <span className="rounded-md border border-border bg-background px-2.5 py-0.5 text-xs font-medium text-text-secondary">
                      {program.weeks} weeks
                    </span>
                  </span>
                  <span className="sr-only">{programMetaLine(program)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}

        {profile.isOwner ? (
          <p className="mt-8 text-sm text-text-secondary">
            Only public programs appear here. Drafts and unlisted programs stay
            in{" "}
            <Link to="/programs" className="font-medium text-primary underline">
              Programs
            </Link>
            .
          </p>
        ) : (
          <footer className="mt-12 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-sm text-muted-foreground">
            Shared on physlane
            <Button
              type="button"
              variant="link"
              size="touch"
              className="text-xs text-muted-foreground"
              onClick={() => setReportOpen(true)}
            >
              <Flag className="size-3.5" aria-hidden />
              Report this profile
            </Button>
          </footer>
        )}
      </main>
      {profile.isOwner ? null : (
        <ReportSheet
          open={reportOpen}
          onOpenChange={setReportOpen}
          title="Report this profile"
          onSubmit={(reason) =>
            reportProfile({
              data: { authorSlug: profile.authorSlug, reason },
            })
          }
        />
      )}
    </PublicProgramShell>
  );
}

function ButtonEditProfile({ onClick }: { onClick?: () => void }) {
  return (
    <Button type="button" variant="outline" size="touch" onClick={onClick}>
      <Pencil className="size-4" aria-hidden />
      Edit profile
    </Button>
  );
}
