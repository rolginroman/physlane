import { Link } from "@tanstack/react-router";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { ExercisePicker } from "#/components/programs/exercise-picker";
import { ProgramVisibilityBadge } from "#/components/programs/program-visibility-badge";
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
import { isAppErrorCode } from "#/lib/app-error";
import {
  equipmentDisplayLabel,
  goalDisplayLabel,
  levelDisplayLabel,
} from "#/lib/programs/display-labels";
import type {
  ProgramEntry,
  ProgramSession,
} from "#/lib/programs/program-shape";
import {
  EQUIPMENT,
  PROGRAM_GOALS,
  PROGRAM_LEVELS,
  type Equipment,
  type ProgramGoal,
  type ProgramLevel,
} from "#/lib/programs/taxonomy";
import {
  getMyProgram,
  removeSession,
  updateProgramMeta,
  upsertSession,
  type ProgramDTO,
  type ProgramEntryDTO,
  type ProgramExerciseRefDTO,
  type ProgramSessionDTO,
} from "#/server/programs.fns";

type SaveIndicator = "idle" | "saving" | "saved" | "error";

function nullIfEmpty(value: string | null | undefined): string | null {
  if (value == null || value.trim() === "") {
    return null;
  }
  return value;
}

function entryToPayload(entry: ProgramEntryDTO): ProgramEntry {
  const sets = Math.min(20, Math.max(1, Math.floor(Number(entry.sets)) || 3));
  let repsValue = entry.repsValue;
  if (entry.repsType === "max") {
    repsValue = null;
  } else if (!Number.isFinite(repsValue)) {
    repsValue = entry.repsType === "seconds" ? 30 : 10;
  }
  const loadType = entry.loadType;
  const intensityType = entry.intensityType;
  return {
    exerciseId: entry.exerciseId,
    groupTag: entry.groupTag,
    sets,
    repsType: entry.repsType,
    repsValue,
    loadType,
    loadValue: loadType === "none" ? null : entry.loadValue,
    intensityType,
    intensityValue: intensityType === "none" ? null : entry.intensityValue,
    restSeconds: entry.restSeconds,
    cues: nullIfEmpty(entry.cues),
    refUrl: nullIfEmpty(entry.refUrl),
  };
}

