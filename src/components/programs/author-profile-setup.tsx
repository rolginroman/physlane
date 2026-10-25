import { useEffect, useState } from "react";
import { AlertCircle, Check } from "lucide-react";
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
import { SITE_URL } from "#/lib/seo";
import {
  checkAuthorSlugAvailable,
  getAuthorProfileSetup,
  saveAuthorProfile,
} from "#/server/programs.fns";

type AuthorProfileSetupProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "go-public" | "edit";
  onSaved: (authorSlug: string) => void | Promise<void>;
};

function profileErrorMessage(code: string): string {
  switch (code) {
    case "SLUG_TAKEN":
      return "That address is taken. Try a suggestion or another name.";
    case "INVALID_TRANSITION":
      return "You can change your profile address again after the cooldown ends.";
    default:
      return "Couldn't save your profile. Nothing changed. Try again.";
  }
}

export function AuthorProfileSetup({
  open,
  onOpenChange,
  mode,
  onSaved,
}: AuthorProfileSetupProps) {
  const [displayName, setDisplayName] = useState("");
  const [authorSlug, setAuthorSlug] = useState("");
  const [bio, setBio] = useState("");
  const [slugRenameAllowedFrom, setSlugRenameAllowedFrom] = useState<
    string | null
  >(null);
  const [slugStatus, setSlugStatus] = useState<
    "idle" | "checking" | "ok" | "error"
  >("idle");
  const [slugMessage, setSlugMessage] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoadError(null);
    setSaveError(null);
    void getAuthorProfileSetup()
      .then((setup) => {
        setDisplayName(setup.displayName);
        setAuthorSlug(setup.authorSlug ?? "");
        setBio(setup.bio ?? "");
        setSlugRenameAllowedFrom(setup.slugRenameAllowedFrom);
        setSlugStatus("idle");
        setSlugMessage(null);
        setSuggestions([]);
      })
      .catch(() => setLoadError("Couldn't load your profile. Try again."));
  }, [open]);

  useEffect(() => {
    if (!open || !authorSlug.trim()) {
      setSlugStatus("idle");
      return;
    }
    const candidate = authorSlug.trim().toLowerCase();
    setSlugStatus("checking");
    const handle = window.setTimeout(() => {
      void checkAuthorSlugAvailable({ data: { candidate } })
        .then((result) => {
          if (result.ok) {
            setSlugStatus("ok");
            setSlugMessage("Available");
            setSuggestions([]);
            return;
          }
          setSlugStatus("error");
          setSlugMessage(result.reason);
          setSuggestions(result.suggestions ?? []);
        })
        .catch(() => {
          setSlugStatus("error");
          setSlugMessage("Couldn't check that address. Try again.");
        });
    }, 350);
    return () => window.clearTimeout(handle);
  }, [authorSlug, open]);

  const slugLocked =
    slugRenameAllowedFrom != null &&
    new Date(slugRenameAllowedFrom) > new Date();

  const canSubmit =
    displayName.trim().length > 0 &&
    authorSlug.trim().length > 0 &&
    slugStatus === "ok" &&
    !pending &&
    !slugLocked;

  const onSubmit = async () => {
    setPending(true);
    setSaveError(null);
    try {
      const result = await saveAuthorProfile({
        data: {
          displayName: displayName.trim(),
          authorSlug: authorSlug.trim().toLowerCase(),
          bio: bio.trim() ? bio.trim() : null,
          publishProfile: mode === "go-public",
        },
      });
      await onSaved(result.authorSlug);
      onOpenChange(false);
    } catch (e) {
      const code = e instanceof Error ? e.message : "";
      setSaveError(
        isAppErrorCode(code)
          ? profileErrorMessage(code)
          : profileErrorMessage(""),
      );
    } finally {
      setPending(false);
    }
  };

  const hostPrefix = SITE_URL.replace(/^https?:\/\//, "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "go-public" ? "Your public profile" : "Edit profile"}
          </DialogTitle>
          {mode === "go-public" ? (
            <DialogDescription>
              Step 1 of 2 — public programs are listed on your profile. You can
              change this later.
            </DialogDescription>
          ) : null}
        </DialogHeader>

        {loadError ? (
          <p className="text-sm text-destructive" role="alert">
            {loadError}
          </p>
        ) : null}
        {saveError ? (
          <p className="text-sm text-destructive" role="alert">
            {saveError}
          </p>
        ) : null}

        <div className="flex flex-col gap-4">
          <div>
            <label
              className="text-sm font-medium text-muted-foreground"
              htmlFor="profile-display-name"
            >
              Display name
            </label>
            <Input
              id="profile-display-name"
              className="mt-1.5 min-h-11"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              aria-invalid={displayName.trim() === ""}
            />
            <p className="mt-1.5 text-sm text-text-secondary">
              Shown on your profile and on copies people make of your programs.
            </p>
          </div>

          <div>
            <label
              className="text-sm font-medium text-muted-foreground"
              htmlFor="profile-author-slug"
            >
              Profile address
            </label>
            <div
              className={`mt-1.5 flex min-h-11 items-stretch overflow-hidden rounded-lg border bg-muted ${
                slugStatus === "error"
                  ? "border-destructive"
                  : slugStatus === "ok"
                    ? "border-border"
                    : "border-border"
              }`}
            >
              <span className="flex items-center pl-3 text-sm text-muted-foreground">
                {hostPrefix}/u/
              </span>
              <Input
                id="profile-author-slug"
                className="min-h-11 border-0 bg-transparent shadow-none"
                value={authorSlug}
                disabled={slugLocked}
                onChange={(e) => setAuthorSlug(e.target.value)}
                aria-invalid={slugStatus === "error"}
              />
            </div>
            {slugStatus === "checking" ? (
              <p className="mt-1.5 text-sm text-muted-foreground">Checking…</p>
            ) : null}
            {slugStatus === "ok" ? (
              <p className="mt-1.5 flex items-center gap-1.5 text-sm text-foreground">
                <Check className="size-4" aria-hidden />
                {slugMessage}
              </p>
            ) : null}
            {slugStatus === "error" && slugMessage ? (
              <p className="mt-1.5 flex items-center gap-1.5 text-sm text-destructive">
                <AlertCircle className="size-4" aria-hidden />
                {slugMessage}
              </p>
            ) : null}
            {suggestions.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <Button
                    key={s}
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => setAuthorSlug(s)}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            ) : null}
            {slugLocked && slugRenameAllowedFrom ? (
              <p className="mt-1.5 text-sm text-text-secondary">
                You can change your profile address again from{" "}
                {new Date(slugRenameAllowedFrom).toLocaleDateString()}.
              </p>
            ) : null}
            {mode === "edit" && !slugLocked ? (
              <p className="mt-2 rounded-lg border border-border bg-muted p-3 text-sm text-text-secondary">
                Old addresses redirect here for up to a year. Share links keep
                working. After this change you can change the address again in
                90 days.
              </p>
            ) : null}
          </div>

          <div>
            <label
              className="text-sm font-medium text-muted-foreground"
              htmlFor="profile-bio"
            >
              Bio{" "}
              <span className="font-normal text-muted-foreground">
                (optional)
              </span>
            </label>
            <textarea
              id="profile-bio"
              className="mt-1.5 flex min-h-[76px] w-full rounded-lg border border-border bg-muted px-3 py-2 text-base text-foreground"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="One or two lines about you"
            />
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            type="button"
            className="min-h-11 w-full"
            disabled={!canSubmit}
            onClick={() => void onSubmit()}
          >
            {pending ? "Saving…" : mode === "go-public" ? "Continue" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
