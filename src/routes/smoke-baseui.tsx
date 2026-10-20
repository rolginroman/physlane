import { createFileRoute } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog";

export const Route = createFileRoute("/smoke-baseui")({
  staticData: { appChrome: false },
  component: SmokeBaseUi,
});

function SmokeBaseUi() {
  // Temporary migration scaffold; not shipped in production builds.
  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-background p-6 text-foreground">
      <Dialog defaultOpen>
        <DialogContent className="bg-card text-foreground">
          <DialogHeader>
            <DialogTitle>Base UI smoke</DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Dialog tokens: card, foreground, muted-foreground.
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-text-secondary">
            Primary surface check only — remove this route before merge.
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
}
