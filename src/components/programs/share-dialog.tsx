import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Globe, Link2, RotateCw } from "lucide-react";
import { Button } from "#/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { Input } from "#/components/ui/input";
import { isAppErrorCode } from "#/lib/app-error";
import { programErrorMessage } from "#/lib/programs/program-error-message";
import {
  publicProgramCanonicalUrlFromOrigin,
  shareLinkUrlFromOrigin,
} from "#/lib/programs/program-urls";
import { AuthorProfileSetup } from "#/components/programs/author-profile-setup";
import {
  getMyAuthorSlug,
  rotateShareToken,
  setVisibility,
  type ProgramDTO,
} from "#/server/programs.fns";

export type ShareDialogProgram = Pick<
  ProgramDTO,
  "id" | "title" | "visibility" | "shareToken" | "slug" | "revision"
>;

type ShareDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  program: ShareDialogProgram;
  onProgramUpdated: (program: ProgramDTO | ShareDialogProgram) => void;
};

export function ShareDialog({
  open,
  onOpenChange,
  program,
  onProgramUpdated,
}: ShareDialogProps) {
  const [local, setLocal] = useState(program);
  const [authorSlug, setAuthorSlug] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [replaceConfirm, setReplaceConfirm] = useState(false);
  const [profileSetupOpen, setProfileSetupOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setLocal(program);
      setError(null);
      setReplaceConfirm(false);
      setCopied(false);
    }
  }, [open, program]);

  useEffect(() => {
    if (!open) return;
    void getMyAuthorSlug()
      .then((r) => setAuthorSlug(r.authorSlug))
      .catch(() => setAuthorSlug(null));
  }, [open, local.visibility]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const displayUrl = useCallback(() => {
    if (local.visibility === "public" && authorSlug && local.slug) {
      return publicProgramCanonicalUrlFromOrigin(
        origin,
        authorSlug,
        local.slug,
      );
    }
    if (local.shareToken && authorSlug && local.slug) {
      return shareLinkUrlFromOrigin(
        origin,
        authorSlug,
        local.slug,
        local.shareToken,
      );
    }
    return "";
  }, [authorSlug, local, origin]);

  const copyUrl = async () => {
    const url = displayUrl();
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Couldn't copy. Select the link and copy manually.");
    }
  };

  const runVisibility = async (target: "unlisted" | "public" | "draft") => {
    setPending(true);
    setError(null);
    try {
      const updated = await setVisibility({
        data: {
          programId: local.id,
          target,
        },
      });
      setLocal(updated);
      onProgramUpdated(updated);
      if (target === "unlisted" || target === "public") {
        const slug = await getMyAuthorSlug();
        setAuthorSlug(slug.authorSlug);
      }
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      setError(
        isAppErrorCode(code)
          ? programErrorMessage(code)
          : programErrorMessage(""),
      );
    } finally {
      setPending(false);
      setReplaceConfirm(false);
    }
  };

  const onReplaceLink = async () => {
    setPending(true);
    setError(null);
    try {
      const { shareToken } = await rotateShareToken({
        data: { programId: local.id },
      });
      setLocal((prev) => {
        const next = { ...prev, shareToken };
        onProgramUpdated(next);
        return next;
      });
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      setError(
        isAppErrorCode(code)
          ? programErrorMessage(code)
          : programErrorMessage(""),
      );
    } finally {
      setPending(false);
      setReplaceConfirm(false);
    }
  };

  const url = displayUrl();

  return (
    <>
      <Dialog open={open && !replaceConfirm} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Share &ldquo;{local.title}&rdquo;</DialogTitle>
            {local.visibility === "draft" ? (
              <DialogDescription>
                Anyone with the link can view. Not listed anywhere.
              </DialogDescription>
            ) : null}
          </DialogHeader>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}

          {local.visibility === "draft" ? (
            <div className="flex flex-col gap-3">
              <Button
                type="button"
                className="min-h-11 w-full"
                disabled={pending}
                onClick={() => void runVisibility("unlisted")}
              >
                <Link2 className="size-4" aria-hidden />
                {pending ? "Creating link…" : "Create share link"}
              </Button>
              <p className="text-sm text-text-secondary">
                Anyone with the link can open and copy this program. You can
                replace the link or turn it off later.
              </p>
            </div>
          ) : null}

          {local.visibility === "unlisted" ? (
            <div className="flex flex-col gap-4">
              <div>
                <span className="text-sm font-medium text-muted-foreground">
                  Share link
                </span>
                <div className="mt-1.5 flex min-h-11 items-center gap-2 rounded-lg border border-border bg-muted px-2">
                  <Input
                    readOnly
                    value={url}
                    className="min-h-10 border-0 bg-transparent shadow-none"
                    aria-label="Share link"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-10 shrink-0"
                    onClick={() => void copyUrl()}
                    aria-live="polite"
                  >
                    {copied ? (
                      <>
                        <Check className="size-4" aria-hidden />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="size-4" aria-hidden />
                        Copy link
                      </>
                    )}
                  </Button>
                </div>
              </div>
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 justify-start px-0"
                onClick={() => setReplaceConfirm(true)}
                disabled={pending}
              >
                <RotateCw className="size-4" aria-hidden />
                Replace link…
              </Button>
              <Button
                type="button"
                className="min-h-11 w-full"
                disabled={pending}
                onClick={() => setProfileSetupOpen(true)}
              >
                <Globe className="size-4" aria-hidden />
                Go public
              </Button>
              <p className="text-sm text-text-secondary">
                Listed on your profile when public. Search engines can index it.
                Changes go live as they save.
              </p>
            </div>
          ) : null}

          {local.visibility === "public" ? (
            <div className="flex flex-col gap-4">
              <div>
                <span className="text-sm font-medium text-muted-foreground">
                  Public address
                </span>
                <div className="mt-1.5 flex min-h-11 items-center gap-2 rounded-lg border border-border bg-muted px-2">
                  <Input
                    readOnly
                    value={url}
                    className="min-h-10 border-0 bg-transparent shadow-none"
                    aria-label="Public address"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-10 shrink-0"
                    onClick={() => void copyUrl()}
                    aria-live="polite"
                  >
                    {copied ? (
                      <>
                        <Check className="size-4" aria-hidden />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="size-4" aria-hidden />
                        Copy
                      </>
                    )}
                  </Button>
                </div>
              </div>
              <p className="text-sm text-text-secondary">
                Changes go live as they save.
              </p>
              <Button
                type="button"
                variant="destructive"
                className="min-h-11 w-full"
                disabled={pending}
                onClick={() => void runVisibility("unlisted")}
              >
                Back to unlisted
              </Button>
              <p className="text-sm text-text-secondary">
                Removes it from your profile and search. You get a new share
                link; older links stop working.
              </p>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <AuthorProfileSetup
        open={profileSetupOpen}
        onOpenChange={setProfileSetupOpen}
        mode="go-public"
        onSaved={async () => {
          await runVisibility("public");
        }}
      />

      <Dialog open={replaceConfirm} onOpenChange={setReplaceConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Replace the share link?</DialogTitle>
            <DialogDescription>
              Anyone with the old link loses access. You get a new link to send
              to the people who should keep access.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              type="button"
              variant="destructive"
              className="min-h-11 w-full"
              disabled={pending}
              onClick={() => void onReplaceLink()}
            >
              Replace link
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 w-full"
              onClick={() => setReplaceConfirm(false)}
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
