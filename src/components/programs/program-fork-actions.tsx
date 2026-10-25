import { Link, useRouter } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, buttonVariants } from "#/components/ui/button";
import {
  ResponsiveSheetBody,
  ResponsiveSheetContent,
  ResponsiveSheetHeader,
} from "#/components/ui/responsive-sheet";
import { Sheet, SheetTitle } from "#/components/ui/sheet";
import { cn } from "#/lib/cn";
import { programActionErrorMessage } from "#/lib/programs/program-error-message";
import { withForkCopyIntent } from "#/lib/auth-redirect";
import { forkProgram } from "#/server/programs.fns";

type ProgramForkActionsProps = {
  programId: string;
  programTitle: string;
  authorName: string;
  shareToken: string | null;
  forkable: boolean;
  isOwner: boolean;
  isSignedIn: boolean;
  returnPath: string;
  pendingCopyIntent?: boolean;
};

export function ProgramForkActions({
  programId,
  programTitle,
  authorName,
  shareToken,
  forkable,
  isOwner,
  isSignedIn,
  returnPath,
  pendingCopyIntent = false,
}: ProgramForkActionsProps) {
  const router = useRouter();
  const [authSheetOpen, setAuthSheetOpen] = useState(false);
  const [forkPending, setForkPending] = useState(false);
  const [forkError, setForkError] = useState<string | null>(null);
  const [postAuthBanner, setPostAuthBanner] = useState(pendingCopyIntent);

  useEffect(() => {
    if (pendingCopyIntent && isSignedIn) {
      setPostAuthBanner(true);
    }
  }, [pendingCopyIntent, isSignedIn]);

  if (isOwner || !forkable) {
    return null;
  }

  const authReturn = withForkCopyIntent(returnPath);
  const signInHref = `/sign-in?redirect=${encodeURIComponent(authReturn)}`;
  const signUpHref = `/sign-up?redirect=${encodeURIComponent(authReturn)}`;

  const runFork = async () => {
    setForkPending(true);
    setForkError(null);
    try {
      const { programId: newId } = await forkProgram({
        data: {
          programId,
          shareToken: shareToken ?? undefined,
        },
      });
      setPostAuthBanner(false);
      await router.navigate({
        to: "/programs/$programId",
        params: { programId: newId },
        search: { forked: true },
      });
    } catch (e) {
      setForkError(
        programActionErrorMessage("fork", e instanceof Error ? e.message : ""),
      );
    } finally {
      setForkPending(false);
    }
  };

  const onCopyClick = () => {
    if (!isSignedIn) {
      setAuthSheetOpen(true);
      return;
    }
    void runFork();
  };

  return (
    <>
      {postAuthBanner && isSignedIn ? (
        <div
          className="border-t border-border bg-brand-soft px-4 py-3 text-sm lg:mb-3 lg:rounded-xl lg:border"
          role="status"
        >
          <p className="m-0 font-medium text-foreground">
            Signed in. Copy this program to your programs?
          </p>
          <Button
            type="button"
            size="touch"
            className="mt-2"
            disabled={forkPending}
            onClick={() => void runFork()}
          >
            {forkPending ? "Copying…" : "Copy to my programs"}
          </Button>
        </div>
      ) : null}

      {forkError ? (
        <div
          className="flex flex-wrap items-center gap-x-2 border-t border-destructive/30 bg-muted px-4 py-2 text-sm text-foreground lg:mb-3 lg:rounded-xl lg:border"
          role="alert"
        >
          <AlertCircle
            className="size-4 shrink-0 text-destructive"
            aria-hidden
          />
          <span className="min-w-0 flex-1">{forkError}</span>
          <Button
            type="button"
            variant="link"
            size="touch"
            className="text-brand-text"
            disabled={forkPending}
            onClick={() => void runFork()}
          >
            Retry
          </Button>
        </div>
      ) : null}

      <section
        className="border-t border-border bg-background/95 px-4 py-3 backdrop-blur-sm lg:rounded-xl lg:border lg:bg-card lg:p-4"
        aria-label="Copy program"
      >
        <Button
          type="button"
          size="touch"
          className="w-full"
          disabled={forkPending}
          onClick={onCopyClick}
        >
          {forkPending ? "Copying…" : "Copy to my programs"}
        </Button>
        <p className="mt-2 mb-0 text-center text-xs text-muted-foreground lg:text-left">
          {isSignedIn
            ? `Only you can see your copy until you share it. It does not change when ${authorName} edits theirs.`
            : "Reading needs no account. Copying needs one."}
        </p>
      </section>

      <Sheet open={authSheetOpen} onOpenChange={setAuthSheetOpen}>
        <ResponsiveSheetContent>
          <ResponsiveSheetHeader>
            <SheetTitle className="font-display text-2xl">
              Copy {programTitle}
            </SheetTitle>
          </ResponsiveSheetHeader>
          <ResponsiveSheetBody>
            <p className="m-0 text-sm text-text-secondary">
              Copies go into your programs on a physlane account. Only you can
              see your copy until you share it, and you can change anything in
              it.
            </p>
            <div className="flex flex-col gap-2">
              <Link
                to={signUpHref}
                className={cn(buttonVariants({ size: "touch" }), "w-full")}
              >
                Create account
              </Link>
              <Link
                to={signInHref}
                className={cn(
                  buttonVariants({ variant: "outline", size: "touch" }),
                  "w-full",
                )}
              >
                Sign in
              </Link>
            </div>
            <p className="m-0 text-xs text-muted-foreground">
              You come back to this program after signing in.
            </p>
            <Button
              type="button"
              variant="link"
              size="touch"
              className="self-start px-0 text-xs text-muted-foreground"
              onClick={() => setAuthSheetOpen(false)}
            >
              Keep reading
            </Button>
          </ResponsiveSheetBody>
        </ResponsiveSheetContent>
      </Sheet>
    </>
  );
}
