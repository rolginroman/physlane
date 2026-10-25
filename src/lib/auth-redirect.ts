/** Post-auth navigation target; rejects open redirects. */
export function safeAuthRedirect(path: string | undefined): string {
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return "/dashboard";
  }
  return path;
}
