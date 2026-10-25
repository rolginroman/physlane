export type SlugValidationResult = { ok: true } | { ok: false; reason: string };

/** Route/protocol words that must never appear as a slug segment under /u/. */
const RESERVED_SLUGS = new Set([
  "p",
  "share",
  "u",
  "programs",
  "api",
  "admin",
  "sign-in",
  "sign-up",
  "settings",
  "support",
  "privacy",
  "terms",
  "blog",
  "physlane",
  "www",
  "mail",
]);

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function validateSlug(input: string): SlugValidationResult {
  if (input.length < 3) {
    return { ok: false, reason: "Slug must be at least 3 characters." };
  }
  if (input.length > 40) {
    return { ok: false, reason: "Slug must be at most 40 characters." };
  }
  if (input.startsWith("-") || input.endsWith("-")) {
    return { ok: false, reason: "Slug cannot start or end with a hyphen." };
  }
  if (input.includes("--")) {
    return { ok: false, reason: "Slug cannot contain consecutive hyphens." };
  }
  if (!SLUG_PATTERN.test(input)) {
    return {
      ok: false,
      reason:
        "Slug must use lowercase letters, digits, and single hyphens only.",
    };
  }
  if (RESERVED_SLUGS.has(input)) {
    return { ok: false, reason: "That slug is reserved." };
  }
  return { ok: true };
}

export function suggestSlug(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (!normalized) return "";
  return normalized.length > 40
    ? normalized.slice(0, 40).replace(/-$/, "")
    : normalized;
}
