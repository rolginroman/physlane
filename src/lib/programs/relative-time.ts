/** Relative "Edited …" copy for program rows (client-only). */
export function formatEditedAt(iso: string, now = Date.now()): string {
  const then = Date.parse(iso);
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) {
    return "Edited just now";
  }
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) {
    return diffMin === 1
      ? "Edited 1 minute ago"
      : `Edited ${diffMin} minutes ago`;
  }
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) {
    return diffHr === 1 ? "Edited 1 hour ago" : `Edited ${diffHr} hours ago`;
  }
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) {
    return diffDay === 1 ? "Edited yesterday" : `Edited ${diffDay} days ago`;
  }
  if (diffDay < 30) {
    const weeks = Math.floor(diffDay / 7);
    return weeks === 1 ? "Edited 1 week ago" : `Edited ${weeks} weeks ago`;
  }
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) {
    return diffMonth === 1
      ? "Edited 1 month ago"
      : `Edited ${diffMonth} months ago`;
  }
  const diffYear = Math.floor(diffMonth / 12);
  return diffYear === 1 ? "Edited 1 year ago" : `Edited ${diffYear} years ago`;
}
