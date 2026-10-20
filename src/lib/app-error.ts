export type AppErrorCode =
  | "PRO_REQUIRED"
  | "NOT_READY"
  | "UNAUTHORIZED"
  | "INVALID_DATE"
  | "INVALID_KCAL"
  | "INVALID_PROTEIN"
  | "BILLING_NOT_CONFIGURED"
  | "NO_STRIPE_CUSTOMER"
  | "EMAIL_REQUIRED";

/** Wire shape: thrown Error.message is exactly the code string. */
export function appError(code: AppErrorCode): Error {
  return new Error(code);
}
