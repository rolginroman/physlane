/** Post-auth navigation target; rejects open redirects. */
export function safeAuthRedirect(path: string | undefined): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return "/dashboard";
  }
  return path;
}

/** Preserve fork copy intent on the return URL (shared by sign-in and sign-up). */
export function withForkCopyIntent(path: string): string {
  const safe = safeAuthRedirect(path);
  const qIndex = safe.indexOf("?");
  const base = qIndex === -1 ? safe : safe.slice(0, qIndex);
  const search = qIndex === -1 ? "" : safe.slice(qIndex + 1);
  const params = new URLSearchParams(search);
  params.set("copy", "1");
  const qs = params.toString();
  return `${base}?${qs}`;
}

export function resolveAuthRedirectTarget(
  redirect: string | undefined,
  copyFlag?: boolean,
): string {
  const safe = safeAuthRedirect(redirect);
  if (copyFlag) {
    return withForkCopyIntent(safe);
  }
  return safe;
}
