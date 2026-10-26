import { useId, useMemo } from "react";
import { FieldError } from "#/components/programs/program-editor-fields";
import { ProgramEditorEntryRow } from "#/components/programs/program-editor-entry-row";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Textarea } from "#/components/ui/textarea";
import {
  groupEntryBlocks,
  isJoinedToPrevious,
  moveEntry,
  removeEntry,
  toggleSupersetWithPrevious,
} from "#/lib/programs/entry-ops";
import type { SessionErrors } from "#/lib/programs/entry-validation";
import type { UnitSystem } from "#/lib/units";
import type {
  ProgramEntryDTO,
  ProgramExerciseRefDTO,
  ProgramSessionDTO,
} from "#/server/programs.fns";

export function ProgramEditorSessionCard({
  session,
  exercises,
  expanded,
  onToggleExpanded,
  onUpdate,
  onRemove,
  onPickExercise,
  onAddExercise,
  onAnnounce,
  errors,
  unitSystem,
  stale,
}: {
  session: ProgramSessionDTO;
  exercises: Record<string, ProgramExerciseRefDTO>;
  expanded: Set<string>;
  onToggleExpanded: (id: string) => void;
  onUpdate: (fn: (s: ProgramSessionDTO) => ProgramSessionDTO) => void;
  onRemove: () => void;
  onPickExercise: (sessionId: string, entryId: string) => void;
  onAddExercise: () => void;
  onAnnounce: (message: string) => void;
  errors: SessionErrors | undefined;
  unitSystem: UnitSystem;
  stale: boolean;
}) {
  const uid = useId();
  const blocks = useMemo(
    () => groupEntryBlocks(session.entries),
    [session.entries],
  );

  const updateEntry = (entryId: string, patch: Partial<ProgramEntryDTO>) =>
    onUpdate((s) => ({
      ...s,
      entries: s.entries.map((e) =>
        e.id === entryId ? { ...e, ...patch } : e,
      ),
    }));

  const move = (entry: ProgramEntryDTO, index: number, direction: -1 | 1) => {
    const result = moveEntry(session.entries, index, direction);
    if (!result) return;
    onUpdate((s) => {
      const at = s.entries.findIndex((e) => e.id === entry.id);
      const moved = moveEntry(s.entries, at, direction);
      return moved ? { ...s, entries: moved.entries } : s;
    });
    const name = exercises[entry.exerciseId]?.name ?? "Exercise";
    onAnnounce(`Moved ${name} to position ${result.index + 1}`);
    // The row reorders in the DOM, so put focus back; a button disabled at an end hands over to its twin.
    requestAnimationFrame(() => {
      const button = (suffix: string) =>
        document.getElementById(
          `entry-${entry.id}-${suffix}`,
        ) as HTMLButtonElement | null;
      const same = button(direction === -1 ? "move-up" : "move-down");
      const other = button(direction === -1 ? "move-down" : "move-up");
      (same && !same.disabled ? same : other)?.focus();
    });
  };

  const renderEntry = (entry: ProgramEntryDTO, index: number) => (
    <li key={entry.id}>
      <ProgramEditorEntryRow
        entry={entry}
        exerciseName={exercises[entry.exerciseId]?.name ?? "Choose exercise"}
        expanded={expanded.has(entry.id)}
        onToggle={() => onToggleExpanded(entry.id)}
        onUpdate={(patch) => updateEntry(entry.id, patch)}
        onSupersetToggle={() =>
          onUpdate((s) => ({
            ...s,
            entries: toggleSupersetWithPrevious(
              s.entries,
              s.entries.findIndex((e) => e.id === entry.id),
            ),
          }))
        }
        onPick={() => onPickExercise(session.id, entry.id)}
        onRemoveEntry={() =>
          onUpdate((s) => ({ ...s, entries: removeEntry(s.entries, entry.id) }))
        }
        onMove={(direction) => move(entry, index, direction)}
        canMoveUp={index > 0}
        canMoveDown={index < session.entries.length - 1}
        canSuperset={index > 0}
        joinedToPrevious={isJoinedToPrevious(session.entries, index)}
        errors={errors?.entries[entry.id]}
        unitSystem={unitSystem}
        stale={stale}
      />
    </li>
  );

  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="max-w-md min-w-0 flex-1">
          <Input
            value={session.title}
            onChange={(e) => onUpdate((s) => ({ ...s, title: e.target.value }))}
            aria-label="Session title"
            aria-invalid={errors?.title != null}
            aria-describedby={errors?.title ? `${uid}-title-err` : undefined}
            className="font-semibold"
          />
          <FieldError id={`${uid}-title-err`} message={errors?.title} />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="touch"
          className="text-destructive"
          onClick={onRemove}
          disabled={stale}
        >
          Remove
        </Button>
      </div>
      <Textarea
        aria-label="Session notes"
        placeholder="Session notes (optional)"
        value={session.notes ?? ""}
        onChange={(e) =>
          onUpdate((s) => ({ ...s, notes: e.target.value || null }))
        }
        aria-invalid={errors?.notes != null}
        aria-describedby={errors?.notes ? `${uid}-notes-err` : undefined}
        className="mt-2 min-h-16 bg-muted"
      />
      <FieldError id={`${uid}-notes-err`} message={errors?.notes} />
      <FieldError id={`${uid}-limit-err`} message={errors?.entriesLimit} />
      <ul className="mt-4 flex flex-col gap-2">
        {blocks.map((block) =>
          block.kind === "single" ? (
            renderEntry(block.entry, block.index)
          ) : (
            <li
              key={`group-${block.items[0]?.entry.id}`}
              className="border-l-4 border-chart-neutral pl-2"
            >
              <span className="text-xs font-semibold text-muted-foreground uppercase">
                Superset
              </span>
              <ul className="mt-1 flex flex-col gap-2">
                {block.items.map(({ entry, index }) =>
                  renderEntry(entry, index),
                )}
              </ul>
            </li>
          ),
        )}
      </ul>
      <Button
        type="button"
        variant="outline"
        size="touch"
        className="mt-3"
        disabled={stale}
        onClick={onAddExercise}
      >
        Add exercise
      </Button>
    </article>
  );
}
