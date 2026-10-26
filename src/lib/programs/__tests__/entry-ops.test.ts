import { describe, expect, it } from "vitest";
import {
  appendEntry,
  groupEntryBlocks,
  isJoinedToPrevious,
  moveEntry,
  nextSessionDefaults,
  normalizeGroupTags,
  removeEntry,
  toggleSupersetWithPrevious,
} from "#/lib/programs/entry-ops";

type E = { id: string; groupTag: string | null; orderIndex: number };

const entry = (id: string, groupTag: string | null = null): E => ({
  id,
  groupTag,
  orderIndex: 0,
});
const ids = (entries: E[]) => entries.map((e) => e.id);
const tags = (entries: E[]) => entries.map((e) => e.groupTag);

describe("normalizeGroupTags", () => {
  it("drops tags on lone entries and keeps adjacent pairs", () => {
    const out = normalizeGroupTags([
      entry("a", "x"),
      entry("b"),
      entry("c", "y"),
      entry("d", "y"),
    ]);
    expect(tags(out)).toEqual([null, null, "y", "y"]);
  });

  it("splits a tag shared by non-adjacent runs into distinct groups", () => {
    const out = normalizeGroupTags([
      entry("a1111111", "t"),
      entry("b", "t"),
      entry("c"),
      entry("d2222222", "t"),
      entry("e", "t"),
    ]);
    expect(out[0]?.groupTag).toBe("t");
    expect(out[1]?.groupTag).toBe("t");
    expect(out[3]?.groupTag).not.toBeNull();
    expect(out[3]?.groupTag).not.toBe("t");
    expect(out[3]?.groupTag).toBe(out[4]?.groupTag);
  });
});

describe("toggleSupersetWithPrevious", () => {
  it("groups an entry with an untagged previous one", () => {
    const out = toggleSupersetWithPrevious([entry("a"), entry("b")], 1);
    expect(out[0]?.groupTag).not.toBeNull();
    expect(out[0]?.groupTag).toBe(out[1]?.groupTag);
    expect(isJoinedToPrevious(out, 1)).toBe(true);
    expect(isJoinedToPrevious(out, 0)).toBe(false);
  });

  it("removes a two-entry group entirely when toggled off", () => {
    const grouped = toggleSupersetWithPrevious([entry("a"), entry("b")], 1);
    const out = toggleSupersetWithPrevious(grouped, 1);
    expect(tags(out)).toEqual([null, null]);
  });

  it("splits a chain at the toggled entry and keeps the tail grouped", () => {
    const out = toggleSupersetWithPrevious(
      [entry("a", "t"), entry("b", "t"), entry("c", "t"), entry("d", "t")],
      2,
    );
    expect(out[0]?.groupTag).toBe("t");
    expect(out[1]?.groupTag).toBe("t");
    expect(out[2]?.groupTag).not.toBe("t");
    expect(out[2]?.groupTag).not.toBeNull();
    expect(out[2]?.groupTag).toBe(out[3]?.groupTag);
  });

  it("leaves no lone tag when the chain end is toggled off", () => {
    const out = toggleSupersetWithPrevious(
      [entry("a", "t"), entry("b", "t"), entry("c", "t")],
      2,
    );
    expect(tags(out)).toEqual(["t", "t", null]);
  });

  it("merges an entry's own group into the previous group", () => {
    const out = toggleSupersetWithPrevious(
      [entry("a", "p"), entry("b", "p"), entry("c", "q"), entry("d", "q")],
      2,
    );
    expect(tags(out)).toEqual(["p", "p", "p", "p"]);
  });

  it("does nothing at the first row", () => {
    const rows = [entry("a"), entry("b")];
    expect(toggleSupersetWithPrevious(rows, 0)).toEqual(rows);
  });
});

