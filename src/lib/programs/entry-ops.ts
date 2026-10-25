/** Fields the structural edits below read and write; DTOs carry more. */
export type EditableEntry = {
  id: string;
  groupTag?: string | null;
  orderIndex: number;
};

function supersetTagFor(entry: { id: string }): string {
  return `ss-${entry.id.slice(0, 8)}`;
}

/**
 * Keeps only supersets of two or more adjacent entries. A tag shared by
 * non-adjacent runs splits into one tag per run, and lone members lose theirs.
 */
export function normalizeGroupTags<T extends EditableEntry>(
  entries: readonly T[],
): T[] {
  const result = [...entries];
  const used = new Set<string>();
  let i = 0;
  while (i < result.length) {
    const first = result[i];
    const tag = first?.groupTag;
    if (!first || tag == null) {
      i += 1;
      continue;
    }
    let end = i + 1;
    while (end < result.length && result[end]?.groupTag === tag) end += 1;

    let keep: string | null = null;
    if (end - i >= 2) {
      keep = tag;
      while (used.has(keep)) keep = `${keep}x`;
      used.add(keep);
    }
    if (keep !== tag) {
      for (let j = i; j < end; j++) {
        const entry = result[j];
        if (entry) result[j] = { ...entry, groupTag: keep };
      }
    }
    i = end;
  }
  return result;
}

/** Array position is the order the server persists; keep the field in step. */
export function renumberEntries<T extends EditableEntry>(
  entries: readonly T[],
): T[] {
  return entries.map((entry, index) =>
    entry.orderIndex === index ? entry : { ...entry, orderIndex: index },
  );
}

/** Run after every structural edit (add, remove, move, toggle). */
export function finalizeEntries<T extends EditableEntry>(
  entries: readonly T[],
): T[] {
  return renumberEntries(normalizeGroupTags(entries));
}

export function removeEntry<T extends EditableEntry>(
  entries: readonly T[],
  entryId: string,
): T[] {
  return finalizeEntries(entries.filter((entry) => entry.id !== entryId));
}

export function appendEntry<T extends EditableEntry>(
  entries: readonly T[],
  entry: T,
): T[] {
  return finalizeEntries([...entries, entry]);
}

/** Whether the entry is grouped with the one above it. */
export function isJoinedToPrevious(
  entries: readonly EditableEntry[],
  index: number,
): boolean {
  const entry = entries[index];
  const previous = entries[index - 1];
  return (
    entry?.groupTag != null &&
    previous != null &&
    previous.groupTag === entry.groupTag
  );
}

function runBounds(
  entries: readonly EditableEntry[],
  index: number,
): { start: number; end: number } {
  const tag = entries[index]?.groupTag;
  if (tag == null) return { start: index, end: index + 1 };
  let start = index;
  while (start > 0 && entries[start - 1]?.groupTag === tag) start -= 1;
  let end = index + 1;
  while (end < entries.length && entries[end]?.groupTag === tag) end += 1;
  return { start, end };
}

/** Joins the entry to the one above, or starts a new group at the entry. */
export function toggleSupersetWithPrevious<T extends EditableEntry>(
  entries: readonly T[],
  index: number,
): T[] {
  const entry = entries[index];
  const previous = entries[index - 1];
  if (!entry || !previous) return [...entries];

  const next = [...entries];
  if (isJoinedToPrevious(entries, index)) {
    const { end } = runBounds(entries, index);
    const tag = supersetTagFor(entry);
    for (let j = index; j < end; j++) {
      const member = next[j];
      if (member) next[j] = { ...member, groupTag: tag };
    }
    return finalizeEntries(next);
  }

  const tag = previous.groupTag ?? supersetTagFor(previous);
  const { start, end } = runBounds(entries, index);
  next[index - 1] = { ...previous, groupTag: tag };
  for (let j = start; j < end; j++) {
    const member = next[j];
    if (member) next[j] = { ...member, groupTag: tag };
  }
  return finalizeEntries(next);
}

/**
 * Moves one entry a step. An entry that is not part of a neighbouring
 * superset hops over the whole group, so a move never splits it.
 * Returns null at the ends.
 */
export function moveEntry<T extends EditableEntry>(
  entries: readonly T[],
  index: number,
  direction: -1 | 1,
): { entries: T[]; index: number } | null {
  const entry = entries[index];
  const neighbourIndex = index + direction;
  const neighbour = entries[neighbourIndex];
  if (!entry || !neighbour) return null;

  let target = neighbourIndex;
  if (neighbour.groupTag != null && neighbour.groupTag !== entry.groupTag) {
    const { start, end } = runBounds(entries, neighbourIndex);
    target = direction === 1 ? end - 1 : start;
  }

  const next = [...entries];
  next.splice(index, 1);
  next.splice(target, 0, entry);
  return { entries: finalizeEntries(next), index: target };
}

export type EntryBlock<T> =
  | { kind: "single"; entry: T; index: number }
  | { kind: "group"; tag: string; items: { entry: T; index: number }[] };

/** Splits entries into display blocks; a tag on a single entry never makes a group. */
export function groupEntryBlocks<T extends { groupTag?: string | null }>(
  entries: readonly T[],
): EntryBlock<T>[] {
  const blocks: EntryBlock<T>[] = [];
  let i = 0;
  while (i < entries.length) {
    const entry = entries[i];
    if (!entry) break;
    const tag = entry.groupTag;
    let end = i + 1;
    if (tag != null) {
      while (end < entries.length && entries[end]?.groupTag === tag) end += 1;
    }
    if (tag != null && end - i >= 2) {
      blocks.push({
        kind: "group",
        tag,
        items: entries
          .slice(i, end)
          .map((e, k) => ({ entry: e, index: i + k })),
      });
    } else {
      for (let j = i; j < end; j++) {
        const single = entries[j];
        if (single) blocks.push({ kind: "single", entry: single, index: j });
      }
    }
    i = end;
  }
  return blocks;
}

/** Defaults for a session added to a week: order past every sibling, an unused title. */
export function nextSessionDefaults(
  weekSessions: readonly { orderIndex: number; title: string }[],
): { orderIndex: number; title: string } {
  const orderIndex =
    weekSessions.reduce((max, s) => Math.max(max, s.orderIndex), -1) + 1;
  const titles = new Set(weekSessions.map((s) => s.title));
  let n = weekSessions.length + 1;
  while (titles.has(`Session ${n}`)) n += 1;
  return { orderIndex, title: `Session ${n}` };
}
