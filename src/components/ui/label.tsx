import type { ComponentProps } from "react";
import { cn } from "#/lib/cn";

function Label({ className, ...props }: ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "mb-1.5 block text-[0.8125rem] font-medium text-secondary",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
