export type AppErrorCode =
  | "PRO_REQUIRED"
  | "NOT_READY"
  | "UNAUTHORIZED"
  | "INVALID_DATE"
  | "INVALID_KCAL"
  | "INVALID_PROTEIN"
  | "BILLING_NOT_CONFIGURED"
  | "NO_STRIPE_CUSTOMER"
  | "EMAIL_REQUIRED"
  | "PROGRAM_NOT_FOUND"
  | "NOT_AUTHOR"
  | "SLUG_TAKEN"
  | "INVALID_TRANSITION"
  | "INVALID_ENTRY"
  | "STALE_REVISION";

const APP_ERROR_CODES: readonly AppErrorCode[] = [
  "PRO_REQUIRED",
  "NOT_READY",
  "UNAUTHORIZED",
  "INVALID_DATE",
  "INVALID_KCAL",
  "INVALID_PROTEIN",
  "BILLING_NOT_CONFIGURED",
  "NO_STRIPE_CUSTOMER",
  "EMAIL_REQUIRED",
  "PROGRAM_NOT_FOUND",
  "NOT_AUTHOR",
  "SLUG_TAKEN",
  "INVALID_TRANSITION",
  "INVALID_ENTRY",
  "STALE_REVISION",
];

export function isAppErrorCode(value: unknown): value is AppErrorCode {
  return (
    typeof value === "string" && APP_ERROR_CODES.includes(value as AppErrorCode)
  );
}

/** Wire shape: thrown Error.message is exactly the code string. */
export function appError(code: AppErrorCode): Error {
  return new Error(code);
}
