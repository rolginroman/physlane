import { Link } from "@tanstack/react-router";
import { ChevronDown, Link2 } from "lucide-react";
import { useMemo, useState } from "react";
import { PublicProgramShell } from "#/components/programs/public-program-shell";
import { buttonVariants } from "#/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "#/components/ui/tabs";
import { cn } from "#/lib/cn";
import { groupEntryBlocks } from "#/lib/programs/entry-ops";
import {
  equipmentDisplayLabel,
  goalDisplayLabel,
  levelDisplayLabel,
} from "#/lib/programs/display-labels";
import {
  formatEntryIntensity,
  formatEntryLoad,
  formatEntrySetsReps,
  formatRestSeconds,
} from "#/lib/programs/entry-display";
import { ProgramForkActions } from "#/components/programs/program-fork-actions";
import type {
  ProgramEntryDTO,
  ProgramSessionDTO,
  PublicProgramDTO,
} from "#/server/programs.fns";

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

function sessionSummary(session: ProgramSessionDTO): {
  exercises: number;
  sets: number;
} {
  let sets = 0;
  for (const entry of session.entries) {
    sets += entry.sets;
  }
  return { exercises: session.entries.length, sets };
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

function EntryBlock({
  entry,
  exerciseName,
}: {
  entry: ProgramEntryDTO;
  exerciseName: string;
}) {
  const load = formatEntryLoad(entry);
  const intensity = formatEntryIntensity(entry);
  const rest = formatRestSeconds(entry.restSeconds);

  return (
    <li className="rounded-lg border border-border bg-card px-3 pb-3 pt-1">
      <div className="flex min-h-11 items-center justify-between gap-2">
        <span className="font-semibold leading-snug text-foreground">
          {exerciseName}
        </span>
        {entry.refUrl ? (
          <a
            href={entry.refUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground underline decoration-border underline-offset-2"
          >
            <Link2 className="size-3.5" aria-hidden />
            Reference
          </a>
        ) : null}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums text-text-secondary">
        <span>
          <strong className="font-semibold text-foreground">
            {formatEntrySetsReps(entry)}
          </strong>
        </span>
        {load ? <span>{load}</span> : null}
        {intensity ? <span>{intensity}</span> : null}
        {rest ? <span>{rest}</span> : null}
      </div>
      {entry.cues ? (
        <p className="mt-1.5 text-sm text-text-secondary">
          <span className="text-muted-foreground">Cue: </span>
          {entry.cues}
        </p>
      ) : null}
    </li>
  );
}

function SessionAccordion({
  session,
  exercises,
  defaultOpen,
}: {
  session: ProgramSessionDTO;
  exercises: PublicProgramDTO["exercises"];
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const summary = sessionSummary(session);

  const blocks = useMemo(
    () => groupEntryBlocks(session.entries),
    [session.entries],
  );

  return (
    <div className="border-t border-border">
      <button
        type="button"
        className="flex w-full min-h-16 items-center gap-3 px-4 py-3 text-left sm:px-0"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-semibold leading-snug break-words">
            {session.title}
          </span>
          <span className="mt-0.5 block text-sm tabular-nums text-muted-foreground">
            {summary.exercises} exercises · {summary.sets} sets
          </span>
        </span>
        <ChevronDown
          className={cn(
            "size-4.5 shrink-0 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="px-4 pb-5 sm:px-0">
          {session.notes ? (
            <p className="mb-3 text-sm text-text-secondary">{session.notes}</p>
          ) : null}
          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {blocks.map((block, idx) => {
              if (block.kind === "single") {
                const name =
                  exercises[block.entry.exerciseId]?.name ?? "Exercise";
                return (
                  <EntryBlock
                    key={block.entry.id}
                    entry={block.entry}
                    exerciseName={name}
                  />
                );
              }
              return (
                <li
                  key={`group-${idx}`}
                  className="flex flex-col gap-2 border-l-2 border-chart-neutral pl-3"
                  aria-label={`Superset, ${block.items.length} exercises`}
                >
                  <p className="m-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Superset
                    <span className="font-normal normal-case tracking-normal text-muted-foreground">
                      {" "}
                      — back to back, rest after the last
                    </span>
                  </p>
                  <ol className="m-0 flex list-none flex-col gap-2 p-0">
                    {block.items.map(({ entry }) => (
                      <EntryBlock
                        key={entry.id}
                        entry={entry}
                        exerciseName={
                          exercises[entry.exerciseId]?.name ?? "Exercise"
                        }
                      />
                    ))}
                  </ol>
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}
    </div>
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
  const authorName = program.author.displayName ?? "Author";
  const equipment = equipmentLine(program.equipmentTags);
  const authorSlug =
    variant === "public" ? (program.author.authorSlug ?? null) : null;

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
      {variant === "unlisted" ? (
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

      {isOwner && variant === "public" ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted px-4 py-2 text-sm sm:px-8">
          <span className="flex-1">Your public program</span>
          <Link
            to="/programs/$programId"
            params={{ programId: program.id }}
            className={buttonVariants({ variant: "outline", size: "touch" })}
          >
            Edit
          </Link>
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
              <p className="mt-3 flex min-h-11 items-center gap-2 text-sm text-text-secondary lg:hidden">
                <AuthorAvatar name={authorName} />
                <span className="min-w-0 break-words">
                  by{" "}
                  {authorSlug ? (
                    <Link
                      to="/u/$authorSlug"
                      params={{ authorSlug }}
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

              <div className="flex items-center justify-between py-3 text-sm tabular-nums text-muted-foreground">
                <span>
                  {program.weeks > 1
                    ? `Week ${selectedWeek} of ${program.weeks}`
                    : null}
                  {weekSessions.length > 0
                    ? `${program.weeks > 1 ? " · " : ""}${weekSessions.length} session${weekSessions.length === 1 ? "" : "s"}`
                    : null}
                </span>
              </div>

              <TabsContent value={selectedWeek}>
                {weekSessions.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    (no sessions)
                  </p>
                ) : (
                  <div className="border-b border-border">
                    {weekSessions.map((session, index) => (
                      <SessionAccordion
                        key={session.id}
                        session={session}
                        exercises={program.exercises}
                        defaultOpen={index === 0}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>

          <aside className="sticky bottom-0 z-10 -mx-4 sm:-mx-8 lg:top-6 lg:bottom-auto lg:mx-0 lg:self-start lg:pt-10">
            <div className="hidden flex-col gap-3 rounded-xl border border-border bg-card p-4 lg:mb-3 lg:flex">
              <div className="flex min-w-0 items-center gap-3">
                <AuthorAvatar name={authorName} />
                <span className="min-w-0 text-sm break-words">
                  <span className="block text-xs text-muted-foreground">
                    Program by
                  </span>
                  <strong className="font-semibold text-foreground">
                    {authorName}
                  </strong>
                </span>
              </div>
              {authorSlug ? (
                <Link
                  to="/u/$authorSlug"
                  params={{ authorSlug }}
                  className={cn(
                    buttonVariants({ variant: "outline", size: "touch" }),
                    "w-full",
                  )}
                >
                  View profile
                </Link>
              ) : null}
            </div>
            <ProgramForkActions
              programId={program.id}
              programTitle={program.title}
              shareToken={program.shareToken}
              forkable={program.forkable}
              isOwner={isOwner}
              isSignedIn={viewerUserId != null}
              returnPath={returnPath}
              pendingCopyIntent={pendingCopyIntent}
            />
          </aside>
        </div>

        <footer className="mt-8 border-t border-border pt-4 text-sm text-muted-foreground">
          Shared on physlane
          {authorSlug && program.slug ? (
            <>
              {" · "}
              <Link
                to="/u/$authorSlug/$programRef"
                params={{
                  authorSlug,
                  programRef: program.slug,
                }}
                className="font-medium text-brand-text underline underline-offset-2"
              >
                Public page
              </Link>
            </>
          ) : null}
        </footer>
      </main>
    </PublicProgramShell>
  );
}
