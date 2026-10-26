const FORK_SOURCE_LABEL_SEP = " · ";

/** Author display name from a fork attribution label (`Author · Title`). */
export function forkAttributionAuthorName(forkSourceLabel: string): string {
  const i = forkSourceLabel.indexOf(FORK_SOURCE_LABEL_SEP);
  return i === -1 ? forkSourceLabel : forkSourceLabel.slice(0, i);
}
