export type AuthErrorLike = {
  code?: string
  message?: string
  status?: number
}

/** Map better-auth error codes to plain English. Cause plus what to do next. */
export function authErrorMessage(
  error: AuthErrorLike,
  fallback = 'Something went wrong. Check your details and try again.',
): string {
  switch (error.code) {
    case 'INVALID_EMAIL_OR_PASSWORD':
    case 'INVALID_PASSWORD':
    case 'USER_NOT_FOUND':
      return 'Email or password is incorrect.'
    case 'USER_ALREADY_EXISTS':
      return 'An account with this email already exists. Sign in instead.'
    case 'PASSWORD_TOO_SHORT':
    case 'INVALID_PASSWORD_LENGTH':
      return 'Password must be at least 8 characters.'
    case 'INVALID_EMAIL':
      return 'Enter a valid email address.'
    case 'INVALID_NAME':
      return 'Enter your name.'
    case 'RATE_LIMITED':
      return 'Too many attempts. Wait a moment and try again.'
    default:
      return fallback
  }
}
