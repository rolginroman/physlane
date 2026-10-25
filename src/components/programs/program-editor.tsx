import { Link } from "@tanstack/react-router";
import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Settings,
  Share2,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { ExercisePicker } from "#/components/programs/exercise-picker";
import { ProgramVisibilityBadge } from "#/components/programs/program-visibility-badge";
import { ShareDialog } from "#/components/programs/share-dialog";
import { Button } from "#/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "#/components/ui/sheet";
import { Switch } from "#/components/ui/switch";
import { cn } from "#/lib/cn";
import {
  WriteQueueHaltedError,
  createDirtyTracker,
  createWriteQueue,
  mergeServerSessions,
} from "#/lib/programs/editor-save-queue";
import {
  equipmentDisplayLabel,
  goalDisplayLabel,
  levelDisplayLabel,
} from "#/lib/programs/display-labels";
import {
  appendEntry,
  groupEntryBlocks,
  isJoinedToPrevious,
  moveEntry,
  nextSessionDefaults,
  removeEntry,
  toggleSupersetWithPrevious,
} from "#/lib/programs/entry-ops";
import { formatEntrySummary } from "#/lib/programs/entry-display";
import {
  collectSaveBlockers,
  entryToPayload,
  numberToInput,
  parseNumberInput,
  saveBlockedLabel,
  sessionToPayload,
  validateSession,
  type EntryErrors,
  type SessionErrors,
} from "#/lib/programs/entry-validation";
import {
  defaultKgLoad,
  loadFromInput,
  loadToInput,
  loadUnitLabel,
} from "#/lib/programs/load-units";
import {
  validateMetaDraft,
  type MetaErrors,
} from "#/lib/programs/meta-validation";
import type { ProgramMeta } from "#/lib/programs/program-shape";
import {
  EQUIPMENT,
  PROGRAM_GOALS,
  PROGRAM_LEVELS,
  type Equipment,
  type ProgramGoal,
  type ProgramLevel,
} from "#/lib/programs/taxonomy";
import {
  checkProgramSlugAvailable,
  getMyAuthorSlug,
  getMyProgram,
  removeSession,
  renameProgramSlug,
  updateProgramMeta,
  upsertSession,
  type ProgramDTO,
  type ProgramEntryDTO,
  type ProgramExerciseRefDTO,
  type ProgramSessionDTO,
} from "#/server/programs.fns";
import type { UnitSystem } from "#/lib/units";

type SaveIndicator = "idle" | "saving" | "saved" | "error";

function isStaleRevisionError(error: unknown): boolean {
  return error instanceof Error && error.message === "STALE_REVISION";
}

function newEntryRow(exerciseId: string): ProgramEntryDTO {
  return {
    id: crypto.randomUUID(),
    orderIndex: 0,
    exerciseId,
    groupTag: null,
    sets: 3,
    repsType: "count",
    repsValue: 10,
    loadType: "none",
    loadValue: null,
    intensityType: "none",
    intensityValue: null,
    restSeconds: null,
    cues: null,
    refUrl: null,
  };
}

function newSession(
  weekNumber: number,
  weekSessions: readonly ProgramSessionDTO[],
): ProgramSessionDTO {
  return {
    id: crypto.randomUUID(),
    weekNumber,
    ...nextSessionDefaults(weekSessions),
    notes: null,
    entries: [],
  };
}

type ProgramEditorProps = {
  initial: ProgramDTO & {
    sessions: ProgramSessionDTO[];
    exercises: Record<string, ProgramExerciseRefDTO>;
  };
  showForkBanner?: boolean;
  unitSystem: UnitSystem;
};

