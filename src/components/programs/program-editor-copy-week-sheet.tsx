import { useMemo } from "react";
import { Button } from "#/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";
import { Label } from "#/components/ui/label";
import { OptionSelect } from "#/components/ui/option-select";
import {
  ResponsiveSheetBody,
  ResponsiveSheetContent,
  ResponsiveSheetHeader,
} from "#/components/ui/responsive-sheet";
import { Sheet, SheetTitle } from "#/components/ui/sheet";
import { countLabel } from "#/lib/programs/count-label";

export function ProgramEditorCopyWeekSheet({
  open,
  onOpenChange,
  confirmOpen,
  onConfirmOpenChange,
  sourceWeek,
  weeks,
  targetWeek,
  onTargetWeekChange,
  targetSessionCount,
  pending,
  onCopy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  confirmOpen: boolean;
  onConfirmOpenChange: (open: boolean) => void;
  sourceWeek: number;
  weeks: number;
  targetWeek: number;
  onTargetWeekChange: (week: number) => void;
  targetSessionCount: number;
  pending: boolean;
  onCopy: () => void;
}) {
  const weekOptions = useMemo(
    () =>
      Array.from({ length: weeks }, (_, i) => ({
        value: String(i + 1),
        label: `Week ${i + 1}`,
      })),
    [weeks],
  );

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <ResponsiveSheetContent>
          <ResponsiveSheetHeader>
            <SheetTitle>Copy week {sourceWeek} to…</SheetTitle>
          </ResponsiveSheetHeader>
          <ResponsiveSheetBody>
            <div>
              <Label htmlFor="copy-target">Target week</Label>
              <OptionSelect
                id="copy-target"
                value={String(targetWeek)}
                options={weekOptions}
                onValueChange={(w) => onTargetWeekChange(Number(w))}
              />
            </div>
            <Button
              type="button"
              size="touch"
              disabled={pending}
              onClick={() => {
                if (targetSessionCount > 0) {
                  onConfirmOpenChange(true);
                } else {
                  onCopy();
                }
              }}
            >
              Copy week
            </Button>
          </ResponsiveSheetBody>
        </ResponsiveSheetContent>
      </Sheet>

      <Dialog open={confirmOpen} onOpenChange={onConfirmOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace week {targetWeek}?</DialogTitle>
            <DialogDescription>
              This replaces {countLabel(targetSessionCount, "session")} in week{" "}
              {targetWeek} with the contents of week {sourceWeek}.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-2">
            <Button
              type="button"
              variant="outline"
              size="touch"
              onClick={() => onConfirmOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="touch"
              disabled={pending}
              onClick={onCopy}
            >
              Replace week
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
