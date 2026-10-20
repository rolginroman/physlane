const SCOPE_LABELS: Record<string, string> = {
  openid: "Verify your identity (OpenID Connect)",
  profile: "Your name and profile information",
  offline_access: "Stay connected (refresh access when needed)",
  "mcp:read": "Read your physlane data",
  "mcp:write": "Write: log meals, measurements, cycles",
};

/** Human-readable label for an OAuth scope string. */
export function oauthScopeLabel(scope: string): string {
  const trimmed = scope.trim();
  if (!trimmed) return trimmed;
  return SCOPE_LABELS[trimmed] ?? trimmed;
}

/** Map requested scope strings to display labels (deduped, order preserved). */
export function oauthScopeLabels(scopes: string[]): string[] {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const scope of scopes) {
    const key = scope.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    labels.push(oauthScopeLabel(key));
  }
  return labels;
}
