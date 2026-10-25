import { Link } from "@tanstack/react-router";
import { Link2 } from "lucide-react";
import { useMemo, useState } from "react";
import {
  ExerciseDrawer,
  type ExerciseDrawerTarget,
} from "#/components/programs/exercise-drawer";
import { ProgramForkActions } from "#/components/programs/program-fork-actions";
import { ProgramOwnerBar } from "#/components/programs/program-owner-bar";
import { ReportProgramButton } from "#/components/programs/program-report";
import { SessionAccordion } from "#/components/programs/program-view-session";
import { PublicProgramShell } from "#/components/programs/public-program-shell";
import { buttonVariants } from "#/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs";
import { cn } from "#/lib/cn";
import {
  equipmentDisplayLabel,
  goalDisplayLabel,
  levelDisplayLabel,
} from "#/lib/programs/display-labels";
import { totalSets } from "#/lib/programs/sets-by-region";
import type { PublicProgramDTO } from "#/server/programs.fns";

export type ProgramViewProps = {
  program: PublicProgramDTO;
  variant: "public" | "unlisted";
  viewerUserId?: string | null;
  returnPath: string;
  pendingCopyIntent?: boolean;
};

function equipmentLine(tags: PublicProgramDTO["equipmentTags"]): string {
  if (tags.length === 0) {
    return "";
  }
  return tags.map((t) => equipmentDisplayLabel(t).toLowerCase()).join(", ");
}

function FactChip({
  children,
  numeric = false,
}: {
  children: React.ReactNode;
  numeric?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex min-h-7 items-center rounded-md border border-border bg-card px-2.5 text-sm font-medium text-text-secondary",
        numeric && "tabular-nums",
      )}
    >
      {children}
    </span>
  );
}

function AuthorAvatar({ name }: { name: string }) {
  return (
    <span
      className="flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-xs font-semibold"
      aria-hidden
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function AuthorCard({
  name,
  bio,
  authorSlug,
  isOwner,
  className,
}: {
  name: string;
  bio: string | null;
  authorSlug: string;
  isOwner: boolean;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-border bg-card p-4",
        className,
      )}
      aria-label="Author"
    >
      <p className="m-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Author
      </p>
      <div className="flex min-w-0 items-center gap-3">
        <AuthorAvatar name={name} />
        <strong className="min-w-0 text-sm font-semibold break-words text-foreground">
          {name}
        </strong>
      </div>
      {bio ? <p className="m-0 text-sm text-text-secondary">{bio}</p> : null}
      <Link
        to="/u/$authorSlug"
        params={{ authorSlug }}
        className={cn(
          buttonVariants({ variant: "outline", size: "touch" }),
          "w-full",
        )}
      >
        {isOwner ? "View your profile" : `View ${name}'s profile`}
      </Link>
    </section>
  );
}

