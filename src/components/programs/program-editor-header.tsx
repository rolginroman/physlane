import { Link } from "@tanstack/react-router";
import { ArrowLeft, Settings, Share2 } from "lucide-react";
import { ProgramVisibilityBadge } from "#/components/programs/program-visibility-badge";
import { Button, buttonVariants } from "#/components/ui/button";
import { cn } from "#/lib/cn";
import type { ProgramDTO } from "#/server/programs.fns";

export function ProgramEditorHeader({
  title,
  description,
  forkSourceLabel,
  visibility,
  saveLabel,
  showRetry,
  onRetry,
  onShare,
  onSettings,
}: {
  title: string;
  description: string;
  forkSourceLabel: string | null;
  visibility: ProgramDTO["visibility"];
  saveLabel: string | null;
  showRetry: boolean;
  onRetry: () => void;
  onShare: () => void;
  onSettings: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
      <Link
        to="/programs"
        className={cn(
          buttonVariants({ variant: "ghost", size: "icon-touch" }),
          "text-muted-foreground",
        )}
        aria-label="Back to programs"
      >
        <ArrowLeft className="size-5" aria-hidden />
      </Link>
      <div className="order-last min-w-0 basis-full sm:order-none sm:flex-1 sm:basis-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="m-0 min-w-0 text-lg font-semibold break-words">
            {title}
          </h1>
          <ProgramVisibilityBadge visibility={visibility} />
        </div>
        {description ? (
          <p className="m-0 mt-0.5 text-sm break-words text-text-secondary">
            {description}
          </p>
        ) : null}
        {forkSourceLabel ? (
          <p className="m-0 mt-1 text-sm break-words text-muted-foreground">
            Based on {forkSourceLabel}
          </p>
        ) : null}
      </div>
      <span
        className="ml-auto flex items-center gap-1 text-sm text-muted-foreground sm:ml-0"
        role="status"
      >
        {saveLabel}
        {showRetry ? (
          <Button
            type="button"
            variant="ghost"
            size="touch"
            className="px-2 text-brand-text"
            onClick={onRetry}
          >
            Retry
          </Button>
        ) : null}
      </span>
      <Button type="button" variant="outline" size="touch" onClick={onShare}>
        <Share2 className="size-4" aria-hidden />
        Share
      </Button>
      <Button
        type="button"
        variant="outline"
        size="icon-touch"
        aria-label="Program settings"
        onClick={onSettings}
      >
        <Settings className="size-5" aria-hidden />
      </Button>
    </div>
  );
}
