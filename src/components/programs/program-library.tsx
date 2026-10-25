import { Link, useRouter } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "#/components/ui/sheet";
import { ProgramVisibilityBadge } from "#/components/programs/program-visibility-badge";
import { cn } from "#/lib/cn";
import {
  goalDisplayLabel,
  levelDisplayLabel,
  programMetaLine,
} from "#/lib/programs/display-labels";
import { formatEditedAt } from "#/lib/programs/relative-time";
import {
  PROGRAM_GOALS,
  PROGRAM_LEVELS,
  type ProgramGoal,
  type ProgramLevel,
} from "#/lib/programs/taxonomy";
import {
  createProgram,
  listMyPrograms,
  type ProgramListItemDTO,
} from "#/server/programs.fns";

type LibraryProps = {
  programs: ProgramListItemDTO[];
  loadError?: boolean;
};

function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  optionLabel,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
  optionLabel: (v: T) => string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      <div
        role="group"
        aria-label={label}
        className="flex flex-wrap gap-1 rounded-lg border border-border bg-muted p-1"
      >
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            aria-pressed={value === opt}
            onClick={() => onChange(opt)}
            className={cn(
              "min-h-11 flex-1 rounded-md px-2 text-sm font-medium transition-colors",
              value === opt
                ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                : "text-text-secondary hover:text-foreground",
            )}
          >
            {optionLabel(opt)}
          </button>
        ))}
      </div>
    </div>
  );
}

function SessionsStepper({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span
        id="new-program-spw"
        className="text-sm font-medium text-muted-foreground"
      >
        Sessions per week
      </span>
      <div
        role="group"
        aria-labelledby="new-program-spw"
        className="flex items-center gap-3"
      >
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          aria-label="Fewer sessions per week"
          disabled={value <= 1}
          onClick={() => onChange(Math.max(1, value - 1))}
        >
          −
        </Button>
        <output className="min-w-8 text-center text-lg font-semibold tabular-nums">
          {value}
        </output>
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          aria-label="More sessions per week"
          disabled={value >= 7}
          onClick={() => onChange(Math.min(7, value + 1))}
        >
          +
        </Button>
      </div>
    </div>
  );
}

function ProgramRow({ program }: { program: ProgramListItemDTO }) {
  const meta = programMetaLine(program);
  return (
    <li>
      <Link
        to="/programs/$programId"
        params={{ programId: program.id }}
        className="flex min-h-11 flex-col gap-2 rounded-xl border border-border bg-card p-4 no-underline transition-colors hover:bg-muted/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:flex-row sm:items-center sm:gap-4"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-base font-semibold text-foreground">
              {program.title}
            </span>
            <ProgramVisibilityBadge visibility={program.visibility} />
          </div>
          <p className="mt-1 text-sm text-text-secondary">{meta}</p>
          {program.forkSourceLabel ? (
            <p className="mt-1 text-sm text-muted-foreground">
              Based on {program.forkSourceLabel}
            </p>
          ) : null}
        </div>
        <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
          {formatEditedAt(program.updatedAt)}
        </span>
      </Link>
    </li>
  );
}

function LibrarySkeleton() {
  return (
    <ul className="flex flex-col gap-3" aria-busy="true" aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <li
          key={i}
          className="h-24 animate-pulse rounded-xl border border-border bg-muted"
        />
      ))}
    </ul>
  );
}

const newProgramSchema = z.object({
  title: z.string().trim().min(1, "Add a title."),
  goal: z.enum(PROGRAM_GOALS),
  level: z.enum(PROGRAM_LEVELS),
  daysPerWeek: z.number().int().min(1).max(7),
});

