/** True when pathname is the slug program leaf (`/u/{author}/{programRef}`), not a child route. */
export function isProgramPathLeaf(
  pathname: string,
  authorSlug: string,
  programRef: string,
): boolean {
  const match = /^\/u\/([^/]+)\/([^/]+)\/?$/.exec(pathname);
  const authorSegment = match?.[1];
  const programSegment = match?.[2];
  if (!authorSegment || !programSegment) {
    return false;
  }
  return (
    decodeURIComponent(authorSegment) === authorSlug &&
    decodeURIComponent(programSegment) === programRef
  );
}