function sessionToPayload(session: ProgramSessionDTO): ProgramSession {
  return {
    weekNumber: session.weekNumber,
    orderIndex: session.orderIndex,
    title: session.title,
    notes: nullIfEmpty(session.notes),
    entries: session.entries
      .filter((e) => e.exerciseId.length > 0)
      .map(entryToPayload),
  };
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

function newSession(weekNumber: number, orderIndex: number): ProgramSessionDTO {
  return {
    id: crypto.randomUUID(),
    weekNumber,
    orderIndex,
    title: `Session ${orderIndex + 1}`,
    notes: null,
    entries: [],
  };
}

type ProgramEditorProps = {
  initial: ProgramDTO & {
    sessions: ProgramSessionDTO[];
    exercises: Record<string, ProgramExerciseRefDTO>;
  };
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

export function ProgramEditor({ initial }: ProgramEditorProps) {
  const programId = initial.id;
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
  const [sessions, setSessions] = useState(initial.sessions);
  const [exercises, setExercises] = useState(initial.exercises);
  const revisionRef = useRef(initial.revision);
  const [, setRevision] = useState(initial.revision);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [saveIndicator, setSaveIndicator] = useState<SaveIndicator>("saved");
  const [staleRevision, setStaleRevision] = useState(false);
  const [offline, setOffline] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
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
  const dirtySessionsRef = useRef<Map<string, ProgramSessionDTO>>(new Map());
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setOffline(!navigator.onLine);
    const onOnline = () => setOffline(false);
    const onOffline = () => setOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

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
      if (dto.sessions) {
        setSessions(dto.sessions);
      }
      if (dto.exercises) {
        setExercises(dto.exercises);
      }
      revisionRef.current = dto.revision;
      setRevision(dto.revision);
    },
    [],
  );

  const flushSave = useCallback(async () => {
    if (staleRevision || offline) return;
    const pending = [...dirtySessionsRef.current.entries()];
    if (pending.length === 0) return;
    setSaveIndicator("saving");
    try {
      let rev = revisionRef.current;
      for (const [sessionId, session] of pending) {
        const dto = await upsertSession({
          data: {
            programId,
            expectedRevision: rev,
            session: {
              id: sessionId,
              ...sessionToPayload(session),
            },
          },
        });
        rev = dto.revision;
        revisionRef.current = rev;
        setRevision(rev);
        if (dto.sessions) {
          setSessions(dto.sessions);
        }
        dirtySessionsRef.current.delete(sessionId);
      }
      setSaveIndicator("saved");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (isAppErrorCode(message) && message === "STALE_REVISION") {
        setStaleRevision(true);
        setSaveIndicator("idle");
        return;
      }
      setSaveIndicator("error");
    }
  }, [offline, programId, staleRevision]);

  const scheduleSave = useCallback(
    (session: ProgramSessionDTO) => {
      if (staleRevision || offline) return;
      dirtySessionsRef.current.set(session.id, session);
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = setTimeout(() => {
        void flushSave();
      }, 800);
    },
    [flushSave, offline, staleRevision],
  );

  const updateSession = (
    sessionId: string,
    updater: (s: ProgramSessionDTO) => ProgramSessionDTO,
  ) => {
    setSessions((prev) => {
      const next = prev.map((s) => (s.id === sessionId ? updater(s) : s));
      const updated = next.find((s) => s.id === sessionId);
      if (updated) {
        scheduleSave(updated);
      }
      return next;
    });
  };

  const addWeek = async () => {
    if (meta.weeks >= 52 || staleRevision) return;
    const nextWeeks = meta.weeks + 1;
    setSaveIndicator("saving");
    try {
      const dto = await updateProgramMeta({
        data: {
          programId,
          expectedRevision: revisionRef.current,
          meta: {
            title: meta.title,
            description: meta.description || null,
            weeks: nextWeeks,
            goal: meta.goal,
            level: meta.level,
            daysPerWeek: meta.daysPerWeek,
            equipmentTags: meta.equipmentTags,
          },
        },
      });
      applyProgram(dto);
      setSelectedWeek(nextWeeks);
      setSaveIndicator("saved");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === "STALE_REVISION") {
        setStaleRevision(true);
      } else {
        setSaveIndicator("error");
      }
    }
  };

  const saveSettings = async (e: FormEvent) => {
    e.preventDefault();
    setSaveIndicator("saving");
    try {
      const dto = await updateProgramMeta({
        data: {
          programId,
          expectedRevision: revisionRef.current,
          meta: {
            title: meta.title,
            description: meta.description || null,
            weeks: meta.weeks,
            goal: meta.goal,
            level: meta.level,
            daysPerWeek: meta.daysPerWeek,
            equipmentTags: meta.equipmentTags,
          },
        },
      });
      applyProgram(dto);
      setSettingsOpen(false);
      setSaveIndicator("saved");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === "STALE_REVISION") {
        setStaleRevision(true);
      } else {
        setSaveIndicator("error");
      }
    }
  };

  const confirmRemoveSession = async () => {
    if (!removeSessionTarget) return;
    setSaveIndicator("saving");
    try {
      const dto = await removeSession({
        data: {
          programId,
          expectedRevision: revisionRef.current,
          sessionId: removeSessionTarget.id,
        },
      });
      applyProgram(dto);
      dirtySessionsRef.current.delete(removeSessionTarget.id);
      setRemoveSessionTarget(null);
      setSaveIndicator("saved");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === "STALE_REVISION") {
        setStaleRevision(true);
      } else {
        setSaveIndicator("error");
      }
    }
  };

  const runCopyWeek = async () => {
    setCopyPending(true);
    setSaveIndicator("saving");
    try {
      let rev = revisionRef.current;
      const source = sessions.filter((s) => s.weekNumber === selectedWeek);
      const targetExisting = sessions.filter(
        (s) => s.weekNumber === copyTargetWeek,
      );
      for (const old of targetExisting) {
        const dto = await removeSession({
          data: {
            programId,
            expectedRevision: rev,
            sessionId: old.id,
          },
        });
        rev = dto.revision;
        if (dto.sessions) {
          setSessions(dto.sessions);
        }
      }
      for (let i = 0; i < source.length; i++) {
        const src = source[i];
        if (!src) continue;
        const dto = await upsertSession({
          data: {
            programId,
            expectedRevision: rev,
            session: {
              weekNumber: copyTargetWeek,
              orderIndex: i,
              title: src.title,
              notes: src.notes,
              entries: src.entries.map(entryToPayload),
            },
          },
        });
        rev = dto.revision;
        if (dto.sessions) {
          setSessions(dto.sessions);
        }
      }
      revisionRef.current = rev;
      setRevision(rev);
      setCopyWeekOpen(false);
      setCopyConfirmOpen(false);
      setSaveIndicator("saved");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === "STALE_REVISION") {
        setStaleRevision(true);
      } else {
        setSaveIndicator("error");
      }
    } finally {
      setCopyPending(false);
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
      if (dto.sessions && dto.exercises) {
        applyProgram({
          ...dto,
          sessions: dto.sessions,
          exercises: dto.exercises,
        });
      }
      dirtySessionsRef.current.clear();
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
        <span className="text-sm text-muted-foreground" role="status">
          {saveIndicator === "saving"
            ? "Saving…"
            : saveIndicator === "saved"
              ? "Saved"
              : saveIndicator === "error"
                ? "Save failed"
                : null}
        </span>
        <Button
          type="button"
          variant="outline"
          size="icon-lg"
          aria-label="Program settings"
          className="min-h-11 min-w-11"
          onClick={() => setSettingsOpen(true)}
        >
          ⚙
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
              disabled={staleRevision}
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
          disabled={staleRevision}
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
            stale={staleRevision}
          />
        ))}
        <Button
          type="button"
          variant="outline"
          className="min-h-11 w-full sm:w-auto"
          disabled={staleRevision}
          onClick={() => {
            const session = newSession(selectedWeek, weekSessions.length);
            setSessions((prev) => [...prev, session]);
            scheduleSave(session);
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
              entries: [...s.entries, { ...row, orderIndex: s.entries.length }],
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
                value={meta.title}
                onChange={(e) =>
                  setMeta((m) => ({ ...m, title: e.target.value }))
                }
              />
            </div>
            <div>
              <Label htmlFor="set-desc">
                Description <span className="font-normal">(optional)</span>
              </Label>
              <textarea
                id="set-desc"
                className="mt-1 flex min-h-[76px] w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                value={meta.description}
                onChange={(e) =>
                  setMeta((m) => ({ ...m, description: e.target.value }))
                }
              />
            </div>
            <MetaPickers meta={meta} setMeta={setMeta} />
            <Button type="submit" className="min-h-11" disabled={staleRevision}>
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
              onClick={() => void confirmRemoveSession()}
            >
              Remove session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function MetaPickers({
  meta,
  setMeta,
}: {
  meta: MetaState;
  setMeta: React.Dispatch<React.SetStateAction<MetaState>>;
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
        <Label>Sessions per week</Label>
        <Input
          type="number"
          min={1}
          max={7}
          className="mt-1 min-h-11"
          value={meta.daysPerWeek}
          onChange={(e) =>
            setMeta((m) => ({
              ...m,
              daysPerWeek: Number(e.target.value),
            }))
          }
        />
      </div>
      <div>
        <Label>Weeks</Label>
        <Input
          type="number"
          min={1}
          max={52}
          className="mt-1 min-h-11"
          value={meta.weeks}
          onChange={(e) =>
            setMeta((m) => ({
              ...m,
              weeks: Number(e.target.value),
            }))
          }
        />
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
  stale: boolean;
}) {
  const grouped = useMemo(() => {
    const tags = new Set(
      session.entries.map((e) => e.groupTag).filter(Boolean) as string[],
    );
    return tags;
  }, [session.entries]);

  return (
    <article className="rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <Input
          value={session.title}
          onChange={(e) => onUpdate((s) => ({ ...s, title: e.target.value }))}
          aria-label="Session title"
          className="min-h-11 max-w-md flex-1 font-semibold"
        />
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
        placeholder="Session notes (optional)"
        value={session.notes ?? ""}
        onChange={(e) =>
          onUpdate((s) => ({ ...s, notes: e.target.value || null }))
        }
        className="mt-2 flex min-h-[60px] w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm"
      />
      <ul className="mt-4 flex flex-col gap-2">
        {session.entries.map((entry, index) => {
          const inSuperset =
            entry.groupTag != null && grouped.has(entry.groupTag);
          const showBracket =
            inSuperset &&
            (index === 0 ||
              session.entries[index - 1]?.groupTag !== entry.groupTag);
          return (
            <li key={entry.id} className="flex gap-2">
              {showBracket ? (
                <div
                  className="w-1 shrink-0 rounded-full bg-chart-neutral"
                  aria-hidden
                />
              ) : (
                <div className="w-1 shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                {showBracket ? (
                  <span className="text-xs font-semibold uppercase text-muted-foreground">
                    Superset
                  </span>
                ) : null}
                <EntryRow
                  entry={entry}
                  exerciseName={
                    exercises[entry.exerciseId]?.name ?? "Choose exercise"
                  }
                  expanded={expanded.has(entry.id)}
                  onToggle={() => onToggleExpanded(entry.id)}
                  onUpdate={(patch) =>
                    onUpdate((s) => ({
                      ...s,
                      entries: s.entries.map((e) =>
                        e.id === entry.id ? { ...e, ...patch } : e,
                      ),
                    }))
                  }
                  onSupersetToggle={() => {
                    if (index === 0) return;
                    const prev = session.entries[index - 1];
                    if (!prev) return;
                    const tag =
                      prev.groupTag ?? `ss-${crypto.randomUUID().slice(0, 8)}`;
                    onUpdate((s) => ({
                      ...s,
                      entries: s.entries.map((e, i) => {
                        if (i === index - 1 && !e.groupTag) {
                          return { ...e, groupTag: tag };
                        }
                        if (i === index) {
                          return {
                            ...e,
                            groupTag: e.groupTag ? null : tag,
                          };
                        }
                        return e;
                      }),
                    }));
                  }}
                  onPick={() => onPickExercise(session.id, entry.id)}
                  onRemoveEntry={() =>
                    onUpdate((s) => ({
                      ...s,
                      entries: s.entries
                        .filter((e) => e.id !== entry.id)
                        .map((e, i) => ({ ...e, orderIndex: i })),
                    }))
                  }
                  canSuperset={index > 0}
                  stale={stale}
                />
              </div>
            </li>
          );
        })}
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

function EntryRow({
  entry,
  exerciseName,
  expanded,
  onToggle,
  onUpdate,
  onSupersetToggle,
  onPick,
  onRemoveEntry,
  canSuperset,
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
  canSuperset: boolean;
  stale: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onToggle}
          className="min-h-11 min-w-11 text-muted-foreground"
          aria-expanded={expanded}
        >
          {expanded ? "▾" : "▸"}
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
          {entry.sets} ×{" "}
          {entry.repsType === "max"
            ? "max"
            : entry.repsType === "seconds"
              ? `${entry.repsValue ?? 0}s`
              : entry.repsValue}
        </span>
      </div>
      {expanded ? (
        <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
          <div className="flex flex-wrap gap-2">
            <div>
              <Label>Sets</Label>
              <Input
                type="number"
                min={1}
                max={20}
                className="mt-1 min-h-11 w-20"
                value={entry.sets}
                onChange={(e) => onUpdate({ sets: Number(e.target.value) })}
              />
            </div>
            <div>
              <Label>Reps type</Label>
              <select
                className="mt-1 flex h-11 rounded-lg border border-border bg-card px-2 text-sm"
                value={entry.repsType}
                onChange={(e) => {
                  const t = e.target.value as ProgramEntryDTO["repsType"];
                  onUpdate({
                    repsType: t,
                    repsValue: t === "max" ? null : (entry.repsValue ?? 10),
                  });
                }}
              >
                <option value="count">Number</option>
                <option value="max">Max</option>
                <option value="seconds">Seconds</option>
              </select>
            </div>
            {entry.repsType !== "max" ? (
              <div>
                <Label>Reps</Label>
                <Input
                  type="number"
                  className="mt-1 min-h-11 w-24"
                  value={entry.repsValue ?? ""}
                  onChange={(e) =>
                    onUpdate({ repsValue: Number(e.target.value) })
                  }
                />
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <div>
              <Label>Load</Label>
              <select
                className="mt-1 flex h-11 rounded-lg border border-border bg-card px-2 text-sm"
                value={entry.loadType}
                onChange={(e) => {
                  const t = e.target.value as ProgramEntryDTO["loadType"];
                  onUpdate({
                    loadType: t,
                    loadValue: t === "none" ? null : (entry.loadValue ?? 40),
                  });
                }}
              >
                <option value="none">None</option>
                <option value="kg">kg</option>
                <option value="percent1rm">%1RM</option>
              </select>
            </div>
            {entry.loadType !== "none" ? (
              <div>
                <Label>Value</Label>
                <Input
                  type="number"
                  className="mt-1 min-h-11 w-24"
                  value={entry.loadValue ?? ""}
                  onChange={(e) =>
                    onUpdate({ loadValue: Number(e.target.value) })
                  }
                />
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <div>
              <Label>Intensity</Label>
              <select
                className="mt-1 flex h-11 rounded-lg border border-border bg-card px-2 text-sm"
                value={entry.intensityType}
                onChange={(e) => {
                  const t = e.target.value as ProgramEntryDTO["intensityType"];
                  onUpdate({
                    intensityType: t,
                    intensityValue:
                      t === "none" ? null : (entry.intensityValue ?? 8),
                  });
                }}
              >
                <option value="none">None</option>
                <option value="rpe">RPE</option>
                <option value="rir">RIR</option>
              </select>
            </div>
            {entry.intensityType !== "none" ? (
              <div>
                <Label>Value</Label>
                <Input
                  type="number"
                  className="mt-1 min-h-11 w-24"
                  value={entry.intensityValue ?? ""}
                  onChange={(e) =>
                    onUpdate({ intensityValue: Number(e.target.value) })
                  }
                />
              </div>
            ) : null}
          </div>
          <div>
            <Label>Rest (seconds)</Label>
            <Input
              type="number"
              min={0}
              className="mt-1 min-h-11 w-32"
              value={entry.restSeconds ?? ""}
              onChange={(e) =>
                onUpdate({
                  restSeconds: e.target.value ? Number(e.target.value) : null,
                })
              }
            />
          </div>
          {canSuperset ? (
            <div className="flex min-h-11 items-center justify-between gap-2">
              <span className="text-sm">Superset with previous</span>
              <Switch
                checked={entry.groupTag != null}
                onCheckedChange={() => onSupersetToggle()}
                disabled={stale}
              />
            </div>
          ) : null}
          <div>
            <Label>
              Cues <span className="font-normal">(optional)</span>
            </Label>
            <textarea
              className="mt-1 flex min-h-[60px] w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm"
              value={entry.cues ?? ""}
              onChange={(e) => onUpdate({ cues: e.target.value || null })}
            />
          </div>
          <div>
            <Label>
              Reference link <span className="font-normal">(optional)</span>
            </Label>
            <Input
              className="mt-1 min-h-11"
              value={entry.refUrl ?? ""}
              onChange={(e) => onUpdate({ refUrl: e.target.value || null })}
              placeholder="https://"
            />
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
      ) : null}
    </div>
  );
}
