import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "#/components/ui/button";
import { Label } from "#/components/ui/label";
import {
  ResponsiveSheetBody,
  ResponsiveSheetContent,
  ResponsiveSheetHeader,
} from "#/components/ui/responsive-sheet";
import { Sheet, SheetTitle } from "#/components/ui/sheet";
import { Textarea } from "#/components/ui/textarea";
import { programActionErrorMessage } from "#/lib/programs/program-error-message";

type ReportSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** Rejects with the server error; the sheet shows it inline. */
  onSubmit: (reason: string) => Promise<unknown>;
};

export function ReportSheet({
  open,
  onOpenChange,
  title,
  onSubmit,
}: ReportSheetProps) {
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason("");
      setSent(false);
      setError(null);
    }
  }, [open]);

  const send = async () => {
    setPending(true);
    setError(null);
    try {
      await onSubmit(reason);
      setSent(true);
    } catch (e) {
      setError(
        programActionErrorMessage(
          "report",
          e instanceof Error ? e.message : "",
        ),
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <ResponsiveSheetContent>
        <ResponsiveSheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </ResponsiveSheetHeader>
        <ResponsiveSheetBody>
          {sent ? (
            <p
              className="m-0 flex items-center gap-2 text-sm font-medium text-foreground"
              role="status"
            >
              <Check className="size-4 text-data-positive" aria-hidden />
              Report sent.
            </p>
          ) : (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="report-reason">What's wrong?</Label>
                <Textarea
                  id="report-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="For example: copied from someone else, unsafe advice, spam"
                  rows={4}
                  maxLength={500}
                  className="min-h-24"
                />
              </div>
              <p className="m-0 text-xs text-muted-foreground">
                physlane reviews every report. You don't need an account.
              </p>
              {error ? (
                <p className="m-0 text-sm text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
              <Button
                type="button"
                size="touch"
                className="w-full"
                disabled={pending}
                onClick={() => void send()}
              >
                {pending ? "Sending…" : "Send report"}
              </Button>
            </>
          )}
        </ResponsiveSheetBody>
      </ResponsiveSheetContent>
    </Sheet>
  );
}
