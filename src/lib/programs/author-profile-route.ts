/** True when pathname is the author profile leaf (`/u/{slug}`), not a child route. */
export function isAuthorProfileLeafPath(
  pathname: string,
  authorSlug: string,
): boolean {
  const slugSegment = /^\/u\/([^/]+)\/?$/.exec(pathname)?.[1];
  if (!slugSegment) {
    return false;
  }
  return decodeURIComponent(slugSegment) === authorSlug;
}
