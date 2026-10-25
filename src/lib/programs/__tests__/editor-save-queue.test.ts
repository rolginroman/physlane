import { describe, expect, it } from "vitest";
import {
  WriteQueueHaltedError,
  createDirtyTracker,
  createWriteQueue,
  mergeServerSessions,
} from "#/lib/programs/editor-save-queue";

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("createWriteQueue", () => {
  it("runs one job at a time and reads the revision when each job runs", async () => {
    const queue = createWriteQueue(1);
    const gate = deferred();
    const seen: number[] = [];
    const running: string[] = [];

    const first = queue.enqueue(async () => {
      running.push("first:start");
      seen.push(queue.revision);
      await gate.promise;
      queue.setRevision(2);
      running.push("first:end");
    });
    const second = queue.enqueue(async () => {
      running.push("second:start");
      seen.push(queue.revision);
      queue.setRevision(3);
    });

    await tick();
    expect(running).toEqual(["first:start"]);
    gate.resolve();
    await Promise.all([first, second]);

    expect(running).toEqual(["first:start", "first:end", "second:start"]);
    expect(seen).toEqual([1, 2]);
    expect(queue.revision).toBe(3);
  });

  it("keeps running later jobs after one rejects", async () => {
    const queue = createWriteQueue(1);
    const failing = queue.enqueue(async () => {
      throw new Error("boom");
    });
    const next = queue.enqueue(async () => "ok");
    await expect(failing).rejects.toThrow("boom");
    await expect(next).resolves.toBe("ok");
  });

  it("halts before the next queued job starts when haltOn matches", async () => {
    const queue = createWriteQueue(1, {
      haltOn: (e) => e instanceof Error && e.message === "STALE_REVISION",
    });
    const ran: string[] = [];
    const stale = queue.enqueue(async () => {
      throw new Error("STALE_REVISION");
    });
    const queued = queue.enqueue(async () => {
      ran.push("queued");
    });

    await expect(stale).rejects.toThrow("STALE_REVISION");
    await expect(queued).rejects.toBeInstanceOf(WriteQueueHaltedError);
    expect(ran).toEqual([]);
    expect(queue.halted).toBe(true);

    queue.resume(9);
    await queue.enqueue(async () => {
      ran.push(`after-resume@${queue.revision}`);
    });
    expect(ran).toEqual(["after-resume@9"]);
  });
});

describe("createDirtyTracker", () => {
  it("keeps the marker when an edit lands after the version was sent", () => {
    const dirty = createDirtyTracker();
    const sent = dirty.mark("s1");
    dirty.mark("s1");
    expect(dirty.clearIfUnchanged("s1", sent)).toBe(false);
    expect(dirty.ids()).toEqual(["s1"]);
  });

  it("clears the marker when nothing changed since send", () => {
    const dirty = createDirtyTracker();
    const sent = dirty.mark("s1");
    dirty.mark("s2");
    expect(dirty.clearIfUnchanged("s1", sent)).toBe(true);
    expect(dirty.ids()).toEqual(["s2"]);
    expect(dirty.size).toBe(1);
  });

  it("versions are per edit across sessions", () => {
    const dirty = createDirtyTracker();
    const a = dirty.mark("s1");
    const b = dirty.mark("s2");
    expect(b).toBeGreaterThan(a);
    expect(dirty.versionOf("s1")).toBe(a);
  });
});

describe("mergeServerSessions", () => {
  type S = { id: string; title: string };

  it("keeps local content for sessions the editor already holds", () => {
    const local: S[] = [{ id: "a", title: "typed more" }];
    const server: S[] = [{ id: "a", title: "older save" }];
    expect(mergeServerSessions(local, server, new Set(["a"]))).toEqual(local);
    expect(mergeServerSessions(local, server, new Set())).toEqual(local);
  });

  it("adopts sessions only the server knows about", () => {
    const local: S[] = [{ id: "a", title: "A" }];
    const server: S[] = [
      { id: "a", title: "A" },
      { id: "copied", title: "Copied" },
    ];
    expect(
      mergeServerSessions(local, server, new Set()).map((s) => s.id),
    ).toEqual(["a", "copied"]);
  });

  it("keeps unsaved local sessions but drops clean ones the server removed", () => {
    const local: S[] = [
      { id: "new", title: "unsaved" },
      { id: "gone", title: "removed elsewhere" },
    ];
    const merged = mergeServerSessions(local, [], new Set(["new"]));
    expect(merged.map((s) => s.id)).toEqual(["new"]);
  });
});
