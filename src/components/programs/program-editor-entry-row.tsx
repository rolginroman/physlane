import { ArrowDown, ArrowUp, ChevronDown, ChevronRight } from "lucide-react";
import { useId } from "react";
import {
  FieldError,
  LoadField,
  NumberField,
} from "#/components/programs/program-editor-fields";
import { Button } from "#/components/ui/button";
import { Label } from "#/components/ui/label";
import { OptionSelect } from "#/components/ui/option-select";
import { Input } from "#/components/ui/input";
import { Switch } from "#/components/ui/switch";
import { Textarea } from "#/components/ui/textarea";
import { cn } from "#/lib/cn";
import { formatEntrySummary } from "#/lib/programs/entry-display";
import type { EntryErrors } from "#/lib/programs/entry-validation";
import { defaultKgLoad, loadUnitLabel } from "#/lib/programs/load-units";
import type { UnitSystem } from "#/lib/units";
import type { ProgramEntryDTO } from "#/server/programs.fns";

type RepsType = ProgramEntryDTO["repsType"];
type LoadType = ProgramEntryDTO["loadType"];
type IntensityType = ProgramEntryDTO["intensityType"];

const REPS_TYPE_OPTIONS: { value: RepsType; label: string }[] = [
  { value: "count", label: "Number" },
  { value: "max", label: "Max" },
  { value: "seconds", label: "Seconds" },
];

const INTENSITY_TYPE_OPTIONS: { value: IntensityType; label: string }[] = [
  { value: "none", label: "None" },
  { value: "rpe", label: "RPE" },
  { value: "rir", label: "RIR" },
];

