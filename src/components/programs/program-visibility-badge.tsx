import { cn } from "#/lib/cn";
import { visibilityDisplayLabel } from "#/lib/programs/display-labels";

type Visibility = "draft" | "unlisted" | "public";

const badgeClass: Record<Visibility, string> = {
  draft: "border-border bg-muted text-muted-foreground",
  unlisted: "border-chart-neutral text-foreground",
  public: "border-brand-text text-brand-text",
};

export function ProgramVisibilityBadge({
  visibility,
  className,
}: {
  visibility: Visibility;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide",
        badgeClass[visibility],
        className,
      )}
    >
      {visibilityDisplayLabel(visibility)}
    </span>
  );
}