export function ProgramLibrary({ programs, loadError }: LibraryProps) {
  const router = useRouter();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState<ProgramGoal>("hypertrophy");
  const [level, setLevel] = useState<ProgramLevel>("beginner");
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const openNewProgram = () => {
    setTitle("");
    setGoal("hypertrophy");
    setLevel("beginner");
    setDaysPerWeek(3);
    setFieldError(null);
    setSheetOpen(true);
  };

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    const parsed = newProgramSchema.safeParse({
      title,
      goal,
      level,
      daysPerWeek,
    });
    if (!parsed.success) {
      setFieldError(parsed.error.issues[0]?.message ?? "Add a title.");
      return;
    }
    setFieldError(null);
    setPending(true);
    try {
      const created = await createProgram({
        data: {
          title: parsed.data.title,
          description: null,
          weeks: 1,
          goal: parsed.data.goal,
          level: parsed.data.level,
          daysPerWeek: parsed.data.daysPerWeek,
          equipmentTags: [],
        },
      });
      setSheetOpen(false);
      await router.navigate({
        to: "/programs/$programId",
        params: { programId: created.id },
      });
    } catch {
      setFieldError("Could not create the program. Try again.");
    } finally {
      setPending(false);
    }
  };

  const onRetryLoad = async () => {
    setRetrying(true);
    try {
      await router.invalidate();
    } finally {
      setRetrying(false);
    }
  };

  const countLabel =
    programs.length === 1 ? "1 program" : `${programs.length} programs`;

  return (
    <section className="pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="m-0 font-display text-4xl font-normal tracking-tight text-foreground sm:text-5xl">
            Programs
          </h1>
          {programs.length > 0 ? (
            <p className="m-0 mt-1 text-sm tabular-nums text-muted-foreground">
              {countLabel}
            </p>
          ) : null}
        </div>
        {programs.length > 0 ? (
          <Button type="button" className="min-h-11" onClick={openNewProgram}>
            New program
          </Button>
        ) : null}
      </div>

      {loadError ? (
        <div
          className="mt-8 rounded-xl border border-destructive/40 bg-muted p-4"
          role="alert"
        >
          <p className="m-0 text-sm text-foreground">
            Could not load your programs.
          </p>
          <Button
            type="button"
            variant="outline"
            className="mt-3 min-h-11"
            disabled={retrying}
            onClick={() => void onRetryLoad()}
          >
            {retrying ? "Retrying…" : "Try again"}
          </Button>
        </div>
      ) : retrying ? (
        <div className="mt-8">
          <LibrarySkeleton />
        </div>
      ) : programs.length === 0 ? (
        <div className="mt-8 flex flex-col gap-3">
          <h2 className="m-0 text-base font-semibold">No programs yet</h2>
          <p className="m-0 text-sm text-text-secondary">
            Build a program from the exercise catalog: weeks, sessions, and
            exercises with sets and reps. Share it by link or on a profile when
            it&apos;s ready.
          </p>
          <Button
            type="button"
            className="min-h-11 w-full sm:w-auto"
            onClick={openNewProgram}
          >
            New program
          </Button>
          <p className="m-0 text-sm text-muted-foreground">
            Programs you copy from other authors also appear here.
          </p>
        </div>
      ) : (
        <ul className="mt-8 flex flex-col gap-3">
          {programs.map((p) => (
            <ProgramRow key={p.id} program={p} />
          ))}
        </ul>
      )}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="max-h-[90dvh] sm:max-w-md">
          <SheetHeader>
            <SheetTitle>New program</SheetTitle>
          </SheetHeader>
          <form className="flex flex-col gap-4 px-4 pb-6" onSubmit={onCreate}>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="new-program-title">Title</Label>
              <Input
                id="new-program-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                aria-invalid={fieldError != null}
                aria-describedby={
                  fieldError ? "new-program-title-error" : undefined
                }
                autoFocus
              />
              {fieldError ? (
                <p
                  id="new-program-title-error"
                  className="text-sm text-destructive"
                >
                  {fieldError}
                </p>
              ) : null}
            </div>
            <SegmentedControl
              label="Goal"
              options={PROGRAM_GOALS}
              value={goal}
              onChange={setGoal}
              optionLabel={goalDisplayLabel}
            />
            <SegmentedControl
              label="Level"
              options={PROGRAM_LEVELS}
              value={level}
              onChange={setLevel}
              optionLabel={levelDisplayLabel}
            />
            <SessionsStepper value={daysPerWeek} onChange={setDaysPerWeek} />
            <Button
              type="submit"
              className="min-h-11 w-full"
              disabled={pending}
            >
              {pending ? "Creating…" : "Create program"}
            </Button>
            <p className="m-0 text-center text-sm text-muted-foreground">
              Everything else is optional and can wait.
            </p>
          </form>
        </SheetContent>
      </Sheet>
    </section>
  );
}

export async function loadProgramLibrary() {
  return listMyPrograms();
}
