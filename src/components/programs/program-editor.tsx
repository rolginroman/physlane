import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { ExercisePicker } from "#/components/programs/exercise-picker";
import { ProgramEditorBanners } from "#/components/programs/program-editor-banners";
import { ProgramEditorCopyWeekSheet } from "#/components/programs/program-editor-copy-week-sheet";
import { ProgramEditorHeader } from "#/components/programs/program-editor-header";
import { ProgramEditorSessionCard } from "#/components/programs/program-editor-session-card";
import {
  ProgramEditorSettingsSheet,
  metaToPayload,
  type MetaState,
} from "#/components/programs/program-editor-settings-sheet";
import { ProgramEditorWeekBar } from "#/components/programs/program-editor-week-bar";
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
import { Tabs, TabsContent } from "#/components/ui/tabs";
import { useMediaQuery } from "#/hooks/use-media-query";
import {
  WriteQueueHaltedError,
  createDirtyTracker,
  createWriteQueue,
  mergeServerSessions,
} from "#/lib/programs/editor-save-queue";
import { appendEntry, nextSessionDefaults } from "#/lib/programs/entry-ops";
import {
  collectSaveBlockers,
  entryToPayload,
  saveBlockedLabel,
  sessionToPayload,
  validateSession,
} from "#/lib/programs/entry-validation";
import { validateMetaDraft } from "#/lib/programs/meta-validation";
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

const MAX_WEEKS = 52;

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
    if (meta.weeks >= MAX_WEEKS || staleRevision) return;
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
  const desktop = useMediaQuery("(min-width: 64rem)");
  const saveLabel =
    blockedLabel ??
    (offline
      ? "Not saved"
      : saveIndicator === "saving"
        ? "Saving…"
        : saveIndicator === "saved"
          ? "Saved"
          : saveIndicator === "error"
            ? "Save failed"
            : null);

  return (
    <section className="pt-4 pb-8">
      <ProgramEditorBanners
        forkBannerOpen={forkBannerOpen}
        onDismissFork={() => setForkBannerOpen(false)}
        staleRevision={staleRevision}
        loadError={loadError}
        offline={offline}
        reloadPending={reloadPending}
        onReload={() => void reloadProgram()}
      />
      <ProgramEditorHeader
        title={meta.title}
        description={meta.description}
        forkSourceLabel={meta.forkSourceLabel}
        visibility={meta.visibility}
        saveLabel={saveLabel}
        showRetry={saveIndicator === "error" && !blockedLabel && !offline}
        onRetry={retrySave}
        onShare={() => setShareOpen(true)}
        onSettings={openSettings}
      />

      {meta.visibility === "public" ? (
        <p className="mt-3 text-sm text-text-secondary">
          Changes go live as they save. Addresses and links don&apos;t change.
        </p>
      ) : null}

      <Tabs
        value={selectedWeek}
        onValueChange={(week) => setSelectedWeek(Number(week))}
        orientation={desktop ? "vertical" : "horizontal"}
        className="mt-4 gap-6 lg:gap-8"
      >
        <ProgramEditorWeekBar
          weeks={meta.weeks}
          vertical={desktop}
          maxWeeks={MAX_WEEKS}
          disabled={staleRevision || structuralPending}
          onAddWeek={() => void addWeek()}
          onCopyWeek={onCopyWeekClick}
        />
        <TabsContent
          value={selectedWeek}
          className="flex min-w-0 flex-col gap-4"
        >
          {weekSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No sessions this week yet. Add one below.
            </p>
          ) : null}
          {weekSessions.map((session) => (
            <ProgramEditorSessionCard
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
            size="touch"
            className="w-full sm:w-auto sm:self-start"
            disabled={staleRevision}
            onClick={() => {
              const session = newSession(selectedWeek, weekSessions);
              commitSessions([...sessionsRef.current, session]);
              scheduleSave(session.id);
            }}
          >
            Add session
          </Button>
        </TabsContent>
      </Tabs>

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

      <ProgramEditorSettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        draft={draft}
        setDraft={setDraft}
        errors={draftErrors}
        slug={
          shareProgram.slug && authorSlugPrefix
            ? {
                authorPrefix: authorSlugPrefix,
                value: programSlug,
                onChange: setProgramSlug,
                status: programSlugStatus,
                message: programSlugMessage,
              }
            : null
        }
        submitDisabled={
          staleRevision || structuralPending || draftErrors != null
        }
        onSubmit={saveSettings}
      />

      <ProgramEditorCopyWeekSheet
        open={copyWeekOpen}
        onOpenChange={setCopyWeekOpen}
        confirmOpen={copyConfirmOpen}
        onConfirmOpenChange={setCopyConfirmOpen}
        sourceWeek={selectedWeek}
        weeks={meta.weeks}
        targetWeek={copyTargetWeek}
        onTargetWeekChange={setCopyTargetWeek}
        targetSessionCount={targetSessionCount}
        pending={copyPending}
        onCopy={() => void runCopyWeek()}
      />

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
              size="touch"
              onClick={() => setRemoveSessionTarget(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="touch"
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
