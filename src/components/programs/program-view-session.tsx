import { ChevronDown, Link2, Video } from "lucide-react";
import { Fragment, useMemo, useState } from "react";
import type { ExerciseDrawerTarget } from "#/components/programs/exercise-drawer";
import { cn } from "#/lib/cn";
import { regionDisplayLabel } from "#/lib/programs/display-labels";
import {
  formatEntryIntensity,
  formatEntryLoad,
  formatEntrySetsReps,
  formatRestSeconds,
} from "#/lib/programs/entry-display";
import { groupEntryBlocks } from "#/lib/programs/entry-ops";
import { assetHint } from "#/lib/programs/exercise-assets";
import { setsByRegion, type RegionSets } from "#/lib/programs/sets-by-region";
import type { UnitSystem } from "#/lib/units";
import type {
  ProgramEntryDTO,
  ProgramSessionDTO,
  PublicExerciseRefDTO,
  PublicProgramDTO,
} from "#/server/programs.fns";

type OpenEntry = (target: ExerciseDrawerTarget) => void;

function SetsByRegionBar({ regions }: { regions: RegionSets[] }) {
  const most = regions[0]?.sets ?? 1;
  return (
    <dl
      className="mb-4 grid grid-cols-[5.25rem_1fr_2rem] items-center gap-x-2.5 gap-y-1.5 text-[13px]"
      aria-label="Sets by body region, counted by primary muscle"
    >
      {regions.map(({ region, sets }) => (
        <Fragment key={region}>
          <dt className="text-text-secondary">{regionDisplayLabel(region)}</dt>
          <dd className="m-0">
            <div className="h-2 overflow-hidden rounded-sm bg-chart-grid">
              <div
                className="h-full bg-chart-neutral"
                style={{ width: `${Math.round((sets / most) * 100)}%` }}
              />
            </div>
          </dd>
          <dd className="m-0 text-right font-semibold tabular-nums text-foreground">
            {sets}
          </dd>
        </Fragment>
      ))}
    </dl>
  );
}

function EntryBlock({
  entry,
  exercise,
  unitSystem,
  onOpen,
}: {
  entry: ProgramEntryDTO;
  exercise: PublicExerciseRefDTO | undefined;
  unitSystem: UnitSystem;
  onOpen: OpenEntry;
}) {
  const load = formatEntryLoad(entry, unitSystem);
  const intensity = formatEntryIntensity(entry);
  const rest = formatRestSeconds(entry.restSeconds);
  const hint = assetHint(exercise?.assets ?? [], entry.refUrl);

  return (
    <li className="rounded-lg border border-border bg-card px-3 pb-3 pt-1">
      <button
        type="button"
        disabled={!exercise}
        aria-haspopup="dialog"
        onClick={() => exercise && onOpen({ entry, exercise })}
        className="flex min-h-11 w-full cursor-pointer items-center justify-between gap-2 border-0 bg-transparent p-0 text-left font-semibold leading-snug text-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="min-w-0 break-words">
          {exercise?.name ?? "Exercise"}
        </span>
        {hint ? (
          <span className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
            {hint === "video" ? (
              <Video className="size-3.5" aria-hidden />
            ) : (
              <Link2 className="size-3.5" aria-hidden />
            )}
            {hint === "video" ? "Video" : "Link"}
          </span>
        ) : null}
      </button>
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

export function SessionAccordion({
  session,
  exercises,
  unitSystem,
  defaultOpen,
  onOpenEntry,
}: {
  session: ProgramSessionDTO;
  exercises: PublicProgramDTO["exercises"];
  unitSystem: UnitSystem;
  defaultOpen: boolean;
  onOpenEntry: OpenEntry;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const sets = session.entries.reduce((sum, entry) => sum + entry.sets, 0);

  const blocks = useMemo(
    () => groupEntryBlocks(session.entries),
    [session.entries],
  );
  const regions = useMemo(
    () => setsByRegion(session.entries, exercises),
    [session.entries, exercises],
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
            {session.entries.length} exercise
            {session.entries.length === 1 ? "" : "s"} · {sets} sets
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
          {regions.length > 0 ? <SetsByRegionBar regions={regions} /> : null}
          <ol className="m-0 flex list-none flex-col gap-2 p-0">
            {blocks.map((block, idx) => {
              if (block.kind === "single") {
                return (
                  <EntryBlock
                    key={block.entry.id}
                    entry={block.entry}
                    exercise={exercises[block.entry.exerciseId]}
                    unitSystem={unitSystem}
                    onOpen={onOpenEntry}
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
                        exercise={exercises[entry.exerciseId]}
                        unitSystem={unitSystem}
                        onOpen={onOpenEntry}
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
