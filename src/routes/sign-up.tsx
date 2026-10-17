import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState, type FormEvent } from 'react'
import { signUp } from '#/lib/auth-client'
import { authErrorMessage } from '#/lib/auth-error'

export const Route = createFileRoute('/sign-up')({
  head: () => ({
    meta: [
      { title: 'Create account · physlane' },
      { name: 'robots', content: 'noindex, follow' },
    ],
    links: [{ rel: 'canonical', href: 'https://physlane.unpackit.top/sign-up' }],
  }),
  component: SignUpPage,
})

type FieldErrors = { name?: string; email?: string; password?: string }

function SignUpPage() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [errors, setErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  function validateName(): string | undefined {
    if (!name.trim()) return 'Enter your name.'
    return undefined
  }

  function validateEmail(): string | undefined {
    const value = email.trim()
    if (!value) return 'Enter your email address.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return 'Enter a valid email address.'
    }
    return undefined
  }

  function validatePassword(): string | undefined {
    if (password.length < 8) return 'Password must be at least 8 characters.'
    return undefined
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const nextErrors: FieldErrors = {
      name: validateName(),
      email: validateEmail(),
      password: validatePassword(),
    }
    setErrors(nextErrors)
    setServerError(null)
    if (nextErrors.name || nextErrors.email || nextErrors.password) return

    setPending(true)
    const { error } = await signUp.email({
      name: name.trim(),
      email: email.trim(),
      password,
    })
    if (error) {
      setServerError(authErrorMessage(error))
      setPending(false)
      return
    }
    await navigate({ to: '/dashboard' })
  }

  return (
    <main className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center px-4 py-10">
      <div className="card w-full max-w-sm p-6">
        <h1 className="m-0 text-lg font-semibold tracking-tight">
          Create account
        </h1>
        <p className="mt-1 mb-6 text-sm text-dim">
          Your first log takes under two minutes.
        </p>

        {serverError && (
          <p
            role="alert"
            className="mb-4 rounded-lg border border-rose/40 bg-rose/10 px-3 py-2 text-sm text-rose"
          >
            {serverError}
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-4">
            <label htmlFor="sign-up-name" className="label">
              Name
            </label>
            <input
              id="sign-up-name"
              name="name"
              type="text"
              autoComplete="name"
              className="input"
              placeholder="Your name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onBlur={() =>
                setErrors((prev) => ({ ...prev, name: validateName() }))
              }
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? 'sign-up-name-error' : undefined}
            />
            {errors.name && (
              <p id="sign-up-name-error" className="field-error">
                {errors.name}
              </p>
            )}
          </div>

          <div className="mb-4">
            <label htmlFor="sign-up-email" className="label">
              Email
            </label>
            <input
              id="sign-up-email"
              name="email"
              type="email"
              autoComplete="email"
              className="input"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onBlur={() =>
                setErrors((prev) => ({ ...prev, email: validateEmail() }))
              }
              aria-invalid={errors.email ? true : undefined}
              aria-describedby={errors.email ? 'sign-up-email-error' : undefined}
            />
            {errors.email && (
              <p id="sign-up-email-error" className="field-error">
                {errors.email}
              </p>
            )}
          </div>

          <div className="mb-6">
            <label htmlFor="sign-up-password" className="label">
              Password
            </label>
            <div className="relative">
              <input
                id="sign-up-password"
                name="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                className="input pr-12"
                placeholder="At least 8 characters"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onBlur={() =>
                  setErrors((prev) => ({ ...prev, password: validatePassword() }))
                }
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={
                  errors.password ? 'sign-up-password-error' : undefined
                }
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-xs font-medium text-dim hover:text-text"
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {errors.password ? (
              <p id="sign-up-password-error" className="field-error">
                {errors.password}
              </p>
            ) : (
              <p className="hint">At least 8 characters.</p>
            )}
          </div>

          <button type="submit" disabled={pending} className="btn-primary w-full">
            {pending ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-5 mb-0 text-center text-sm text-dim">
          Already have an account?{' '}
          <Link
            to="/sign-in"
            className="font-medium text-accent underline decoration-line underline-offset-2 hover:text-accent-dim"
          >
            Sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
