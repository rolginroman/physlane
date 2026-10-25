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

export type ProgramAction =
  | "change-visibility"
  | "replace-link"
  | "copy-link"
  | "create"
  | "delete"
  | "load-list"
  | "fork"
  | "report";

const ACTION_MESSAGES: Record<ProgramAction, string> = {
  "change-visibility":
    "Couldn't change who can open this program. Nothing changed. Try again.",
  "replace-link":
    "Couldn't replace the share link. Nothing changed. Try again.",
  "copy-link": "Couldn't copy. Select the link and copy it by hand.",
  create: "Could not create the program. Try again.",
  delete: "Couldn't delete this program. Nothing changed. Try again.",
  "load-list": "Your programs didn't load.",
  fork: "Couldn't copy this program. Try again.",
  report: "Couldn't send your report. Try again.",
};

/** Codes that carry their own fix; everything else gets the action's copy. */
const CODES_WITH_OWN_MESSAGE: readonly string[] = [
  "SLUG_TAKEN",
  "STALE_REVISION",
  "INVALID_ENTRY",
  "REPORT_RATE_LIMITED",
];

export function programActionErrorMessage(
  action: ProgramAction,
  code?: AppErrorCode | string,
): string {
  if (code && CODES_WITH_OWN_MESSAGE.includes(code)) {
    return programErrorMessage(code);
  }
  return ACTION_MESSAGES[action];
}
