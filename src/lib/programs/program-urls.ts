import { SITE_URL } from "#/lib/seo";

export function publicProgramCanonicalPath(
  authorSlug: string,
  programSlug: string,
): string {
  return `/u/${authorSlug}/${programSlug}`;
}

export function publicProgramCanonicalUrl(
  authorSlug: string,
  programSlug: string,
): string {
  return `${SITE_URL}${publicProgramCanonicalPath(authorSlug, programSlug)}`;
}

export function publicProgramIdPermalinkPath(
  authorSlug: string,
  programId: string,
): string {
  return `/u/${authorSlug}/p/${programId}`;
}

export function shareLinkPath(
  authorSlug: string,
  programSlug: string,
  shareToken: string,
): string {
  return `/u/${authorSlug}/${programSlug}/${shareToken}`;
}

export function shareLinkUrl(
  authorSlug: string,
  programSlug: string,
  shareToken: string,
): string {
  return `${SITE_URL}${shareLinkPath(authorSlug, programSlug, shareToken)}`;
}

export function shareLinkUrlFromOrigin(
  origin: string,
  authorSlug: string,
  programSlug: string,
  shareToken: string,
): string {
  return `${origin.replace(/\/$/, "")}${shareLinkPath(authorSlug, programSlug, shareToken)}`;
}

export function publicProgramCanonicalUrlFromOrigin(
  origin: string,
  authorSlug: string,
  programSlug: string,
): string {
  return `${origin.replace(/\/$/, "")}${publicProgramCanonicalPath(authorSlug, programSlug)}`;
}
