import { Switch as SwitchPrimitive } from "@base-ui/react/switch";
import { cn } from "#/lib/cn";

function Switch({ className, ...props }: SwitchPrimitive.Root.Props) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer group/switch relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors duration-150 ease-out outline-none after:absolute after:-inset-x-3 after:-inset-y-2 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-checked:border-primary/60 data-checked:bg-primary/15 data-unchecked:border-border data-unchecked:bg-muted data-disabled:cursor-not-allowed data-disabled:opacity-50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none ml-0.5 block size-5 rounded-full ring-0 transition-transform duration-150 ease-out data-unchecked:translate-x-0 data-unchecked:bg-muted-foreground data-checked:translate-x-5 data-checked:bg-primary"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
