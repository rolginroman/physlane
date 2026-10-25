import { Button } from "#/components/ui/button";
import { TabsList, TabsTrigger } from "#/components/ui/tabs";
import { cn } from "#/lib/cn";

/** Week navigation inside a `Tabs` root: a rail on desktop, a scrolling strip below. */
export function ProgramEditorWeekBar({
  weeks,
  vertical,
  maxWeeks,
  disabled,
  onAddWeek,
  onCopyWeek,
}: {
  weeks: number;
  vertical: boolean;
  maxWeeks: number;
  disabled: boolean;
  onAddWeek: () => void;
  onCopyWeek: () => void;
}) {
  const addWeek =
    weeks < maxWeeks ? (
      <Button
        type="button"
        variant="ghost"
        size="touch"
        className={cn("text-brand-text", vertical && "justify-start")}
        onClick={onAddWeek}
        disabled={disabled}
      >
        + Add week
      </Button>
    ) : null;
  const copyWeek = (
    <Button
      type="button"
      variant="outline"
      size="touch"
      className={cn(vertical && "justify-start")}
      onClick={onCopyWeek}
      disabled={disabled}
    >
      Copy week
    </Button>
  );
  const triggers = Array.from({ length: weeks }, (_, i) => i + 1).map((w) => (
    <TabsTrigger key={w} value={w}>
      Week {w}
    </TabsTrigger>
  ));

  if (vertical) {
    return (
      <div className="flex w-52 shrink-0 flex-col gap-2 self-start lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto">
        <TabsList variant="rail" aria-label="Weeks">
          {triggers}
        </TabsList>
        {addWeek}
        {copyWeek}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex max-w-full min-w-0 items-center">
        <TabsList variant="line" aria-label="Weeks" className="min-w-0 flex-1">
          {triggers}
        </TabsList>
        {addWeek}
      </div>
      {copyWeek}
    </div>
  );
}