type MetaState = {
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

export function ProgramEditor({
  initial,
  showForkBanner = false,
  unitSystem,
}: ProgramEditorProps) {
  const programId = initial.id;
  const [forkBannerOpen, setForkBannerOpen] = useState(showForkBanner);
  const [meta, setMeta] = useState<MetaState>({
    title: initial.title,
    description: initial.description ?? "",
    weeks: initial.weeks,
    goal: initial.goal,
    level: initial.level,
    daysPerWeek: initial.daysPerWeek,
    equipmentTags: initial.equipmentTags,
    visibility: initial.visibility,
    forkSourceLabel: initial.forkSourceLabel,
  });
  const [sessions, setSessionsState] = useState(initial.sessions);
  // Latest sessions for queued jobs, which run after the render that queued them.
  const sessionsRef = useRef(initial.sessions);
  const [exercises, setExercises] = useState(initial.exercises);
  const [queue] = useState(() =>
    createWriteQueue(initial.revision, { haltOn: isStaleRevisionError }),
  );
  const [dirty] = useState(createDirtyTracker);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [saveIndicator, setSaveIndicator] = useState<SaveIndicator>("saved");
  const [staleRevision, setStaleRevision] = useState(false);
  const [offline, setOffline] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draft, setDraft] = useState<MetaState>(meta);
  const [announcement, setAnnouncement] = useState("");
  const [programSlug, setProgramSlug] = useState(initial.slug ?? "");
  const [authorSlugPrefix, setAuthorSlugPrefix] = useState<string | null>(null);
  const [programSlugStatus, setProgramSlugStatus] = useState<
    "idle" | "checking" | "ok" | "error"
  >("idle");
  const [programSlugMessage, setProgramSlugMessage] = useState<string | null>(
    null,
  );
  const [shareOpen, setShareOpen] = useState(false);
  const [shareProgram, setShareProgram] = useState({
    id: initial.id,
    title: initial.title,
    visibility: initial.visibility,
    shareToken: initial.shareToken,
    slug: initial.slug,
    revision: initial.revision,
  });
  const [copyWeekOpen, setCopyWeekOpen] = useState(false);
  const [copyTargetWeek, setCopyTargetWeek] = useState(2);
  const [copyConfirmOpen, setCopyConfirmOpen] = useState(false);
  const [copyPending, setCopyPending] = useState(false);
  const [removeSessionTarget, setRemoveSessionTarget] =
    useState<ProgramSessionDTO | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSessionId, setPickerSessionId] = useState<string | null>(null);
  const [pickerEntryId, setPickerEntryId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [reloadPending, setReloadPending] = useState(false);
  const [structuralPending, setStructuralPending] = useState(false);
  const structuralBusyRef = useRef(false);
  const pendingWritesRef = useRef(0);
  const writeFailedRef = useRef(false);
  const staleRef = useRef(false);
  const offlineRef = useRef(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const commitSessions = useCallback((next: ProgramSessionDTO[]) => {
    sessionsRef.current = next;
    setSessionsState(next);
  }, []);

  const mergeSessions = useCallback(
    (server: ProgramSessionDTO[] | undefined) => {
      if (!server) return;
      commitSessions(
        mergeServerSessions(sessionsRef.current, server, new Set(dirty.ids())),
      );
    },
    [commitSessions, dirty],
  );

  /** Runs a mutation through the single write queue and keeps the save indicator honest. */
  const runWrite = useCallback(
    async <T,>(
      job: () => Promise<T>,
    ): Promise<{ ok: true; value: T } | { ok: false }> => {
      pendingWritesRef.current += 1;
      setSaveIndicator("saving");
      let outcome: { ok: true; value: T } | { ok: false };
      try {
        outcome = { ok: true, value: await queue.enqueue(job) };
        if (dirty.size === 0) writeFailedRef.current = false;
      } catch (err) {
        outcome = { ok: false };
        if (isStaleRevisionError(err)) {
          staleRef.current = true;
          setStaleRevision(true);
        } else if (!(err instanceof WriteQueueHaltedError)) {
          writeFailedRef.current = true;
        }
      }
      pendingWritesRef.current -= 1;
      if (pendingWritesRef.current === 0) {
        setSaveIndicator(
          queue.halted
            ? "idle"
            : writeFailedRef.current
              ? "error"
              : dirty.size > 0
                ? "saving"
                : "saved",
        );
      }
      return outcome;
    },
    [dirty, queue],
  );

  /** Structural edits (weeks, settings, removals, copy) allow one in flight so double taps can't repeat them. */
  const runStructural = async <T,>(job: () => Promise<T>) => {
    if (structuralBusyRef.current) return { ok: false } as const;
    structuralBusyRef.current = true;
    setStructuralPending(true);
    try {
      return await runWrite(job);
    } finally {
      structuralBusyRef.current = false;
      setStructuralPending(false);
    }
  };

  const flushDirty = useCallback(async () => {
    if (staleRef.current || offlineRef.current || dirty.size === 0) return;
    await runWrite(async () => {
      for (const sessionId of dirty.ids()) {
        const session = sessionsRef.current.find((s) => s.id === sessionId);
        const sentVersion = dirty.versionOf(sessionId);
        if (!session || sentVersion === undefined) {
          dirty.drop(sessionId);
          continue;
        }
        // Stays dirty until fixed; other sessions still save.
        if (validateSession(session, unitSystem)) continue;
        const dto = await upsertSession({
          data: {
            programId,
            expectedRevision: queue.revision,
            session: { id: sessionId, ...sessionToPayload(session) },
          },
        });
        queue.setRevision(dto.revision);
        dirty.clearIfUnchanged(sessionId, sentVersion);
        mergeSessions(dto.sessions);
      }
      writeFailedRef.current = false;
    });
  }, [dirty, mergeSessions, programId, queue, runWrite, unitSystem]);

  const retrySave = () => {
    if (dirty.size > 0) {
      void flushDirty();
    } else {
      writeFailedRef.current = false;
      setSaveIndicator("saved");
    }
  };

  const scheduleSave = useCallback(
    (sessionId: string) => {
      dirty.mark(sessionId);
      if (staleRef.current) return;
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = setTimeout(() => {
        void flushDirty();
      }, 800);
    },
    [dirty, flushDirty],
  );

  useEffect(() => {
    offlineRef.current = !navigator.onLine;
    setOffline(offlineRef.current);
    const onOnline = () => {
      offlineRef.current = false;
      setOffline(false);
      void flushDirty();
    };
    const onOffline = () => {
      offlineRef.current = true;
      setOffline(true);
    };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [flushDirty]);

  const weekSessions = useMemo(
    () =>
      sessions
        .filter((s) => s.weekNumber === selectedWeek)
        .sort((a, b) => a.orderIndex - b.orderIndex),
    [sessions, selectedWeek],
  );

  const applyProgram = useCallback(
    (
      dto: ProgramDTO & {
        sessions?: ProgramSessionDTO[];
        exercises?: Record<string, ProgramExerciseRefDTO>;
      },
    ) => {
      setMeta((m) => ({
        ...m,
        title: dto.title,
        description: dto.description ?? "",
        weeks: dto.weeks,
        goal: dto.goal,
        level: dto.level,
        daysPerWeek: dto.daysPerWeek,
        equipmentTags: dto.equipmentTags,
        visibility: dto.visibility,
        forkSourceLabel: dto.forkSourceLabel,
      }));
      mergeSessions(dto.sessions);
      if (dto.exercises) {
        setExercises(dto.exercises);
      }
      queue.setRevision(dto.revision);
      if (dto.slug != null) {
        setProgramSlug(dto.slug);
        setShareProgram((prev) => ({ ...prev, slug: dto.slug }));
      }
    },
    [mergeSessions, queue],
  );

  useEffect(() => {
    if (!settingsOpen || authorSlugPrefix != null) {
      return;
    }
    void getMyAuthorSlug().then(({ authorSlug }) => {
      setAuthorSlugPrefix(authorSlug);
    });
  }, [settingsOpen, authorSlugPrefix]);

  useEffect(() => {
    if (!shareProgram.slug || programSlug === shareProgram.slug) {
      setProgramSlugStatus("idle");
      setProgramSlugMessage(null);
      return;
    }
    const candidate = programSlug.trim().toLowerCase();
    if (candidate.length < 3) {
      setProgramSlugStatus("error");
      setProgramSlugMessage("Use at least 3 characters.");
      return;
    }
    setProgramSlugStatus("checking");
    const timer = window.setTimeout(() => {
      void checkProgramSlugAvailable({
        data: { programId, candidate },
      })
        .then((result) => {
          if (result.ok) {
            setProgramSlugStatus("ok");
            setProgramSlugMessage("Available");
            return;
          }
          setProgramSlugStatus("error");
          setProgramSlugMessage(result.reason);
        })
        .catch(() => {
          setProgramSlugStatus("error");
          setProgramSlugMessage("Couldn't check that address. Try again.");
        });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [programId, programSlug, shareProgram.slug]);

  const updateSession = (
    sessionId: string,
    updater: (s: ProgramSessionDTO) => ProgramSessionDTO,
  ) => {
    const current = sessionsRef.current;
    if (!current.some((s) => s.id === sessionId)) return;
    commitSessions(current.map((s) => (s.id === sessionId ? updater(s) : s)));
    scheduleSave(sessionId);
  };

  const addWeek = async () => {
    if (meta.weeks >= 52 || staleRevision) return;
    const nextWeeks = meta.weeks + 1;
    const result = await runStructural(async () => {
      const dto = await updateProgramMeta({
        data: {
          programId,
          expectedRevision: queue.revision,
          meta: metaToPayload({ ...meta, weeks: nextWeeks }),
        },
      });
      applyProgram(dto);
    });
    if (result.ok) {
      setSelectedWeek(nextWeeks);
    }
  };

  const saveSettings = async (e: FormEvent) => {
    e.preventDefault();
    if (draftErrors) return;
    if (
      shareProgram.slug &&
      programSlug.trim().toLowerCase() !== shareProgram.slug &&
      programSlugStatus !== "ok"
    ) {
      return;
    }
    const result = await runStructural(async () => {
      applyProgram(
        await updateProgramMeta({
          data: {
            programId,
            expectedRevision: queue.revision,
            meta: metaToPayload(draft),
          },
        }),
      );
      if (
        shareProgram.slug &&
        programSlug.trim().toLowerCase() !== shareProgram.slug
      ) {
        applyProgram(
          await renameProgramSlug({
            data: {
              programId,
              expectedRevision: queue.revision,
              slug: programSlug.trim().toLowerCase(),
            },
          }),
        );
      }
    });
    if (result.ok) {
      setSettingsOpen(false);
    }
  };

  const confirmRemoveSession = async () => {
    const target = removeSessionTarget;
    if (!target) return;
    const result = await runStructural(async () => {
      // Dropped first so the merge below can't keep the removed session as unsaved.
      dirty.drop(target.id);
      applyProgram(
        await removeSession({
          data: {
            programId,
            expectedRevision: queue.revision,
            sessionId: target.id,
          },
        }),
      );
    });
    if (result.ok) {
      setRemoveSessionTarget(null);
    }
  };

  const runCopyWeek = async () => {
    setCopyPending(true);
    const result = await runStructural(async () => {
      const current = sessionsRef.current;
      const source = current.filter((s) => s.weekNumber === selectedWeek);
      const targetExisting = current.filter(
        (s) => s.weekNumber === copyTargetWeek,
      );
      for (const old of targetExisting) {
        dirty.drop(old.id);
        const dto = await removeSession({
          data: {
            programId,
            expectedRevision: queue.revision,
            sessionId: old.id,
          },
        });
        queue.setRevision(dto.revision);
        mergeSessions(dto.sessions);
      }
      for (let i = 0; i < source.length; i++) {
        const src = source[i];
        if (!src) continue;
        const dto = await upsertSession({
          data: {
            programId,
            expectedRevision: queue.revision,
            session: {
              weekNumber: copyTargetWeek,
              orderIndex: i,
              title: src.title,
              notes: src.notes,
              entries: src.entries.map((entry) => entryToPayload(entry, false)),
            },
          },
        });
        queue.setRevision(dto.revision);
        mergeSessions(dto.sessions);
      }
    });
    setCopyPending(false);
    if (result.ok) {
      setCopyWeekOpen(false);
      setCopyConfirmOpen(false);
    }
  };

  const onCopyWeekClick = () => {
    const defaultTarget = Math.min(selectedWeek + 1, meta.weeks);
    setCopyTargetWeek(defaultTarget);
    setCopyWeekOpen(true);
  };

  const targetSessionCount = sessions.filter(
    (s) => s.weekNumber === copyTargetWeek,
  ).length;

  const reloadProgram = async () => {
    setReloadPending(true);
    try {
      const dto = await getMyProgram({ data: { programId } });
      dirty.clear();
      if (dto.sessions && dto.exercises) {
        applyProgram({
          ...dto,
          sessions: dto.sessions,
          exercises: dto.exercises,
        });
        // Reload discards local state, so replace rather than merge.
        commitSessions(dto.sessions);
      }
      queue.resume(dto.revision);
      staleRef.current = false;
      writeFailedRef.current = false;
      setStaleRevision(false);
      setLoadError(false);
      setSaveIndicator("saved");
    } catch {
      setLoadError(true);
    } finally {
      setReloadPending(false);
    }
  };

  const toggleExpanded = (entryId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) {
        next.delete(entryId);
      } else {
        next.add(entryId);
      }
      return next;
    });
  };

  const draftErrors = useMemo(
    () => validateMetaDraft(metaToPayload(draft)),
    [draft],
  );

  const blockers = useMemo(
    () => collectSaveBlockers(sessions, unitSystem),
    [sessions, unitSystem],
  );
  const blockedLabel = saveBlockedLabel(blockers);

  const openSettings = () => {
    setDraft(meta);
    setProgramSlug(shareProgram.slug ?? "");
    setSettingsOpen(true);
  };

  const openPickerForEntry = (sessionId: string, entryId: string) => {
    setPickerSessionId(sessionId);
    setPickerEntryId(entryId);
    setPickerOpen(true);
  };

  const openPickerForNewEntry = (sessionId: string) => {
    setPickerSessionId(sessionId);
    setPickerEntryId(null);
    setPickerOpen(true);
  };

  return (
    <section className="pt-4 pb-8">
      {forkBannerOpen ? (
        <div
          className="mb-4 flex flex-col gap-2 rounded-xl border border-border bg-brand-soft p-4 sm:flex-row sm:items-start"
          role="status"
        >
          <div className="flex-1 text-sm">
            <p className="m-0 font-semibold text-foreground">
              Copied to your programs
            </p>
            <p className="m-0 mt-1 text-text-secondary">
              This is your copy: a draft only you can see. Edit anything.
              Changes the author makes to theirs don't reach it.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            className="shrink-0"
            aria-label="Dismiss"
            onClick={() => setForkBannerOpen(false)}
          >
            ×
          </Button>
        </div>
      ) : null}
      {staleRevision ? (
        <div
          className="mb-4 flex flex-col gap-3 rounded-xl border border-border bg-brand-soft p-4 sm:flex-row sm:items-center"
          role="alert"
        >
          <p className="m-0 flex-1 text-sm">
            This program was opened in another tab. Reload to continue editing.
          </p>
          <Button
            type="button"
            className="min-h-11"
            disabled={reloadPending}
            onClick={() => void reloadProgram()}
          >
            {reloadPending ? "Reloading…" : "Reload"}
          </Button>
        </div>
      ) : null}
      {offline ? (
        <p className="mb-4 text-sm text-destructive" role="status">
          Offline · changes not saved
        </p>
      ) : null}
      {loadError ? (
        <div className="mb-4 rounded-xl border border-destructive/40 bg-muted p-4">
          <p className="m-0 text-sm">Could not load this program.</p>
          <Button
            type="button"
            variant="outline"
            className="mt-2 min-h-11"
            onClick={() => void reloadProgram()}
          >
            Try again
          </Button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        <Link
          to="/programs"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Back to programs"
        >
          ←
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="m-0 truncate text-lg font-semibold">{meta.title}</h1>
            <ProgramVisibilityBadge visibility={meta.visibility} />
          </div>
          {meta.description ? (
            <p className="m-0 mt-0.5 text-sm text-text-secondary">
              {meta.description}
            </p>
          ) : null}
          {meta.forkSourceLabel ? (
            <p className="m-0 mt-1 text-sm text-muted-foreground">
              Based on {meta.forkSourceLabel}
            </p>
          ) : null}
        </div>
        <span
          className="flex items-center gap-1 text-sm text-muted-foreground"
          role="status"
        >
          {blockedLabel ??
            (offline
              ? "Not saved"
              : saveIndicator === "saving"
                ? "Saving…"
                : saveIndicator === "saved"
                  ? "Saved"
                  : saveIndicator === "error"
                    ? "Save failed"
                    : null)}
          {saveIndicator === "error" && !blockedLabel && !offline ? (
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 px-2 text-brand-text"
              onClick={retrySave}
            >
              Retry
            </Button>
          ) : null}
        </span>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={() => setShareOpen(true)}
        >
          <Share2 className="size-4" aria-hidden />
          Share
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          aria-label="Program settings"
          className="min-h-11 min-w-11"
          onClick={openSettings}
        >
          <Settings className="size-5" aria-hidden />
        </Button>
      </div>

      {meta.visibility === "public" ? (
        <p className="mt-3 text-sm text-text-secondary">
          Changes go live as they save. Addresses and links don&apos;t change.
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <div
          className="flex max-w-full gap-0 overflow-x-auto border-b border-border"
          role="tablist"
          aria-label="Weeks"
        >
          {Array.from({ length: meta.weeks }, (_, i) => i + 1).map((w) => (
            <button
              key={w}
              type="button"
              role="tab"
              aria-selected={selectedWeek === w}
              onClick={() => setSelectedWeek(w)}
              className={cn(
                "min-h-11 shrink-0 px-4 text-sm font-medium",
                selectedWeek === w
                  ? "border-b-2 border-primary text-foreground"
                  : "text-text-secondary",
              )}
            >
              Week {w}
            </button>
          ))}
          {meta.weeks < 52 ? (
            <button
              type="button"
              className="min-h-11 shrink-0 px-4 text-sm font-medium text-brand-text"
              onClick={() => void addWeek()}
              disabled={staleRevision || structuralPending}
            >
              + Add week
            </button>
          ) : null}
        </div>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          onClick={onCopyWeekClick}
          disabled={staleRevision || structuralPending}
        >
          Copy week
        </Button>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        {weekSessions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No sessions this week yet. Add one below.
          </p>
        ) : null}
        {weekSessions.map((session) => (
          <SessionCard
            key={session.id}
            session={session}
            exercises={exercises}
            expanded={expanded}
            onToggleExpanded={toggleExpanded}
            onUpdate={(updater) => updateSession(session.id, updater)}
            onRemove={() => setRemoveSessionTarget(session)}
            onPickExercise={openPickerForEntry}
            onAddExercise={() => openPickerForNewEntry(session.id)}
            onAnnounce={setAnnouncement}
            errors={blockers.bySession[session.id]}
            unitSystem={unitSystem}
            stale={staleRevision}
          />
        ))}
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full sm:w-auto"
          disabled={staleRevision}
          onClick={() => {
            const session = newSession(selectedWeek, weekSessions);
            commitSessions([...sessionsRef.current, session]);
            scheduleSave(session.id);
          }}
        >
          Add session
        </Button>
      </div>

      <ExercisePicker
        open={pickerOpen}
        onOpenChange={(open) => {
          setPickerOpen(open);
          if (!open) {
            setPickerSessionId(null);
            setPickerEntryId(null);
          }
        }}
        onSelect={(ex) => {
          const sessionId = pickerSessionId;
          const entryId = pickerEntryId;
          if (!sessionId) return;
          setExercises((prev) => ({
            ...prev,
            [ex.id]: {
              name: ex.name,
              musclePrimary: ex.musclePrimary,
              equipment: ex.equipment,
              formNote: ex.formNote,
              isCustom: ex.isCustom,
            },
          }));
          if (entryId) {
            updateSession(sessionId, (s) => ({
              ...s,
              entries: s.entries.map((entry) =>
                entry.id === entryId ? { ...entry, exerciseId: ex.id } : entry,
              ),
            }));
          } else {
            const row = newEntryRow(ex.id);
            updateSession(sessionId, (s) => ({
              ...s,
              entries: appendEntry(s.entries, row),
            }));
            setExpanded((prev) => new Set(prev).add(row.id));
          }
          setPickerOpen(false);
          setPickerSessionId(null);
          setPickerEntryId(null);
        }}
      />

      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Program settings</SheetTitle>
          </SheetHeader>
          <form
            className="flex flex-col gap-4 px-4 pb-6"
            onSubmit={saveSettings}
          >
            <div>
              <Label htmlFor="set-title">Title</Label>
              <Input
                id="set-title"
                className="mt-1 min-h-11"
                value={draft.title}
                onChange={(e) =>
                  setDraft((m) => ({ ...m, title: e.target.value }))
                }
                aria-invalid={draftErrors?.title != null}
                aria-describedby={
                  draftErrors?.title ? "set-title-err" : undefined
                }
              />
              <FieldError id="set-title-err" message={draftErrors?.title} />
            </div>
            <div>
              <Label htmlFor="set-desc">
                Description <span className="font-normal">(optional)</span>
              </Label>
              <textarea
                id="set-desc"
                className="mt-1 flex min-h-[76px] w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                value={draft.description}
                onChange={(e) =>
                  setDraft((m) => ({ ...m, description: e.target.value }))
                }
                aria-invalid={draftErrors?.description != null}
                aria-describedby={
                  draftErrors?.description ? "set-desc-err" : undefined
                }
              />
              <FieldError
                id="set-desc-err"
                message={draftErrors?.description}
              />
            </div>
            <MetaPickers meta={draft} setMeta={setDraft} errors={draftErrors} />
            {shareProgram.slug && authorSlugPrefix ? (
              <div>
                <Label htmlFor="set-program-slug">Program address</Label>
                <div
                  className={cn(
                    "mt-1 flex min-h-11 overflow-hidden rounded-lg border bg-card",
                    programSlugStatus === "error"
                      ? "border-danger"
                      : programSlugStatus === "ok"
                        ? "border-data-positive"
                        : "border-border",
                  )}
                >
                  <span className="flex shrink-0 items-center border-r border-border bg-muted px-3 text-sm text-muted-foreground">
                    /u/{authorSlugPrefix}/
                  </span>
                  <Input
                    id="set-program-slug"
                    className="min-h-11 border-0 shadow-none"
                    value={programSlug}
                    onChange={(e) => setProgramSlug(e.target.value)}
                    aria-invalid={programSlugStatus === "error"}
                  />
                </div>
                {programSlugStatus === "checking" ? (
                  <p className="hint">Checking availability…</p>
                ) : null}
                {programSlugStatus === "ok" ? (
                  <p className="text-sm text-data-positive">
                    {programSlugMessage}
                  </p>
                ) : null}
                {programSlugStatus === "error" && programSlugMessage ? (
                  <p className="field-error">{programSlugMessage}</p>
                ) : null}
                <p className="hint">
                  Old addresses redirect here after a change. Share links keep
                  working.
                </p>
              </div>
            ) : null}
            <Button
              type="submit"
              className="min-h-11"
              disabled={
                staleRevision || structuralPending || draftErrors != null
              }
            >
              Save settings
            </Button>
          </form>
        </SheetContent>
      </Sheet>

      <Sheet open={copyWeekOpen} onOpenChange={setCopyWeekOpen}>
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Copy week {selectedWeek} to…</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 px-4 pb-6">
            <div>
              <Label htmlFor="copy-target">Target week</Label>
              <select
                id="copy-target"
                className="mt-1 flex h-11 w-full rounded-lg border border-border bg-card px-3"
                value={copyTargetWeek}
                onChange={(e) => setCopyTargetWeek(Number(e.target.value))}
              >
                {Array.from({ length: meta.weeks }, (_, i) => i + 1).map(
                  (w) => (
                    <option key={w} value={w}>
                      Week {w}
                    </option>
                  ),
                )}
              </select>
            </div>
            <Button
              type="button"
              className="min-h-11"
              disabled={copyPending}
              onClick={() => {
                if (targetSessionCount > 0) {
                  setCopyConfirmOpen(true);
                } else {
                  void runCopyWeek();
                }
              }}
            >
              Copy week
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={copyConfirmOpen} onOpenChange={setCopyConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace week {copyTargetWeek}?</DialogTitle>
            <DialogDescription>
              This replaces {targetSessionCount} session
              {targetSessionCount === 1 ? "" : "s"} in week {copyTargetWeek}{" "}
              with the contents of week {selectedWeek}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => setCopyConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="min-h-11"
              disabled={copyPending}
              onClick={() => void runCopyWeek()}
            >
              Replace week
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={removeSessionTarget != null}
        onOpenChange={(o) => !o && setRemoveSessionTarget(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Remove {removeSessionTarget?.title ?? "session"}?
            </DialogTitle>
            <DialogDescription>
              This removes the session and its exercises from this week. You
              can&apos;t undo this.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              onClick={() => setRemoveSessionTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="min-h-11"
              disabled={structuralPending}
              onClick={() => void confirmRemoveSession()}
            >
              Remove session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ShareDialog
        open={shareOpen}
        onOpenChange={setShareOpen}
        program={shareProgram}
        runExclusive={(job) => queue.enqueue(job)}
        onProgramUpdated={(updated) => {
          setShareProgram({
            id: updated.id,
            title: updated.title,
            visibility: updated.visibility,
            shareToken: updated.shareToken,
            slug: updated.slug,
            revision: updated.revision,
          });
          setMeta((m) => ({ ...m, visibility: updated.visibility }));
          queue.setRevision(updated.revision);
        }}
      />
      <p className="sr-only" role="status" aria-live="polite">
        {announcement}
      </p>
    </section>
  );
}

function metaToPayload(m: MetaState): ProgramMeta {
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

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-xs text-destructive">
      {message}
    </p>
  );
}

function MetaPickers({
  meta,
  setMeta,
  errors,
}: {
  meta: MetaState;
  setMeta: React.Dispatch<React.SetStateAction<MetaState>>;
  errors: MetaErrors | null;
}) {
  return (
    <>
      <div>
        <span className="text-sm font-medium text-muted-foreground">Goal</span>
        <div className="mt-1 flex flex-wrap gap-1">
          {PROGRAM_GOALS.map((g) => (
            <button
              key={g}
              type="button"
              aria-pressed={meta.goal === g}
              onClick={() => setMeta((m) => ({ ...m, goal: g }))}
              className={cn(
                "min-h-11 rounded-lg border px-3 text-sm",
                meta.goal === g
                  ? "border-primary bg-brand-soft"
                  : "border-border",
              )}
            >
              {goalDisplayLabel(g)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <span className="text-sm font-medium text-muted-foreground">Level</span>
        <div className="mt-1 flex flex-wrap gap-1">
          {PROGRAM_LEVELS.map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={meta.level === l}
              onClick={() => setMeta((m) => ({ ...m, level: l }))}
              className={cn(
                "min-h-11 rounded-lg border px-3 text-sm",
                meta.level === l
                  ? "border-primary bg-brand-soft"
                  : "border-border",
              )}
            >
              {levelDisplayLabel(l)}
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label htmlFor="set-days">Sessions per week</Label>
        <Input
          id="set-days"
          type="number"
          min={1}
          max={7}
          className="mt-1 min-h-11"
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
          className="mt-1 min-h-11"
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
        <span className="text-sm font-medium text-muted-foreground">
          Equipment
        </span>
        <div className="mt-1 flex flex-wrap gap-2">
          {EQUIPMENT.map((eq) => {
            const on = meta.equipmentTags.includes(eq);
            return (
              <button
                key={eq}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  setMeta((m) => ({
                    ...m,
                    equipmentTags: on
                      ? m.equipmentTags.filter((t) => t !== eq)
                      : [...m.equipmentTags, eq],
                  }))
                }
                className={cn(
                  "min-h-11 rounded-lg border px-3 text-sm",
                  on ? "border-primary bg-brand-soft" : "border-border",
                )}
              >
                {equipmentDisplayLabel(eq)}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

function SessionCard({
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
      <EntryRow
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
        <div className="min-w-0 max-w-md flex-1">
          <Input
            value={session.title}
            onChange={(e) => onUpdate((s) => ({ ...s, title: e.target.value }))}
            aria-label="Session title"
            aria-invalid={errors?.title != null}
            aria-describedby={errors?.title ? `${uid}-title-err` : undefined}
            className="min-h-11 font-semibold"
          />
          <FieldError id={`${uid}-title-err`} message={errors?.title} />
        </div>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 text-destructive"
          onClick={onRemove}
          disabled={stale}
        >
          Remove
        </Button>
      </div>
      <textarea
        aria-label="Session notes"
        placeholder="Session notes (optional)"
        value={session.notes ?? ""}
        onChange={(e) =>
          onUpdate((s) => ({ ...s, notes: e.target.value || null }))
        }
        aria-invalid={errors?.notes != null}
        aria-describedby={errors?.notes ? `${uid}-notes-err` : undefined}
        className="mt-2 flex min-h-[60px] w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm"
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
              <span className="text-xs font-semibold uppercase text-muted-foreground">
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
        className="mt-3 min-h-11"
        disabled={stale}
        onClick={onAddExercise}
      >
        Add exercise
      </Button>
    </article>
  );
}

/** Holds the typed text so "7." or "-" survive while the parsed value is stored. */
function DraftNumberField({
  id,
  label,
  value,
  toText,
  fromText,
  onChange,
  error,
  className,
  inputMode,
}: {
  id: string;
  label: string;
  value: number | null;
  toText: (value: number | null) => string;
  fromText: (text: string) => number | null;
  onChange: (value: number | null) => void;
  error: string | undefined;
  className?: string;
  inputMode: "numeric" | "decimal";
}) {
  const [text, setText] = useState(() => toText(value));
  const lastSent = useRef(value);
  useEffect(() => {
    // Outside changes (type switch, reload) replace the draft; our own edits do not.
    if (!Object.is(value, lastSent.current)) {
      lastSent.current = value;
      setText(toText(value));
    }
  }, [value, toText]);

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode={inputMode}
        className={cn("mt-1 min-h-11", className)}
        value={text}
        onChange={(e) => {
          const parsed = fromText(e.target.value);
          setText(e.target.value);
          lastSent.current = parsed;
          onChange(parsed);
        }}
        aria-invalid={error != null}
        aria-describedby={error ? `${id}-err` : undefined}
      />
      <FieldError id={`${id}-err`} message={error} />
    </div>
  );
}

function NumberField(props: {
  id: string;
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  error: string | undefined;
  className?: string;
  inputMode?: "numeric" | "decimal";
}) {
  return (
    <DraftNumberField
      {...props}
      inputMode={props.inputMode ?? "numeric"}
      toText={numberToInput}
      fromText={parseNumberInput}
    />
  );
}

function LoadField({
  id,
  value,
  unitSystem,
  onChange,
  error,
}: {
  id: string;
  value: number | null;
  unitSystem: UnitSystem;
  onChange: (kg: number | null) => void;
  error: string | undefined;
}) {
  const toText = useCallback(
    (kg: number | null) => loadToInput(kg, unitSystem),
    [unitSystem],
  );
  const fromText = useCallback(
    (text: string) => loadFromInput(text, unitSystem),
    [unitSystem],
  );
  return (
    <DraftNumberField
      id={id}
      label={`Load in ${loadUnitLabel(unitSystem)}`}
      value={value}
      toText={toText}
      fromText={fromText}
      onChange={onChange}
      error={error}
      className="w-24"
      inputMode="decimal"
    />
  );
}

const selectClass =
  "mt-1 flex h-11 rounded-lg border border-border bg-card px-2 text-sm";

function EntryRow({
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
  return (
    <div
      className={cn(
        "rounded-lg border bg-background p-3",
        hasErrors ? "border-destructive" : "border-border",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onToggle}
          className="inline-flex min-h-11 min-w-11 items-center justify-center text-muted-foreground"
          aria-expanded={expanded}
          aria-label={`${expanded ? "Collapse" : "Edit"} ${exerciseName}`}
        >
          {expanded ? (
            <ChevronDown className="size-5" aria-hidden />
          ) : (
            <ChevronRight className="size-5" aria-hidden />
          )}
        </button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11 flex-1 justify-start"
          onClick={onPick}
          disabled={stale}
        >
          {exerciseName}
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
              <select
                id={`${uid}-reps-type`}
                className={selectClass}
                value={entry.repsType}
                onChange={(e) => {
                  const t = e.target.value as ProgramEntryDTO["repsType"];
                  onUpdate({
                    repsType: t,
                    repsValue: t === "max" ? null : t === "seconds" ? 30 : 10,
                  });
                }}
              >
                <option value="count">Number</option>
                <option value="max">Max</option>
                <option value="seconds">Seconds</option>
              </select>
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
              <select
                id={`${uid}-load-type`}
                className={selectClass}
                value={entry.loadType}
                onChange={(e) => {
                  const t = e.target.value as ProgramEntryDTO["loadType"];
                  onUpdate({
                    loadType: t,
                    loadValue:
                      t === "none"
                        ? null
                        : t === "kg"
                          ? defaultKgLoad(unitSystem)
                          : 70,
                  });
                }}
              >
                <option value="none">None</option>
                <option value="kg">{loadUnitLabel(unitSystem)}</option>
                <option value="percent1rm">%1RM</option>
              </select>
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
              <select
                id={`${uid}-int-type`}
                className={selectClass}
                value={entry.intensityType}
                onChange={(e) => {
                  const t = e.target.value as ProgramEntryDTO["intensityType"];
                  onUpdate({
                    intensityType: t,
                    intensityValue: t === "none" ? null : t === "rpe" ? 8 : 2,
                  });
                }}
              >
                <option value="none">None</option>
                <option value="rpe">RPE</option>
                <option value="rir">RIR</option>
              </select>
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
            <textarea
              id={`${uid}-cues`}
              className="mt-1 flex min-h-[60px] w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm"
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
              className="mt-1 min-h-11"
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
                size="icon-lg"
                className="min-h-11 min-w-11"
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
                size="icon-lg"
                className="min-h-11 min-w-11"
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
              className="min-h-11 text-destructive"
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
