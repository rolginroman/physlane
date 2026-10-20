import {
  createFileRoute,
  Link,
  useNavigate,
  useRouter,
} from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { authClient, signIn } from "#/lib/auth-client";
import { authErrorMessage } from "#/lib/auth-error";
import { getWebApp } from "#/lib/telegram-web";
import { signInEmailWithOAuthContinuation } from "./-oauth-flow-client";
import { hasOAuthContinuation } from "./-oauth-signed-query";

export const Route = createFileRoute("/sign-in")({
  head: () => ({
    meta: [
      { title: "Sign in · physlane" },
      { name: "robots", content: "noindex, follow" },
    ],
    links: [
      { rel: "canonical", href: "https://physlane.unpackit.top/sign-in" },
    ],
  }),
  component: SignInPage,
});

type FieldErrors = { email?: string; password?: string };

/**
 * Module-level so a redirect loop (sign-in → dashboard → back to sign-in on a
 * failed attempt) can never re-trigger the mini-app auto sign-in.
 */
let miniAppSignInAttempted = false;

function SignInPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [miniApp, setMiniApp] = useState<"signing" | "failed">("failed");
  const attempted = useRef(false);

  // Zero-tap sign-in inside the Telegram mini app: exchange initData for a
  // session, then re-enter the app so the _auth guard passes. Client-only
  // (useEffect), runs once per page load, falls back to the form on failure.
  useEffect(() => {
    if (attempted.current || miniAppSignInAttempted) return;
    attempted.current = true;
    const tg = getWebApp();
    if (!tg || !tg.initData) return;
    miniAppSignInAttempted = true;
    setMiniApp("signing");
    void (async () => {
      const { error } = await authClient.signInWithMiniApp(tg.initData);
      if (error) {
        setMiniApp("failed");
        return;
      }
      await router.invalidate();
      await navigate({ to: "/dashboard", replace: true });
    })();
  }, [navigate, router]);

  if (miniApp === "signing") {
    return (
      <main className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center px-4 py-10">
        <div className="card w-full max-w-sm p-6" role="status">
          <h1 className="m-0 text-lg font-semibold tracking-tight">
            Signing you in…
          </h1>
          <p className="mt-1 mb-0 text-sm text-dim">
            One moment while Telegram signs you in.
          </p>
        </div>
      </main>
    );
  }

  function validateEmail(): string | undefined {
    const value = email.trim();
    if (!value) return "Enter your email address.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return "Enter a valid email address.";
    }
    return undefined;
  }

  function validatePassword(): string | undefined {
    if (!password) return "Enter your password.";
    return undefined;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: FieldErrors = {
      email: validateEmail(),
      password: validatePassword(),
    };
    setErrors(nextErrors);
    setServerError(null);
    if (nextErrors.email || nextErrors.password) return;

    setPending(true);
    const trimmedEmail = email.trim();
    if (hasOAuthContinuation(window.location.search)) {
      const result = await signInEmailWithOAuthContinuation(
        trimmedEmail,
        password,
      );
      if (!result.ok) {
        setServerError(
          authErrorMessage({
            code:
              typeof result.body.code === "string"
                ? result.body.code
                : undefined,
            message:
              typeof result.body.message === "string"
                ? result.body.message
                : undefined,
          }),
        );
        setPending(false);
        return;
      }
      if (result.redirectUrl) {
        window.location.href = result.redirectUrl;
        return;
      }
      await navigate({ to: "/dashboard" });
      return;
    }
    const { error } = await signIn.email({ email: trimmedEmail, password });
    if (error) {
      setServerError(authErrorMessage(error));
      setPending(false);
      return;
    }
    await navigate({ to: "/dashboard" });
  }

  return (
    <main className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center px-4 py-10">
      <div className="card w-full max-w-sm p-6">
        <h1 className="m-0 text-lg font-semibold tracking-tight">Sign in</h1>
        <p className="mt-1 mb-6 text-sm text-dim">
          Weigh in, log intake, watch the trend.
        </p>

        {serverError && (
          <p
            role="alert"
            className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
          >
            {serverError}
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div className="mb-4">
            <label htmlFor="sign-in-email" className="label">
              Email
            </label>
            <input
              id="sign-in-email"
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
              aria-describedby={
                errors.email ? "sign-in-email-error" : undefined
              }
            />
            {errors.email && (
              <p id="sign-in-email-error" className="field-error">
                {errors.email}
              </p>
            )}
          </div>

          <div className="mb-6">
            <label htmlFor="sign-in-password" className="label">
              Password
            </label>
            <div className="relative">
              <input
                id="sign-in-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                className="input pr-12"
                placeholder="Your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onBlur={() =>
                  setErrors((prev) => ({
                    ...prev,
                    password: validatePassword(),
                  }))
                }
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={
                  errors.password ? "sign-in-password-error" : undefined
                }
              />
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-xs font-medium text-dim hover:text-text"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
            {errors.password && (
              <p id="sign-in-password-error" className="field-error">
                {errors.password}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={pending}
            className="btn-primary w-full"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-5 mb-0 text-center text-sm text-dim">
          No account?{" "}
          <Link
            to="/sign-up"
            className="font-medium text-accent underline decoration-line underline-offset-2 hover:text-accent-dim"
          >
            Create one
          </Link>
        </p>
      </div>
    </main>
  );
}
