import { Link, useRouter } from "@tanstack/react-router";
import {
  AlertCircle,
  Check,
  Copy,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCw,
  Share2,
  Trash2,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { z } from "zod";
import { Button } from "#/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "#/components/ui/dropdown-menu";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
  ResponsiveSheetBody,
  ResponsiveSheetContent,
  ResponsiveSheetHeader,
} from "#/components/ui/responsive-sheet";
import { Sheet, SheetTitle } from "#/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "#/components/ui/table";
import { ProgramChoiceGroup } from "#/components/programs/program-choice-group";
import { ProgramVisibilityBadge } from "#/components/programs/program-visibility-badge";
import { ShareDialog } from "#/components/programs/share-dialog";
import {
  goalDisplayLabel,
  levelDisplayLabel,
} from "#/lib/programs/display-labels";
import { isAppErrorCode } from "#/lib/app-error";
import {
  deleteConfirmBody,
  libraryAddress,
  type LibraryAddress,
} from "#/lib/programs/library-rows";
import { programActionErrorMessage } from "#/lib/programs/program-error-message";
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
  getMyAuthorSlug,
  listMyPrograms,
  type ProgramListItemDTO,
} from "#/server/programs.fns";

type LibraryProps = {
  programs: ProgramListItemDTO[];
  authorSlug: string | null;
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

type RowActions = {
  authorSlug: string | null;
  onCopy: (address: LibraryAddress) => void;
  onReplace: (program: ProgramListItemDTO) => void;
  onShare: (program: ProgramListItemDTO) => void;
  onDelete: (program: ProgramListItemDTO) => void;
};

function AddressCell({
  program,
  actions,
}: {
  program: ProgramListItemDTO;
  actions: RowActions;
}) {
  const address = libraryAddress(program, actions.authorSlug);
  if (program.hiddenAt != null) {
    return (
      <span className="text-sm text-muted-foreground">
        Hidden by moderation
      </span>
    );
  }
  if (!address) {
    return (
      <span className="text-sm text-muted-foreground" aria-hidden>
        —
      </span>
    );
  }
  const noun = address.kind === "public" ? "public address" : "share link";
  return (
    <div className="flex min-w-0 items-center gap-1">
      <code className="min-w-0 truncate rounded-md bg-muted px-2 py-1.5 text-sm text-text-secondary">
        {address.display}
      </code>
      <Button
        type="button"
        variant="ghost"
        size="icon-touch"
        aria-label={`Copy ${noun}`}
        onClick={() => actions.onCopy(address)}
      >
        <Copy className="size-4" aria-hidden />
      </Button>
      {address.kind === "unlisted" ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-touch"
          aria-label="Replace share link"
          onClick={() => actions.onReplace(program)}
        >
          <RotateCw className="size-4" aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}

function RowMenu({
  program,
  actions,
}: {
  program: ProgramListItemDTO;
  actions: RowActions;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-touch"
            aria-label={`More for ${program.title}`}
          />
        }
      >
        <MoreHorizontal className="size-4" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={() => actions.onShare(program)}>
          <Share2 aria-hidden />
          Share…
        </DropdownMenuItem>
        <DropdownMenuItem
          render={
            <Link
              to="/programs/$programId"
              params={{ programId: program.id }}
            />
          }
        >
          <Pencil aria-hidden />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          onClick={() => actions.onDelete(program)}
        >
          <Trash2 aria-hidden />
          Delete…
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProgramTitleLink({ program }: { program: ProgramListItemDTO }) {
  return (
    <Link
      to="/programs/$programId"
      params={{ programId: program.id }}
      className="text-base font-semibold break-words text-foreground no-underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      {program.title}
    </Link>
  );
}

function ForkLabel({ program }: { program: ProgramListItemDTO }) {
  return program.forkSourceLabel ? (
    <p className="m-0 mt-1 text-sm text-muted-foreground">
      Based on {program.forkSourceLabel}
    </p>
  ) : null;
}

/** Stacked cards below `lg`; the table takes over from there. */
function ProgramCardList({
  programs,
  actions,
}: {
  programs: ProgramListItemDTO[];
  actions: RowActions;
}) {
  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0 lg:hidden">
      {programs.map((program) => (
        <li
          key={program.id}
          className="rounded-xl border border-border bg-card p-4"
        >
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <ProgramTitleLink program={program} />
              <ForkLabel program={program} />
            </div>
            <RowMenu program={program} actions={actions} />
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
            <ProgramVisibilityBadge visibility={program.visibility} />
            <EditedAtLabel updatedAt={program.updatedAt} />
          </div>
          {program.visibility !== "draft" || program.hiddenAt != null ? (
            <div className="mt-2">
              <AddressCell program={program} actions={actions} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function ProgramTable({
  programs,
  actions,
}: {
  programs: ProgramListItemDTO[];
  actions: RowActions;
}) {
  return (
    <div className="hidden rounded-xl border border-border bg-card lg:block">
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="px-4">Program</TableHead>
            <TableHead>Visibility</TableHead>
            <TableHead>Address</TableHead>
            <TableHead>Edited</TableHead>
            <TableHead className="w-14 px-4">
              <span className="sr-only">Actions</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {programs.map((program) => (
            <TableRow key={program.id}>
              <TableCell className="max-w-xs px-4 py-3 whitespace-normal">
                <ProgramTitleLink program={program} />
                <p className="m-0 mt-0.5 text-sm text-text-secondary">
                  {goalDisplayLabel(program.goal)} ·{" "}
                  {levelDisplayLabel(program.level)} · {program.weeks}{" "}
                  {program.weeks === 1 ? "week" : "weeks"}
                </p>
                <ForkLabel program={program} />
              </TableCell>
              <TableCell>
                <ProgramVisibilityBadge visibility={program.visibility} />
              </TableCell>
              <TableCell className="max-w-96">
                <AddressCell program={program} actions={actions} />
              </TableCell>
              <TableCell>
                <EditedAtLabel updatedAt={program.updatedAt} />
              </TableCell>
              <TableCell className="px-4 text-right">
                <RowMenu program={program} actions={actions} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

function LibrarySkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <ul
      className="m-0 flex list-none flex-col gap-3 p-0"
      aria-busy="true"
      aria-label="Loading"
    >
      {Array.from({ length: rows }, (_, i) => (
        <li
          key={i}
          className="h-20 animate-pulse rounded-xl border border-border bg-muted"
        />
      ))}
    </ul>
  );
}

/** Route pending state: the heading is static, so only the rows load. */
export function ProgramLibraryPending() {
  return (
    <section className="pt-8 lg:pt-12">
      <h1 className="m-0 font-display text-4xl font-normal tracking-tight text-foreground sm:text-5xl">
        Programs
      </h1>
      <div className="mt-8">
        <LibrarySkeleton rows={4} />
      </div>
    </section>
  );
}

const TOAST_MS = 4000;

const newProgramSchema = z.object({
  title: z.string().trim().min(1, "Add a title."),
  goal: z.enum(PROGRAM_GOALS),
  level: z.enum(PROGRAM_LEVELS),
  daysPerWeek: z.number().int().min(1).max(7),
});

export function ProgramLibrary({
  programs,
  authorSlug,
  loadError,
}: LibraryProps) {
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
  const [shareStart, setShareStart] = useState<"replace" | undefined>();
  const [deleteTarget, setDeleteTarget] = useState<ProgramListItemDTO | null>(
    null,
  );
  const [deletePending, setDeletePending] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const handle = window.setTimeout(() => setToast(null), TOAST_MS);
    return () => window.clearTimeout(handle);
  }, [toast]);

  const openShare = (program: ProgramListItemDTO, start?: "replace") => {
    setShareStart(start);
    setShareTarget(program);
    setShareOpen(true);
  };

  const rowActions: RowActions = {
    authorSlug,
    onCopy: async (address) => {
      try {
        await navigator.clipboard.writeText(
          `${window.location.origin}${address.path}`,
        );
        setToast(
          address.kind === "public"
            ? "Public address copied"
            : "Share link copied",
        );
      } catch {
        setToast(programActionErrorMessage("copy-link"));
      }
    },
    onReplace: (program) => openShare(program, "replace"),
    onShare: (program) => openShare(program),
    onDelete: (program) => {
      setDeleteError(null);
      setDeleteTarget(program);
    },
  };

  const onConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeletePending(true);
    setDeleteError(null);
    try {
      await deleteProgram({ data: { programId: deleteTarget.id } });
      setDeleteTarget(null);
      await router.invalidate();
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      setDeleteError(
        programActionErrorMessage("delete", isAppErrorCode(code) ? code : ""),
      );
    } finally {
      setDeletePending(false);
    }
  };

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
      setFieldError(programActionErrorMessage("create"));
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
            <Plus className="size-4" aria-hidden />
            New program
          </Button>
        ) : null}
      </div>

      {loadError ? (
        <div
          className="mt-8 rounded-xl border border-destructive/40 bg-muted p-4"
          role="alert"
        >
          <p className="m-0 flex items-center gap-2 text-sm text-foreground">
            <AlertCircle className="size-4 shrink-0" aria-hidden />
            {programActionErrorMessage("load-list")}
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
        <div className="mt-8">
          <ProgramCardList programs={programs} actions={rowActions} />
          <ProgramTable programs={programs} actions={rowActions} />
        </div>
      )}

      <Sheet
        open={deleteTarget != null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      >
        <ResponsiveSheetContent>
          <ResponsiveSheetHeader>
            <SheetTitle>
              Delete &ldquo;{deleteTarget?.title ?? "program"}&rdquo;?
            </SheetTitle>
          </ResponsiveSheetHeader>
          <ResponsiveSheetBody>
            <p className="m-0 text-sm text-text-secondary">
              {deleteTarget ? deleteConfirmBody(deleteTarget.visibility) : null}
            </p>
            {deleteError ? (
              <p className="m-0 text-sm text-destructive" role="alert">
                {deleteError}
              </p>
            ) : null}
            <Button
              type="button"
              variant="destructive"
              size="touch"
              className="w-full"
              disabled={deletePending}
              onClick={() => void onConfirmDelete()}
            >
              {deletePending ? "Deleting…" : "Delete program"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="touch"
              className="w-full"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
          </ResponsiveSheetBody>
        </ResponsiveSheetContent>
      </Sheet>

      {shareTarget ? (
        <ShareDialog
          open={shareOpen}
          startWith={shareStart}
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
            hiddenAt: shareTarget.hiddenAt,
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

      {toast ? (
        <div
          role="status"
          className="fixed inset-x-4 bottom-4 z-[60] mx-auto flex w-fit max-w-full items-center gap-2 rounded-lg bg-foreground px-4 py-3 text-sm text-background shadow-lg"
        >
          <Check className="size-4 shrink-0" aria-hidden />
          {toast}
        </div>
      ) : null}
    </section>
  );
}

export async function loadProgramLibrary() {
  const [programs, me] = await Promise.all([
    listMyPrograms(),
    getMyAuthorSlug().catch(() => null),
  ]);
  return { programs, authorSlug: me?.authorSlug ?? null };
}
