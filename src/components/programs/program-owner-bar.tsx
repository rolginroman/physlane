import { Link, useRouter } from "@tanstack/react-router";
import {
  Check,
  Copy,
  Globe,
  Link2,
  Pencil,
  RotateCw,
  Share2,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  ShareDialog,
  type ShareDialogProgram,
} from "#/components/programs/share-dialog";
import { Button, buttonVariants } from "#/components/ui/button";
import { ownerViewPath } from "#/lib/programs/owner-view";
import { programActionErrorMessage } from "#/lib/programs/program-error-message";
import type { PublicProgramDTO } from "#/server/programs.fns";

const COPIED_MS = 2000;

/** Owner-only controls above the page; viewers never render this. */
export function ProgramOwnerBar({
  program,
  variant,
}: {
  program: PublicProgramDTO;
  variant: "public" | "unlisted";
}) {
  const router = useRouter();
  const authorSlug = program.author.authorSlug;
  const [current, setCurrent] = useState<ShareDialogProgram>(program);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareStart, setShareStart] = useState<"replace" | undefined>();
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">(
    "idle",
  );

  // A reload or token swap hands us fresh server data; it wins over local echoes.
  useEffect(() => {
    setCurrent(program);
  }, [program]);

  useEffect(() => {
    if (copyState !== "copied") return;
    const timer = setTimeout(() => setCopyState("idle"), COPIED_MS);
    return () => clearTimeout(timer);
  }, [copyState]);

  const openShare = (start?: "replace") => {
    setShareStart(start);
    setShareOpen(true);
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(
        window.location.origin + ownerViewPath(current, authorSlug),
      );
      setCopyState("copied");
    } catch {
      setCopyState("failed");
    }
  };

  const outline = buttonVariants({ variant: "outline", size: "touch" });

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted px-4 py-2 text-sm sm:px-8">
        {variant === "public" ? (
          <>
            <Globe className="size-4.5 shrink-0" aria-hidden />
            <span className="flex-1 font-medium">Your public program</span>
          </>
        ) : (
          <>
            <Link2 className="size-4.5 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1 basis-56">
              <strong className="font-semibold">Unlisted</strong>
              <span className="block text-text-secondary">
                Only people with this link can open it. Not on your profile or
                in search.
              </span>
            </span>
            <Button
              type="button"
              variant="outline"
              size="touch"
              onClick={() => void copyLink()}
            >
              {copyState === "copied" ? (
                <Check aria-hidden />
              ) : (
                <Copy aria-hidden />
              )}
              <span aria-live="polite">
                {copyState === "copied" ? "Copied" : "Copy link"}
              </span>
            </Button>
            <Button
              type="button"
              variant="outline"
              size="touch"
              onClick={() => openShare("replace")}
            >
              <RotateCw aria-hidden />
              Replace link…
            </Button>
          </>
        )}
        <Link
          to="/programs/$programId"
          params={{ programId: program.id }}
          className={outline}
        >
          <Pencil aria-hidden />
          Edit
        </Link>
        {variant === "public" ? (
          <Button
            type="button"
            variant="outline"
            size="touch"
            onClick={() => openShare()}
          >
            <Share2 aria-hidden />
            Share
          </Button>
        ) : null}
        {copyState === "failed" ? (
          <p className="m-0 basis-full text-sm text-destructive" role="alert">
            {programActionErrorMessage("copy-link")}
          </p>
        ) : null}
      </div>

      <ShareDialog
        open={shareOpen}
        startWith={shareStart}
        onOpenChange={setShareOpen}
        program={current}
        onProgramUpdated={(next) => {
          const before = ownerViewPath(current, authorSlug);
          const after = ownerViewPath(next, authorSlug);
          setCurrent(next);
          // The address bar must never sit on a link that just died.
          if (after !== before) {
            router.history.replace(after);
          }
        }}
      />
    </>
  );
}
