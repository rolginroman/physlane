import { Link, useRouter } from "@tanstack/react-router";
import { Flag } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "#/components/ui/button";
import { Label } from "#/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "#/components/ui/sheet";
import { cn } from "#/lib/cn";
import { isAppErrorCode } from "#/lib/app-error";
import { programErrorMessage } from "#/lib/programs/program-error-message";
import { forkProgram, reportProgram } from "#/server/programs.fns";

type ProgramForkActionsProps = {
  programId: string;
  programTitle: string;
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
  shareToken,
  forkable,
  isOwner,
  isSignedIn,
  returnPath,
  pendingCopyIntent = false,
}: ProgramForkActionsProps) {
  const router = useRouter();
  const [authSheetOpen, setAuthSheetOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportSent, setReportSent] = useState(false);
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

  const signInHref = `/sign-in?redirect=${encodeURIComponent(returnPath)}`;
  const signUpHref = `/sign-up?redirect=${encodeURIComponent(returnPath)}&copy=1`;

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
      setConfirmOpen(false);
      setPostAuthBanner(false);
      await router.navigate({
        to: "/programs/$programId",
        params: { programId: newId },
        search: { forked: true },
      });
    } catch {
      setForkError("Couldn't copy this program. Try again.");
    } finally {
      setForkPending(false);
    }
  };

  const onCopyClick = () => {
    if (!isSignedIn) {
      setAuthSheetOpen(true);
      return;
    }
    setConfirmOpen(true);
  };

  const onReport = async () => {
    try {
      await reportProgram({
        data: { programId, reason: reportReason },
      });
      setReportSent(true);
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      setForkError(
        isAppErrorCode(code)
          ? programErrorMessage(code)
          : "Couldn't send your report. Try again later.",
      );
    }
  };

  return (
    <>
      {postAuthBanner && isSignedIn ? (
        <div
          className="border-b border-border bg-brand-soft px-4 py-3 text-sm sm:px-8"
          role="status"
        >
          <p className="m-0 font-medium text-foreground">
            Signed in. Copy this program to your programs?
          </p>
          <Button
            type="button"
            className="mt-2 min-h-11"
            onClick={() => setConfirmOpen(true)}
          >
            Copy to my programs
          </Button>
        </div>
      ) : null}

      {forkError ? (
        <div
          className="border-b border-destructive/30 bg-muted px-4 py-2 text-sm text-foreground sm:px-8"
          role="alert"
        >
          {forkError}
          <button
            type="button"
            className="ml-2 font-medium text-brand-text underline"
            onClick={() => setForkError(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <section
        className="sticky bottom-0 z-10 border-t border-border bg-background/95 px-4 py-4 backdrop-blur-sm sm:static sm:border-0 sm:bg-transparent sm:px-0 sm:py-0"
        aria-label="Copy program"
      >
        <div className="mx-auto max-w-3xl sm:max-w-5xl">
          <Button
            type="button"
            className="min-h-11 w-full"
            disabled={forkPending}
            onClick={onCopyClick}
          >
            {forkPending ? "Copying…" : "Copy to my programs"}
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground sm:text-left">
            {isSignedIn
              ? "Only you can see your copy until you share it. It does not change when the author edits theirs."
              : "Reading needs no account. Copying needs one."}
          </p>
          <button
            type="button"
            className="mx-auto mt-3 flex min-h-11 items-center gap-1.5 text-xs font-medium text-muted-foreground underline decoration-border underline-offset-2 sm:mx-0"
            onClick={() => {
              setReportSent(false);
              setReportReason("");
              setReportOpen(true);
            }}
          >
            <Flag className="size-3.5" aria-hidden />
            Report this program
          </button>
        </div>
      </section>

      <Sheet open={authSheetOpen} onOpenChange={setAuthSheetOpen}>
        <SheetContent side="bottom" className="pb-8">
          <SheetHeader>
            <SheetTitle className="font-display text-2xl">
              Copy {programTitle}
            </SheetTitle>
          </SheetHeader>
          <p className="text-sm text-text-secondary">
            Copies go into your programs on a physlane account. Only you can see
            your copy until you share it, and you can change anything in it.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <Link
              to={signUpHref}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground no-underline"
            >
              Create account
            </Link>
            <Link
              to={signInHref}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-border bg-card px-4 text-sm font-medium text-foreground no-underline"
            >
              Sign in
            </Link>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            You come back to this program after signing in.
          </p>
          <button
            type="button"
            className="mt-2 text-xs font-medium text-muted-foreground underline"
            onClick={() => setAuthSheetOpen(false)}
          >
            Keep reading
          </button>
        </SheetContent>
      </Sheet>

      <Sheet open={confirmOpen} onOpenChange={setConfirmOpen}>
        <SheetContent side="bottom" className="pb-8">
          <SheetHeader>
            <SheetTitle>Copy to my programs</SheetTitle>
          </SheetHeader>
          <p className="text-sm text-text-secondary">
            You get a new draft with the same sessions, exercises, and sets.
            Custom exercises from the author are included as snapshots in your
            copy. Analytics and sharing settings are not copied.
          </p>
          <Button
            type="button"
            className="mt-4 min-h-11 w-full"
            disabled={forkPending}
            onClick={() => void runFork()}
          >
            {forkPending ? "Copying…" : "Copy to my programs"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="mt-2 min-h-11 w-full"
            onClick={() => setConfirmOpen(false)}
          >
            Cancel
          </Button>
        </SheetContent>
      </Sheet>

      <Sheet open={reportOpen} onOpenChange={setReportOpen}>
        <SheetContent side="bottom" className="pb-8">
          <SheetHeader>
            <SheetTitle>Report this program</SheetTitle>
          </SheetHeader>
          {reportSent ? (
            <p className="text-sm text-data-positive" role="status">
              Thanks for letting us know. physlane reviews every report.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="report-reason">What's wrong? (optional)</Label>
                <textarea
                  id="report-reason"
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  placeholder="For example: copied from someone else, unsafe advice, spam"
                  rows={4}
                  className={cn(
                    "min-h-24 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground",
                  )}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                physlane reviews every report. You don't need an account.
              </p>
              <Button
                type="button"
                className="mt-4 min-h-11 w-full"
                onClick={() => void onReport()}
              >
                Send report
              </Button>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
