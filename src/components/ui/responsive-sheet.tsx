import type { ComponentProps } from "react";
import { DialogContent } from "#/components/ui/dialog";
import { SheetContent, SheetHeader } from "#/components/ui/sheet";
import { useMediaQuery } from "#/hooks/use-media-query";
import { cn } from "#/lib/cn";

/**
 * Bottom sheet below `sm`, centered dialog from `sm` up. Sheet and Dialog share
 * one base-ui root, so Sheet, SheetTitle and SheetDescription work in both modes.
 */
function ResponsiveSheetContent({
  className,
  children,
  ...props
}: Omit<ComponentProps<typeof SheetContent>, "side">) {
  const centered = useMediaQuery("(min-width: 40rem)");
  if (centered) {
    return (
      <DialogContent
        className={cn(
          "max-h-[90dvh] gap-0 overflow-y-auto p-0 sm:max-w-md",
          className,
        )}
        {...props}
      >
        {children}
      </DialogContent>
    );
  }
  return (
    <SheetContent
      side="bottom"
      className={cn("max-h-[90dvh] gap-0 overflow-y-auto", className)}
      {...props}
    >
      {children}
    </SheetContent>
  );
}

function ResponsiveSheetHeader({
  className,
  ...props
}: ComponentProps<typeof SheetHeader>) {
  return <SheetHeader className={cn("pr-12", className)} {...props} />;
}

function ResponsiveSheetBody({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cn("flex flex-col gap-4 px-4 pb-6", className)}
      {...props}
    />
  );
}

export { ResponsiveSheetBody, ResponsiveSheetContent, ResponsiveSheetHeader };