describe("removeEntry", () => {
  it("clears the tag the removed entry's partner would be left with", () => {
    const out = removeEntry(
      [entry("a", "t"), entry("b", "t"), entry("c")],
      "a",
    );
    expect(ids(out)).toEqual(["b", "c"]);
    expect(tags(out)).toEqual([null, null]);
  });

  it("keeps a group of three intact after removing one member", () => {
    const out = removeEntry(
      [entry("a", "t"), entry("b", "t"), entry("c", "t")],
      "b",
    );
    expect(tags(out)).toEqual(["t", "t"]);
  });

  it("renumbers orderIndex to array position", () => {
    const out = removeEntry([entry("a"), entry("b"), entry("c")], "a");
    expect(out.map((e) => e.orderIndex)).toEqual([0, 1]);
  });
});

describe("appendEntry", () => {
  it("appends and renumbers", () => {
    const out = appendEntry([entry("a")], entry("b"));
    expect(out.map((e) => e.orderIndex)).toEqual([0, 1]);
  });
});

describe("moveEntry", () => {
  it("swaps neighbours and reports the new index", () => {
    const result = moveEntry([entry("a"), entry("b"), entry("c")], 1, -1);
    expect(result && ids(result.entries)).toEqual(["b", "a", "c"]);
    expect(result?.index).toBe(0);
    expect(result?.entries.map((e) => e.orderIndex)).toEqual([0, 1, 2]);
  });

  it("returns null at the ends", () => {
    const rows = [entry("a"), entry("b")];
    expect(moveEntry(rows, 0, -1)).toBeNull();
    expect(moveEntry(rows, 1, 1)).toBeNull();
  });

  it("hops an ungrouped entry over a whole superset instead of splitting it", () => {
    const rows = [entry("x"), entry("a", "t"), entry("b", "t"), entry("y")];
    const down = moveEntry(rows, 0, 1);
    expect(down && ids(down.entries)).toEqual(["a", "b", "x", "y"]);
    expect(down && tags(down.entries)).toEqual(["t", "t", null, null]);
    expect(down?.index).toBe(2);
    const up = moveEntry(rows, 3, -1);
    expect(up && ids(up.entries)).toEqual(["x", "y", "a", "b"]);
    expect(up?.index).toBe(1);
  });

  it("keeps a member inside its superset while reordering within it", () => {
    const rows = [entry("a", "t"), entry("b", "t"), entry("c", "t")];
    const result = moveEntry(rows, 1, 1);
    expect(result && ids(result.entries)).toEqual(["a", "c", "b"]);
    expect(result && tags(result.entries)).toEqual(["t", "t", "t"]);
  });

  it("drops the tag of a member moved out of a two-entry superset", () => {
    const rows = [entry("a", "t"), entry("b", "t"), entry("c")];
    const result = moveEntry(rows, 1, 1);
    expect(result && ids(result.entries)).toEqual(["a", "c", "b"]);
    expect(result && tags(result.entries)).toEqual([null, null, null]);
  });
});

describe("groupEntryBlocks", () => {
  it("renders a lone tagged entry as a single, not a superset", () => {
    const blocks = groupEntryBlocks([entry("a", "t"), entry("b")]);
    expect(blocks.map((b) => b.kind)).toEqual(["single", "single"]);
  });

  it("groups adjacent entries and keeps their indexes", () => {
    const blocks = groupEntryBlocks([
      entry("a"),
      entry("b", "t"),
      entry("c", "t"),
    ]);
    expect(blocks.map((b) => b.kind)).toEqual(["single", "group"]);
    const group = blocks[1];
    expect(group?.kind === "group" && group.items.map((i) => i.index)).toEqual([
      1, 2,
    ]);
  });

  it("does not merge non-adjacent entries sharing a tag", () => {
    const blocks = groupEntryBlocks([
      entry("a", "t"),
      entry("b"),
      entry("c", "t"),
    ]);
    expect(blocks.every((b) => b.kind === "single")).toBe(true);
  });
});

describe("nextSessionDefaults", () => {
  it("does not reuse an order index or title after a removal", () => {
    const remaining = [
      { orderIndex: 0, title: "Session 1" },
      { orderIndex: 2, title: "Session 3" },
    ];
    expect(nextSessionDefaults(remaining)).toEqual({
      orderIndex: 3,
      title: "Session 4",
    });
  });

  it("starts at 0 for an empty week", () => {
    expect(nextSessionDefaults([])).toEqual({
      orderIndex: 0,
      title: "Session 1",
    });
  });
});
