export class WriteQueueHaltedError extends Error {
  constructor() {
    super("WRITE_QUEUE_HALTED");
  }
}

export type WriteQueue = {
  /** Revision the next job should send; read it when the job runs, not when it is queued. */
  readonly revision: number;
  setRevision: (revision: number) => void;
  /** Runs jobs one at a time in call order. A rejected job does not block later ones. */
  enqueue: <T>(job: () => Promise<T>) => Promise<T>;
  /** Drops queued jobs (they reject with WriteQueueHaltedError) until `resume`. */
  halt: () => void;
  resume: (revision: number) => void;
  readonly halted: boolean;
};

/**
 * Serializes every program mutation so each one sees the revision the previous
 * one produced. `haltOn` runs before the next job starts, so a stale revision
 * stops the queue without racing a follow-up write.
 */
export function createWriteQueue(
  initialRevision: number,
  options: { haltOn?: (error: unknown) => boolean } = {},
): WriteQueue {
  let revision = initialRevision;
  let halted = false;
  let tail: Promise<unknown> = Promise.resolve();
  const settle = () => undefined;

  return {
    get revision() {
      return revision;
    },
    get halted() {
      return halted;
    },
    setRevision(next) {
      revision = next;
    },
    enqueue(job) {
      const run = async () => {
        if (halted) {
          throw new WriteQueueHaltedError();
        }
        try {
          return await job();
        } catch (error) {
          if (options.haltOn?.(error)) {
            halted = true;
          }
          throw error;
        }
      };
      const result = tail.then(run);
      tail = result.then(settle, settle);
      return result;
    },
    halt() {
      halted = true;
    },
    resume(next) {
      revision = next;
      halted = false;
    },
  };
}

export type DirtyTracker = {
  /** Records an edit and returns the session's new version. */
  mark: (sessionId: string) => number;
  versionOf: (sessionId: string) => number | undefined;
  /** Clears the marker only when no edit landed since `sentVersion` was read. */
  clearIfUnchanged: (sessionId: string, sentVersion: number) => boolean;
  drop: (sessionId: string) => void;
  clear: () => void;
  ids: () => string[];
  readonly size: number;
};

export function createDirtyTracker(): DirtyTracker {
  const versions = new Map<string, number>();
  let counter = 0;
  return {
    mark(sessionId) {
      counter += 1;
      versions.set(sessionId, counter);
      return counter;
    },
    versionOf: (sessionId) => versions.get(sessionId),
    clearIfUnchanged(sessionId, sentVersion) {
      if (versions.get(sessionId) !== sentVersion) {
        return false;
      }
      versions.delete(sessionId);
      return true;
    },
    drop: (sessionId) => {
      versions.delete(sessionId);
    },
    clear: () => versions.clear(),
    ids: () => [...versions.keys()],
    get size() {
      return versions.size;
    },
  };
}

/**
 * Folds a server response into local editor state. Local copies win for every
 * session the editor already holds, so a response never reverts newer typing
 * or collapses open rows; the server only contributes sessions the editor has
 * not seen (e.g. copied weeks). Local sessions missing on the server survive
 * only while they have unsaved edits.
 */
export function mergeServerSessions<T extends { id: string }>(
  local: readonly T[],
  server: readonly T[],
  dirtyIds: ReadonlySet<string>,
): T[] {
  const localById = new Map(local.map((s) => [s.id, s]));
  const serverIds = new Set(server.map((s) => s.id));
  const merged = server.map((s) => localById.get(s.id) ?? s);
  for (const s of local) {
    if (!serverIds.has(s.id) && dirtyIds.has(s.id)) {
      merged.push(s);
    }
  }
  return merged;
}
