import { SITE_URL } from "#/lib/seo";

export function publicProgramCanonicalPath(
  authorSlug: string,
  programSlug: string,
): string {
  return `/u/${authorSlug}/p/${programSlug}`;
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

export function shareLinkPath(programId: string, shareToken: string): string {
  return `/p/${programId}?t=${encodeURIComponent(shareToken)}`;
}

export function shareLinkUrl(programId: string, shareToken: string): string {
  return `${SITE_URL}${shareLinkPath(programId, shareToken)}`;
}

export function shareLinkUrlFromOrigin(
  origin: string,
  programId: string,
  shareToken: string,
): string {
  return `${origin.replace(/\/$/, "")}${shareLinkPath(programId, shareToken)}`;
}

export function publicProgramCanonicalUrlFromOrigin(
  origin: string,
  authorSlug: string,
  programSlug: string,
): string {
  return `${origin.replace(/\/$/, "")}${publicProgramCanonicalPath(authorSlug, programSlug)}`;
}