export function ProgramEditorEntryRow({
  entry,
  exerciseName,
  expanded,
  onToggle,
  onUpdate,
  onSupersetToggle,
  onPick,
  onRemoveEntry,
  onMove,
  canMoveUp,
  canMoveDown,
  canSuperset,
  joinedToPrevious,
  errors,
  unitSystem,
  stale,
}: {
  entry: ProgramEntryDTO;
  exerciseName: string;
  expanded: boolean;
  onToggle: () => void;
  onUpdate: (patch: Partial<ProgramEntryDTO>) => void;
  onSupersetToggle: () => void;
  onPick: () => void;
  onRemoveEntry: () => void;
  onMove: (direction: -1 | 1) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canSuperset: boolean;
  joinedToPrevious: boolean;
  errors: EntryErrors | undefined;
  unitSystem: UnitSystem;
  stale: boolean;
}) {
  const uid = useId();
  const supersetLabelId = `${uid}-superset`;
  const hasErrors = errors != null;
  const loadTypeOptions: { value: LoadType; label: string }[] = [
    { value: "none", label: "None" },
    { value: "kg", label: loadUnitLabel(unitSystem) },
    { value: "percent1rm", label: "%1RM" },
  ];
  return (
    <div
      className={cn(
        "rounded-lg border bg-background p-3",
        hasErrors ? "border-destructive" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-touch"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={`${expanded ? "Collapse" : "Edit"} ${exerciseName}`}
        >
          {expanded ? (
            <ChevronDown className="size-5" aria-hidden />
          ) : (
            <ChevronRight className="size-5" aria-hidden />
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="touch"
          className="min-w-0 flex-1 justify-start"
          onClick={onPick}
          disabled={stale}
        >
          <span className="truncate">{exerciseName}</span>
        </Button>
        <span className="text-sm tabular-nums text-text-secondary">
          {formatEntrySummary(entry, unitSystem)}
        </span>
      </div>
      {hasErrors && !expanded ? (
        <p className="mt-2 text-xs text-destructive">
          Open this exercise to fix {Object.keys(errors).length}{" "}
          {Object.keys(errors).length === 1 ? "field" : "fields"}.
        </p>
      ) : null}
      {expanded ? (
        <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
          <div className="flex flex-wrap gap-2">
            <NumberField
              id={`${uid}-sets`}
              label="Sets"
              value={entry.sets}
              onChange={(v) => onUpdate({ sets: v ?? Number.NaN })}
              error={errors?.sets}
              className="w-20"
            />
            <div>
              <Label htmlFor={`${uid}-reps-type`}>Reps type</Label>
              <OptionSelect
                id={`${uid}-reps-type`}
                className="mt-1 w-32"
                value={entry.repsType}
                options={REPS_TYPE_OPTIONS}
                onValueChange={(t) =>
                  onUpdate({
                    repsType: t,
                    repsValue: t === "max" ? null : t === "seconds" ? 30 : 10,
                  })
                }
              />
            </div>
            {entry.repsType !== "max" ? (
              <NumberField
                id={`${uid}-reps`}
                label={entry.repsType === "seconds" ? "Seconds" : "Reps"}
                value={entry.repsValue}
                onChange={(v) => onUpdate({ repsValue: v })}
                error={errors?.repsValue}
                className="w-24"
              />
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <div>
              <Label htmlFor={`${uid}-load-type`}>
                Load <span className="font-normal">(optional)</span>
              </Label>
              <OptionSelect
                id={`${uid}-load-type`}
                className="mt-1 w-32"
                value={entry.loadType}
                options={loadTypeOptions}
                onValueChange={(t) =>
                  onUpdate({
                    loadType: t,
                    loadValue:
                      t === "none"
                        ? null
                        : t === "kg"
                          ? defaultKgLoad(unitSystem)
                          : 70,
                  })
                }
              />
            </div>
            {entry.loadType === "kg" ? (
              <LoadField
                id={`${uid}-load`}
                value={entry.loadValue}
                unitSystem={unitSystem}
                onChange={(kg) => onUpdate({ loadValue: kg })}
                error={errors?.loadValue}
              />
            ) : null}
            {entry.loadType === "percent1rm" ? (
              <NumberField
                id={`${uid}-load`}
                label="Load as % of 1RM"
                value={entry.loadValue}
                onChange={(v) => onUpdate({ loadValue: v })}
                error={errors?.loadValue}
                className="w-24"
                inputMode="decimal"
              />
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <div>
              <Label htmlFor={`${uid}-int-type`}>
                Intensity <span className="font-normal">(optional)</span>
              </Label>
              <OptionSelect
                id={`${uid}-int-type`}
                className="mt-1 w-32"
                value={entry.intensityType}
                options={INTENSITY_TYPE_OPTIONS}
                onValueChange={(t) =>
                  onUpdate({
                    intensityType: t,
                    intensityValue: t === "none" ? null : t === "rpe" ? 8 : 2,
                  })
                }
              />
            </div>
            {entry.intensityType !== "none" ? (
              <NumberField
                id={`${uid}-int`}
                label={
                  entry.intensityType === "rpe" ? "RPE" : "Reps in reserve"
                }
                value={entry.intensityValue}
                onChange={(v) => onUpdate({ intensityValue: v })}
                error={errors?.intensityValue}
                className="w-24"
                inputMode="decimal"
              />
            ) : null}
          </div>
          <NumberField
            id={`${uid}-rest`}
            label="Rest in seconds (optional)"
            value={entry.restSeconds}
            onChange={(v) => onUpdate({ restSeconds: v })}
            error={errors?.restSeconds}
            className="w-32"
          />
          {canSuperset ? (
            <div className="flex min-h-11 items-center justify-between gap-2">
              <span id={supersetLabelId} className="text-sm">
                Superset with previous
              </span>
              <Switch
                checked={joinedToPrevious}
                onCheckedChange={() => onSupersetToggle()}
                disabled={stale}
                aria-labelledby={supersetLabelId}
              />
            </div>
          ) : null}
          <div>
            <Label htmlFor={`${uid}-cues`}>
              Cues <span className="font-normal">(optional)</span>
            </Label>
            <Textarea
              id={`${uid}-cues`}
              className="mt-1 min-h-16"
              value={entry.cues ?? ""}
              onChange={(e) => onUpdate({ cues: e.target.value || null })}
              aria-invalid={errors?.cues != null}
              aria-describedby={errors?.cues ? `${uid}-cues-err` : undefined}
            />
            <FieldError id={`${uid}-cues-err`} message={errors?.cues} />
          </div>
          <div>
            <Label htmlFor={`${uid}-ref`}>
              Reference link <span className="font-normal">(optional)</span>
            </Label>
            <Input
              id={`${uid}-ref`}
              className="mt-1"
              value={entry.refUrl ?? ""}
              onChange={(e) => onUpdate({ refUrl: e.target.value || null })}
              placeholder="https://"
              aria-invalid={errors?.refUrl != null}
              aria-describedby={errors?.refUrl ? `${uid}-ref-err` : undefined}
            />
            <FieldError id={`${uid}-ref-err`} message={errors?.refUrl} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-1">
              <Button
                id={`entry-${entry.id}-move-up`}
                type="button"
                variant="ghost"
                size="icon-touch"
                aria-label="Move up"
                disabled={stale || !canMoveUp}
                onClick={() => onMove(-1)}
              >
                <ArrowUp className="size-5" aria-hidden />
              </Button>
              <Button
                id={`entry-${entry.id}-move-down`}
                type="button"
                variant="ghost"
                size="icon-touch"
                aria-label="Move down"
                disabled={stale || !canMoveDown}
                onClick={() => onMove(1)}
              >
                <ArrowDown className="size-5" aria-hidden />
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="touch"
              className="text-destructive"
              disabled={stale}
              onClick={onRemoveEntry}
            >
              Remove exercise
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