export function ProgramView({
  program,
  variant,
  viewerUserId,
  returnPath,
  pendingCopyIntent = false,
}: ProgramViewProps) {
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [drawer, setDrawer] = useState<ExerciseDrawerTarget | null>(null);
  const authorName = program.author.displayName ?? "Author";
  const equipment = equipmentLine(program.equipmentTags);
  // Unlisted views never link out: an unlisted-only author has no profile.
  const profileSlug =
    variant === "public" && program.author.hasPublicProfile
      ? (program.author.authorSlug ?? null)
      : null;

  const weekSessions = useMemo(
    () =>
      program.sessions
        .filter((s) => s.weekNumber === selectedWeek)
        .sort((a, b) => a.orderIndex - b.orderIndex),
    [program.sessions, selectedWeek],
  );

  const isOwner =
    viewerUserId != null && viewerUserId === program.author.userId;

  return (
    <PublicProgramShell>
      {isOwner ? (
        <ProgramOwnerBar program={program} variant={variant} />
      ) : variant === "unlisted" ? (
        <div
          className="flex items-start gap-3 border-b border-border bg-muted px-4 py-3 text-sm leading-snug sm:px-8"
          role="note"
        >
          <Link2 className="mt-0.5 size-4.5 shrink-0" aria-hidden />
          <p className="m-0">
            Opened with a share link. This program isn&apos;t listed publicly.
          </p>
        </div>
      ) : null}

      <main className="mx-auto max-w-3xl px-4 pb-12 sm:px-8 lg:max-w-6xl">
        <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-14">
          <div className="min-w-0">
            <section className="py-6 sm:py-10" aria-labelledby="program-title">
              <p className="m-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Program
              </p>
              <h1
                id="program-title"
                className="mt-2 font-display text-4xl leading-tight text-balance break-words text-foreground sm:text-5xl"
              >
                {program.title}
              </h1>
              <p className="mt-3 flex min-h-11 items-center gap-2 text-sm text-text-secondary">
                <AuthorAvatar name={authorName} />
                <span className="min-w-0 break-words">
                  by{" "}
                  {profileSlug ? (
                    <Link
                      to="/u/$authorSlug"
                      params={{ authorSlug: profileSlug }}
                      className="font-semibold text-foreground underline decoration-border underline-offset-4"
                    >
                      {authorName}
                    </Link>
                  ) : (
                    <strong className="font-semibold text-foreground">
                      {authorName}
                    </strong>
                  )}
                </span>
              </p>
              <div className="mt-4 flex flex-wrap gap-1.5">
                <FactChip>{goalDisplayLabel(program.goal)}</FactChip>
                <FactChip>{levelDisplayLabel(program.level)}</FactChip>
                <FactChip numeric>
                  {program.daysPerWeek} sessions / week
                </FactChip>
                <FactChip numeric>{program.weeks} weeks</FactChip>
              </div>
              {equipment ? (
                <p className="mt-3 text-sm text-muted-foreground">
                  Equipment: {equipment}
                </p>
              ) : null}
              {program.description ? (
                <p className="mt-4 max-w-prose text-base leading-relaxed break-words text-text-secondary">
                  {program.description}
                </p>
              ) : null}
              {program.forkSourceLabel ? (
                <p className="mt-2 text-sm break-words text-muted-foreground">
                  Based on {program.forkSourceLabel}
                </p>
              ) : null}
            </section>

            <Tabs
              value={selectedWeek}
              onValueChange={(week) => setSelectedWeek(Number(week))}
              className="gap-0"
            >
              {program.weeks > 1 ? (
                <div className="-mx-4 sm:mx-0">
                  <TabsList
                    variant="line"
                    aria-label="Weeks"
                    className="px-4 sm:px-0"
                  >
                    {Array.from({ length: program.weeks }, (_, i) => i + 1).map(
                      (w) => (
                        <TabsTrigger key={w} value={w}>
                          Week {w}
                        </TabsTrigger>
                      ),
                    )}
                  </TabsList>
                </div>
              ) : null}

              <div className="flex items-center justify-between gap-3 py-3 text-sm tabular-nums text-muted-foreground">
                <span>
                  {program.weeks > 1
                    ? `Week ${selectedWeek} of ${program.weeks}`
                    : null}
                  {weekSessions.length > 0
                    ? `${program.weeks > 1 ? " · " : ""}${weekSessions.length} session${weekSessions.length === 1 ? "" : "s"}`
                    : null}
                </span>
                {weekSessions.length > 0 ? (
                  <span>{totalSets(weekSessions)} sets</span>
                ) : null}
              </div>

              <TabsContent value={selectedWeek}>
                {weekSessions.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="m-0 font-semibold text-foreground">
                      No sessions in week {selectedWeek}
                    </p>
                    <p className="mt-1 mb-0 text-sm text-muted-foreground">
                      The author hasn&apos;t added sessions to this week.
                    </p>
                  </div>
                ) : (
                  <div className="border-b border-border">
                    {weekSessions.map((session, index) => (
                      <SessionAccordion
                        key={session.id}
                        session={session}
                        exercises={program.exercises}
                        defaultOpen={index === 0}
                        onOpenEntry={setDrawer}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>

            {profileSlug ? (
              <AuthorCard
                name={authorName}
                bio={program.author.bio}
                authorSlug={profileSlug}
                isOwner={isOwner}
                className="mt-8 lg:hidden"
              />
            ) : null}
          </div>

          <aside className="sticky bottom-0 z-10 -mx-4 sm:-mx-8 lg:top-6 lg:bottom-auto lg:mx-0 lg:self-start lg:pt-10">
            <ProgramForkActions
              programId={program.id}
              programTitle={program.title}
              authorName={authorName}
              shareToken={program.shareToken}
              forkable={program.forkable}
              isOwner={isOwner}
              isSignedIn={viewerUserId != null}
              returnPath={returnPath}
              pendingCopyIntent={pendingCopyIntent}
            />
            {profileSlug ? (
              <AuthorCard
                name={authorName}
                bio={program.author.bio}
                authorSlug={profileSlug}
                isOwner={isOwner}
                className="hidden lg:mt-3 lg:flex"
              />
            ) : null}
          </aside>
        </div>

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4 text-sm text-muted-foreground">
          Shared on physlane
          {isOwner ? null : <ReportProgramButton programId={program.id} />}
        </footer>
      </main>

      <ExerciseDrawer
        target={drawer}
        authorName={authorName}
        onClose={() => setDrawer(null)}
      />
    </PublicProgramShell>
  );
}
