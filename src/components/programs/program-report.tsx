import { Flag } from "lucide-react";
import { useState } from "react";
import { ReportSheet } from "#/components/programs/report-sheet";
import { Button } from "#/components/ui/button";
import { reportProgram } from "#/server/programs.fns";

export function ReportProgramButton({ programId }: { programId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="link"
        size="touch"
        className="text-xs text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        <Flag className="size-3.5" aria-hidden />
        Report this program
      </Button>
      <ReportSheet
        open={open}
        onOpenChange={setOpen}
        title="Report this program"
        onSubmit={(reason) => reportProgram({ data: { programId, reason } })}
      />
    </>
  );
}
