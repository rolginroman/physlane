import {
  useId,
  type Dispatch,
  type FormEvent,
  type SetStateAction,
} from "react";
import { FieldError } from "#/components/programs/program-editor-fields";
import { ProgramChoiceGroup } from "#/components/programs/program-choice-group";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "#/components/ui/sheet";
import { Textarea } from "#/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "#/components/ui/toggle-group";
import { cn } from "#/lib/cn";
import {
  equipmentDisplayLabel,
  goalDisplayLabel,
  levelDisplayLabel,
} from "#/lib/programs/display-labels";
import {
  numberToInput,
  parseNumberInput,
} from "#/lib/programs/entry-validation";
import type { MetaErrors } from "#/lib/programs/meta-validation";
import type { ProgramMeta } from "#/lib/programs/program-shape";
import {
  EQUIPMENT,
  PROGRAM_GOALS,
  PROGRAM_LEVELS,
  type Equipment,
  type ProgramGoal,
  type ProgramLevel,
} from "#/lib/programs/taxonomy";
import type { ProgramDTO } from "#/server/programs.fns";

export type MetaState = {
  title: string;
  description: string;
  weeks: number;
  goal: ProgramGoal;
  level: ProgramLevel;
  daysPerWeek: number;
  equipmentTags: Equipment[];
  visibility: ProgramDTO["visibility"];
  forkSourceLabel: string | null;
};

export function metaToPayload(m: MetaState): ProgramMeta {
  return {
    title: m.title,
    description: m.description || null,
    weeks: m.weeks,
    goal: m.goal,
    level: m.level,
    daysPerWeek: m.daysPerWeek,
    equipmentTags: m.equipmentTags,
  };
}

export type SlugEditState = {
  authorPrefix: string;
  value: string;
  onChange: (value: string) => void;
  status: "idle" | "checking" | "ok" | "error";
  message: string | null;
};

