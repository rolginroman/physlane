import { Link } from "@tanstack/react-router";
import { Header } from "#/components/header";
import { useSession } from "#/lib/auth-client";

export function PublicProgramShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, isPending } = useSession();
  const signedIn = !isPending && Boolean(session?.user);

  return (
    <div className="min-h-dvh bg-background">
      {signedIn ? (
        <Header />
      ) : (
        <header className="flex min-h-14 items-center gap-3 border-b border-border px-4 sm:px-8">
          <Link
            to="/"
            className="font-display text-2xl tracking-tight text-foreground no-underline"
          >
            physlane
          </Link>
          <span className="flex-1" />
          {isPending ? null : (
            <Link
              to="/sign-in"
              className="inline-flex min-h-11 items-center text-sm font-medium text-text-secondary underline decoration-border underline-offset-4"
            >
              Sign in
            </Link>
          )}
        </header>
      )}
      {children}
    </div>
  );
}
