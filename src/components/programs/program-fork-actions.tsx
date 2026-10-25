import { Link, useRouter } from "@tanstack/react-router";
import { Flag } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, buttonVariants } from "#/components/ui/button";
import { Label } from "#/components/ui/label";
import {
  ResponsiveSheetBody,
  ResponsiveSheetContent,
  ResponsiveSheetHeader,
} from "#/components/ui/responsive-sheet";
import { Sheet, SheetTitle } from "#/components/ui/sheet";
import { Textarea } from "#/components/ui/textarea";
import { cn } from "#/lib/cn";
import { isAppErrorCode } from "#/lib/app-error";
import { programErrorMessage } from "#/lib/programs/program-error-message";
import { withForkCopyIntent } from "#/lib/auth-redirect";
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
            onClick={() => setConfirmOpen(true)}
          >
            Copy to my programs
          </Button>
        </div>
      ) : null}

      {forkError ? (
        <div
          className="flex flex-wrap items-center border-t border-destructive/30 bg-muted px-4 py-2 text-sm text-foreground lg:mb-3 lg:rounded-xl lg:border"
          role="alert"
        >
          {forkError}
          <Button
            type="button"
            variant="link"
            size="touch"
            className="text-brand-text"
            onClick={() => setForkError(null)}
          >
            Dismiss
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
            ? "Only you can see your copy until you share it. It does not change when the author edits theirs."
            : "Reading needs no account. Copying needs one."}
        </p>
        <Button
          type="button"
          variant="link"
          size="touch"
          className="mx-auto mt-1 flex text-xs text-muted-foreground lg:mx-0 lg:px-0"
          onClick={() => {
            setReportSent(false);
            setReportReason("");
            setReportOpen(true);
          }}
        >
          <Flag className="size-3.5" aria-hidden />
          Report this program
        </Button>
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

      <Sheet open={confirmOpen} onOpenChange={setConfirmOpen}>
        <ResponsiveSheetContent>
          <ResponsiveSheetHeader>
            <SheetTitle>Copy to my programs</SheetTitle>
          </ResponsiveSheetHeader>
          <ResponsiveSheetBody>
            <p className="m-0 text-sm text-text-secondary">
              You get a new draft with the same sessions, exercises, and sets.
              Custom exercises from the author are included as snapshots in your
              copy. Analytics and sharing settings are not copied.
            </p>
            <Button
              type="button"
              size="touch"
              className="w-full"
              disabled={forkPending}
              onClick={() => void runFork()}
            >
              {forkPending ? "Copying…" : "Copy to my programs"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="touch"
              className="w-full"
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
          </ResponsiveSheetBody>
        </ResponsiveSheetContent>
      </Sheet>

      <Sheet open={reportOpen} onOpenChange={setReportOpen}>
        <ResponsiveSheetContent>
          <ResponsiveSheetHeader>
            <SheetTitle>Report this program</SheetTitle>
          </ResponsiveSheetHeader>
          <ResponsiveSheetBody>
            {reportSent ? (
              <p className="m-0 text-sm text-data-positive" role="status">
                Thanks for letting us know. physlane reviews every report.
              </p>
            ) : (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="report-reason">
                    What's wrong? (optional)
                  </Label>
                  <Textarea
                    id="report-reason"
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    placeholder="For example: copied from someone else, unsafe advice, spam"
                    rows={4}
                    className="min-h-24"
                  />
                </div>
                <p className="m-0 text-xs text-muted-foreground">
                  physlane reviews every report. You don't need an account.
                </p>
                <Button
                  type="button"
                  size="touch"
                  className="w-full"
                  onClick={() => void onReport()}
                >
                  Send report
                </Button>
              </>
            )}
          </ResponsiveSheetBody>
        </ResponsiveSheetContent>
      </Sheet>
    </>
  );
}
