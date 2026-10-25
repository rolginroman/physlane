import { Link } from "@tanstack/react-router";
import { useSession } from "#/lib/auth-client";

export function PublicProgramShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, isPending } = useSession();

  return (
    <div className="min-h-dvh bg-background">
      <header className="flex min-h-14 items-center gap-3 border-b border-border px-4 sm:px-8">
        <Link
          to="/"
          className="font-display text-2xl tracking-tight text-foreground no-underline"
        >
          physlane
        </Link>
        <span className="flex-1" />
        {isPending ? null : session?.user ? (
          <span
            className="flex size-8 items-center justify-center rounded-full border border-border bg-muted text-sm font-semibold text-text-secondary"
            aria-label="Account"
          >
            {(session.user.name ?? "?").slice(0, 1).toUpperCase()}
          </span>
        ) : (
          <Link
            to="/sign-in"
            className="inline-flex min-h-11 items-center text-sm font-medium text-text-secondary underline decoration-border underline-offset-4"
          >
            Sign in
          </Link>
        )}
      </header>
      {children}
    </div>
  );
}