function MetaPickers({
  meta,
  setMeta,
  errors,
}: {
  meta: MetaState;
  setMeta: Dispatch<SetStateAction<MetaState>>;
  errors: MetaErrors | null;
}) {
  const equipmentLabelId = useId();
  return (
    <>
      <ProgramChoiceGroup
        label="Goal"
        options={PROGRAM_GOALS}
        value={meta.goal}
        onChange={(goal) => setMeta((m) => ({ ...m, goal }))}
        optionLabel={goalDisplayLabel}
      />
      <ProgramChoiceGroup
        label="Level"
        options={PROGRAM_LEVELS}
        value={meta.level}
        onChange={(level) => setMeta((m) => ({ ...m, level }))}
        optionLabel={levelDisplayLabel}
      />
      <div>
        <Label htmlFor="set-days">Sessions per week</Label>
        <Input
          id="set-days"
          type="number"
          min={1}
          max={7}
          className="mt-1"
          value={numberToInput(meta.daysPerWeek)}
          onChange={(e) =>
            setMeta((m) => ({
              ...m,
              daysPerWeek: parseNumberInput(e.target.value) ?? Number.NaN,
            }))
          }
          aria-invalid={errors?.daysPerWeek != null}
          aria-describedby={errors?.daysPerWeek ? "set-days-err" : undefined}
        />
        <FieldError id="set-days-err" message={errors?.daysPerWeek} />
      </div>
      <div>
        <Label htmlFor="set-weeks">Weeks</Label>
        <Input
          id="set-weeks"
          type="number"
          min={1}
          max={52}
          className="mt-1"
          value={numberToInput(meta.weeks)}
          onChange={(e) =>
            setMeta((m) => ({
              ...m,
              weeks: parseNumberInput(e.target.value) ?? Number.NaN,
            }))
          }
          aria-invalid={errors?.weeks != null}
          aria-describedby={errors?.weeks ? "set-weeks-err" : undefined}
        />
        <FieldError id="set-weeks-err" message={errors?.weeks} />
      </div>
      <div>
        <span
          id={equipmentLabelId}
          className="text-sm font-medium text-muted-foreground"
        >
          Equipment
        </span>
        <ToggleGroup<Equipment>
          aria-labelledby={equipmentLabelId}
          className="mt-1"
          variant="chip"
          size="touch"
          multiple
          value={meta.equipmentTags}
          onValueChange={(equipmentTags) =>
            setMeta((m) => ({ ...m, equipmentTags }))
          }
        >
          {EQUIPMENT.map((eq) => (
            <ToggleGroupItem key={eq} value={eq}>
              {equipmentDisplayLabel(eq)}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
    </>
  );
}

export function ProgramEditorSettingsSheet({
  open,
  onOpenChange,
  draft,
  setDraft,
  errors,
  slug,
  submitDisabled,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  draft: MetaState;
  setDraft: Dispatch<SetStateAction<MetaState>>;
  errors: MetaErrors | null;
  /** Null when the program has no address to rename yet. */
  slug: SlugEditState | null;
  submitDisabled: boolean;
  onSubmit: (e: FormEvent) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full gap-0 overflow-y-auto sm:max-w-md"
      >
        <SheetHeader className="pr-12">
          <SheetTitle>Program settings</SheetTitle>
        </SheetHeader>
        <form className="flex flex-col gap-4 px-4 pb-6" onSubmit={onSubmit}>
          <div>
            <Label htmlFor="set-title">Title</Label>
            <Input
              id="set-title"
              className="mt-1"
              value={draft.title}
              onChange={(e) =>
                setDraft((m) => ({ ...m, title: e.target.value }))
              }
              aria-invalid={errors?.title != null}
              aria-describedby={errors?.title ? "set-title-err" : undefined}
            />
            <FieldError id="set-title-err" message={errors?.title} />
          </div>
          <div>
            <Label htmlFor="set-desc">
              Description <span className="font-normal">(optional)</span>
            </Label>
            <Textarea
              id="set-desc"
              className="mt-1"
              value={draft.description}
              onChange={(e) =>
                setDraft((m) => ({ ...m, description: e.target.value }))
              }
              aria-invalid={errors?.description != null}
              aria-describedby={
                errors?.description ? "set-desc-err" : undefined
              }
            />
            <FieldError id="set-desc-err" message={errors?.description} />
          </div>
          <MetaPickers meta={draft} setMeta={setDraft} errors={errors} />
          {slug ? (
            <div>
              <Label htmlFor="set-program-slug">Program address</Label>
              <div
                className={cn(
                  "mt-1 flex min-h-11 overflow-hidden rounded-lg border bg-card",
                  slug.status === "error"
                    ? "border-destructive"
                    : slug.status === "ok"
                      ? "border-data-positive"
                      : "border-border",
                )}
              >
                <span className="flex max-w-1/2 shrink-0 items-center border-r border-border bg-muted px-3 text-sm text-muted-foreground">
                  <span className="truncate">/u/{slug.authorPrefix}/</span>
                </span>
                <Input
                  id="set-program-slug"
                  className="border-0 shadow-none"
                  value={slug.value}
                  onChange={(e) => slug.onChange(e.target.value)}
                  aria-invalid={slug.status === "error"}
                />
              </div>
              {slug.status === "checking" ? (
                <p className="hint">Checking availability…</p>
              ) : null}
              {slug.status === "ok" ? (
                <p className="text-sm text-data-positive">{slug.message}</p>
              ) : null}
              {slug.status === "error" && slug.message ? (
                <p className="field-error">{slug.message}</p>
              ) : null}
              <p className="hint">
                Old addresses redirect here after a change. Share links keep
                working.
              </p>
            </div>
          ) : null}
          <Button type="submit" size="touch" disabled={submitDisabled}>
            Save settings
          </Button>
        </form>
      </SheetContent>
    </Sheet>
  );
}
