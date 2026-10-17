/**
 * Public progress-card tokens (G2.6) — pure helpers.
 *
 * The token is opaque and random (no signature needed): possession of the
 * URL is the grant, and rotating the token revokes every prior link.
 */

/** 32 hex chars, no dashes. */
export function newShareToken(): string {
	return crypto.randomUUID().replaceAll("-", "");
}

/** `${origin}/share/${token}` — tolerates a trailing slash on the origin. */
export function shareUrl(origin: string, token: string): string {
	return `${origin.replace(/\/+$/, "")}/share/${token}`;
}

/** Only the first name of a display name ever reaches a public card. */
export function publicFirstName(name: string | null | undefined): string | null {
	const first = (name ?? "").trim().split(/\s+/)[0];
	return first ? first : null;
}
