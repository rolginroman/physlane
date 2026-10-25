import type { AppErrorCode } from "#/lib/app-error";

export function programErrorMessage(code: AppErrorCode | string): string {
  switch (code) {
    case "SLUG_TAKEN":
      return "That address is already taken. Try again in a moment.";
    case "INVALID_TRANSITION":
      return "Couldn't change who can open this program. Nothing changed.";
    case "INVALID_ENTRY":
      return "This program has sessions that don't fit the new settings.";
    case "REPORT_RATE_LIMITED":
      return "Too many reports from this network today. Try again tomorrow.";
    case "STALE_REVISION":
      return "This program was updated elsewhere. Reload and try again.";
    default:
      return "Something went wrong. Nothing changed. Try again.";
  }
}
