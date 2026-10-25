import { X } from "lucide-react";
import { Button } from "#/components/ui/button";

export function ProgramEditorBanners({
  forkBannerOpen,
  onDismissFork,
  staleRevision,
  loadError,
  offline,
  reloadPending,
  onReload,
}: {
  forkBannerOpen: boolean;
  onDismissFork: () => void;
  staleRevision: boolean;
  loadError: boolean;
  offline: boolean;
  reloadPending: boolean;
  onReload: () => void;
}) {
  return (
    <>
      {forkBannerOpen ? (
        <div
          className="mb-4 flex flex-col gap-2 rounded-xl border border-border bg-brand-soft p-4 sm:flex-row sm:items-start"
          role="status"
        >
          <div className="flex-1 text-sm">
            <p className="m-0 font-semibold text-foreground">
              Copied to your programs
            </p>
            <p className="m-0 mt-1 text-text-secondary">
              This is your copy: a draft only you can see. Edit anything.
              Changes the author makes to theirs don't reach it.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-touch"
            className="shrink-0"
            aria-label="Dismiss"
            onClick={onDismissFork}
          >
            <X className="size-5" aria-hidden />
          </Button>
        </div>
      ) : null}
      {staleRevision ? (
        <div
          className="mb-4 flex flex-col gap-3 rounded-xl border border-border bg-brand-soft p-4 sm:flex-row sm:items-center"
          role="alert"
        >
          <p className="m-0 flex-1 text-sm">
            This program was opened in another tab. Reload to continue editing.
          </p>
          <Button
            type="button"
            size="touch"
            disabled={reloadPending}
            onClick={onReload}
          >
            {reloadPending ? "Reloading…" : "Reload"}
          </Button>
        </div>
      ) : null}
      {offline ? (
        <p className="mb-4 text-sm text-destructive" role="status">
          Offline · changes not saved
        </p>
      ) : null}
      {loadError ? (
        <div className="mb-4 rounded-xl border border-destructive/40 bg-muted p-4">
          <p className="m-0 text-sm">Could not load this program.</p>
          <Button
            type="button"
            variant="outline"
            size="touch"
            className="mt-2"
            onClick={onReload}
          >
            Try again
          </Button>
        </div>
      ) : null}
    </>
  );
}
