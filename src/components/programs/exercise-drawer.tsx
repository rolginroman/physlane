import {
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Info,
  Play,
  Video,
  X,
} from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "#/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
} from "#/components/ui/sheet";
import { useMediaQuery } from "#/hooks/use-media-query";
import { cn } from "#/lib/cn";
import {
  equipmentDisplayLabel,
  muscleDisplayLabel,
} from "#/lib/programs/display-labels";
import { formatEntrySummary } from "#/lib/programs/entry-display";
import {
  safeExternalUrl,
  splitExerciseAssets,
  urlHost,
  type AssetLike,
} from "#/lib/programs/exercise-assets";
import type {
  ProgramEntryDTO,
  PublicExerciseRefDTO,
} from "#/server/programs.fns";

export type ExerciseDrawerTarget = {
  entry: ProgramEntryDTO;
  exercise: PublicExerciseRefDTO;
};

type ExerciseDrawerProps = {
  target: ExerciseDrawerTarget | null;
  authorName: string;
  onClose: () => void;
};

const KIND_ICON = { video: Video, article: FileText, image: ImageIcon };
const KIND_LABEL = { video: "Video", article: "Article", image: "Image" };

function InlineVideo({
  youtubeId,
  title,
}: {
  youtubeId: string;
  title: string;
}) {
  const [playing, setPlaying] = useState(false);
  if (playing) {
    return (
      <div className="aspect-video overflow-hidden rounded-lg border border-border bg-muted">
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0`}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          referrerPolicy="strict-origin-when-cross-origin"
          className="size-full border-0"
        />
      </div>
    );
  }
  return (
    <div className="flex aspect-video flex-col items-center justify-center gap-2 rounded-lg border border-border bg-muted p-4 text-center text-sm text-text-secondary">
      <button
        type="button"
        aria-label={`Play video: ${title}`}
        onClick={() => setPlaying(true)}
        className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <Play className="size-6 fill-current" aria-hidden />
      </button>
      <span className="break-words">{title}</span>
      <span className="text-xs text-muted-foreground">
        Plays from youtube.com
      </span>
    </div>
  );
}

function ReferenceLink({ asset }: { asset: AssetLike }) {
  const Icon = KIND_ICON[asset.kind];
  return (
    <li>
      <a
        href={safeExternalUrl(asset.url) ?? undefined}
        target="_blank"
        rel="noopener noreferrer"
        className="flex min-h-13 items-center gap-3 border-b border-border py-2 text-sm text-foreground no-underline"
      >
        <Icon className="size-4 shrink-0" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block break-words">{asset.title}</span>
          <span className="block text-xs text-muted-foreground">
            {KIND_LABEL[asset.kind]} · {urlHost(asset.url)}
          </span>
        </span>
        <ExternalLink
          className="size-3.5 shrink-0 text-muted-foreground"
          aria-hidden
        />
      </a>
    </li>
  );
}

function DrawerBody({
  entry,
  exercise,
  authorName,
}: ExerciseDrawerTarget & { authorName: string }) {
  const { video, references } = splitExerciseAssets(exercise.assets);
  const refUrl = safeExternalUrl(entry.refUrl);
  const secondary = exercise.muscleSecondary.map((muscle, index) => {
    const label = muscleDisplayLabel(muscle);
    return index === 0 ? label : label.toLowerCase();
  });

  return (
    <div className="flex flex-col gap-4 px-4 pb-6">
      <dl className="m-0 grid grid-cols-[6rem_1fr] gap-x-3 gap-y-1.5 text-sm">
        <dt className="text-muted-foreground">Primary</dt>
        <dd className="m-0">{muscleDisplayLabel(exercise.musclePrimary)}</dd>
        {secondary.length > 0 ? (
          <>
            <dt className="text-muted-foreground">Secondary</dt>
            <dd className="m-0">{secondary.join(", ")}</dd>
          </>
        ) : null}
        <dt className="text-muted-foreground">Equipment</dt>
        <dd className="m-0">{equipmentDisplayLabel(exercise.equipment)}</dd>
      </dl>
      {exercise.isCustom ? (
        <p className="m-0 text-xs text-muted-foreground">
          Custom exercise by {authorName}
        </p>
      ) : null}

      {video ? (
        <InlineVideo
          key={entry.id}
          youtubeId={video.youtubeId}
          title={video.title}
        />
      ) : null}
      {!video && references.length === 0 ? (
        <div
          className="flex items-center gap-2 rounded-lg border border-border bg-muted p-3 text-sm text-text-secondary"
          role="note"
        >
          <Info className="size-4 shrink-0" aria-hidden />
          No video or references for this exercise yet.
        </div>
      ) : null}
      {exercise.formNote ? (
        <p className="m-0 text-sm leading-relaxed text-text-secondary">
          {exercise.formNote}
        </p>
      ) : null}

      <section className="rounded-xl border border-border bg-card px-4 py-3">
        <h3 className="m-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          From {authorName}
        </h3>
        <p className="mt-1 mb-0 text-sm tabular-nums">
          {formatEntrySummary(entry, "metric")}
        </p>
        {entry.cues ? (
          <p className="mt-1 mb-0 text-sm text-text-secondary">{entry.cues}</p>
        ) : null}
        {refUrl ? (
          <a
            href={refUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-brand-text underline underline-offset-2"
          >
            {authorName}&apos;s reference link
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        ) : null}
      </section>

      {references.length > 0 ? (
        <section>
          <h3 className="m-0 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            References
          </h3>
          <ul className="m-0 mt-1 list-none p-0">
            {references.map((asset) => (
              <ReferenceLink key={asset.url} asset={asset} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

/** Bottom sheet on phones, right-hand panel from sm up. */
export function ExerciseDrawer({
  target,
  authorName,
  onClose,
}: ExerciseDrawerProps) {
  const panel = useMediaQuery("(min-width: 40rem)");
  // Keep the last exercise on screen while the close animation runs.
  const lastTarget = useRef(target);
  if (target) lastTarget.current = target;
  const shown = target ?? lastTarget.current;
  return (
    <Sheet
      open={target != null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <SheetContent
        side={panel ? "right" : "bottom"}
        showCloseButton={false}
        className={cn(
          "gap-0 overflow-y-auto",
          panel
            ? "data-[side=right]:sm:max-w-md"
            : "max-h-[90dvh] rounded-t-2xl",
        )}
      >
        {shown ? (
          <>
            <div className="flex items-start justify-between gap-2 p-4 pb-3">
              <SheetTitle className="font-display text-xl leading-snug break-words">
                {shown.exercise.name}
              </SheetTitle>
              {/* First in the tab order, so focus lands on Close when the drawer opens. */}
              <SheetClose
                render={
                  <Button
                    variant="ghost"
                    size="icon-touch"
                    className="-mt-1 -mr-2"
                  />
                }
              >
                <X aria-hidden />
                <span className="sr-only">Close</span>
              </SheetClose>
            </div>
            <DrawerBody {...shown} authorName={authorName} />
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
