import { Link, useRouter } from "@tanstack/react-router";
import { Share2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
  ResponsiveSheetBody,
  ResponsiveSheetContent,
  ResponsiveSheetHeader,
} from "#/components/ui/responsive-sheet";
import { Sheet, SheetTitle } from "#/components/ui/sheet";
import { ProgramChoiceGroup } from "#/components/programs/program-choice-group";
import { ProgramVisibilityBadge } from "#/components/programs/program-visibility-badge";
import { ShareDialog } from "#/components/programs/share-dialog";
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
  deleteProgram,
  listMyPrograms,
  type ProgramListItemDTO,
} from "#/server/programs.fns";

type LibraryProps = {
  programs: ProgramListItemDTO[];
  loadError?: boolean;
};

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
          size="icon-touch"
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
          size="icon-touch"
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

function EditedAtLabel({ updatedAt }: { updatedAt: string }) {
  const [label, setLabel] = useState(() => formatEditedAt(updatedAt));

  useEffect(() => {
    setLabel(formatEditedAt(updatedAt));
  }, [updatedAt]);

  return (
    <span
      suppressHydrationWarning
      className="shrink-0 text-sm tabular-nums text-muted-foreground"
    >
      {label}
    </span>
  );
}

function ProgramRow({
  program,
  onShare,
  onRemove,
}: {
  program: ProgramListItemDTO;
  onShare: () => void;
  onRemove: () => void;
}) {
  const meta = programMetaLine(program);
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4 sm:flex-row sm:items-center sm:gap-4">
      <Link
        to="/programs/$programId"
        params={{ programId: program.id }}
        className="min-w-0 flex-1 no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-base font-semibold break-words text-foreground">
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
      </Link>
      <div className="flex shrink-0 items-center gap-2 self-end sm:self-center">
        <EditedAtLabel updatedAt={program.updatedAt} />
        <Button
          type="button"
          variant="outline"
          size="icon-touch"
          aria-label={`Share ${program.title}`}
          onClick={onShare}
        >
          <Share2 className="size-4" aria-hidden />
        </Button>
        <Button type="button" variant="outline" size="touch" onClick={onRemove}>
          Remove
        </Button>
      </div>
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
  const [shareOpen, setShareOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<ProgramListItemDTO | null>(
    null,
  );
  const [removeTarget, setRemoveTarget] = useState<ProgramListItemDTO | null>(
    null,
  );
  const [removePending, setRemovePending] = useState(false);

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
    <section className="pt-8 lg:pt-12">
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
          <Button type="button" size="touch" onClick={openNewProgram}>
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
            size="touch"
            className="mt-3"
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
            size="touch"
            className="w-full sm:w-auto sm:self-start"
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
            <ProgramRow
              key={p.id}
              program={p}
              onShare={() => {
                setShareTarget(p);
                setShareOpen(true);
              }}
              onRemove={() => setRemoveTarget(p)}
            />
          ))}
        </ul>
      )}

      <Sheet
        open={removeTarget != null}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
      >
        <ResponsiveSheetContent>
          <ResponsiveSheetHeader>
            <SheetTitle>Remove {removeTarget?.title ?? "program"}?</SheetTitle>
          </ResponsiveSheetHeader>
          <ResponsiveSheetBody>
            <p className="m-0 text-sm text-text-secondary">
              {removeTarget?.visibility === "public"
                ? "It leaves your profile and your programs. People who open its links see a page saying the author removed it. Copies other people made stay theirs. You can't undo this."
                : "It leaves your programs. People who open its links see a page saying the author removed it. You can't undo this."}
            </p>
            <Button
              type="button"
              variant="destructive"
              size="touch"
              className="w-full"
              disabled={removePending}
              onClick={() => {
                if (!removeTarget) return;
                setRemovePending(true);
                void deleteProgram({ data: { programId: removeTarget.id } })
                  .then(async () => {
                    setRemoveTarget(null);
                    await router.invalidate();
                  })
                  .finally(() => setRemovePending(false));
              }}
            >
              Remove program
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="touch"
              className="w-full"
              onClick={() => setRemoveTarget(null)}
            >
              Cancel
            </Button>
          </ResponsiveSheetBody>
        </ResponsiveSheetContent>
      </Sheet>

      {shareTarget ? (
        <ShareDialog
          open={shareOpen}
          onOpenChange={(open) => {
            setShareOpen(open);
            if (!open) {
              setShareTarget(null);
            }
          }}
          program={{
            id: shareTarget.id,
            title: shareTarget.title,
            visibility: shareTarget.visibility,
            shareToken: shareTarget.shareToken,
            slug: shareTarget.slug,
            revision: shareTarget.revision,
          }}
          onProgramUpdated={(updated) => {
            setShareTarget((prev) => (prev ? { ...prev, ...updated } : prev));
            void router.invalidate();
          }}
        />
      ) : null}

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <ResponsiveSheetContent>
          <ResponsiveSheetHeader>
            <SheetTitle>New program</SheetTitle>
          </ResponsiveSheetHeader>
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
            <ProgramChoiceGroup
              label="Goal"
              options={PROGRAM_GOALS}
              value={goal}
              onChange={setGoal}
              optionLabel={goalDisplayLabel}
              variant="segment"
            />
            <ProgramChoiceGroup
              label="Level"
              options={PROGRAM_LEVELS}
              value={level}
              onChange={setLevel}
              optionLabel={levelDisplayLabel}
              variant="segment"
            />
            <SessionsStepper value={daysPerWeek} onChange={setDaysPerWeek} />
            <Button
              type="submit"
              size="touch"
              className="w-full"
              disabled={pending}
            >
              {pending ? "Creating…" : "Create program"}
            </Button>
            <p className="m-0 text-center text-sm text-muted-foreground">
              Everything else is optional and can wait.
            </p>
          </form>
        </ResponsiveSheetContent>
      </Sheet>
    </section>
  );
}

export async function loadProgramLibrary() {
  return listMyPrograms();
}
