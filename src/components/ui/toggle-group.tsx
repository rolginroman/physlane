import { createContext, useContext } from "react";
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group";
import { type VariantProps } from "class-variance-authority";
import { cn } from "#/lib/cn";
import { toggleVariants } from "#/components/ui/toggle";

const ToggleGroupContext = createContext<VariantProps<typeof toggleVariants>>({
  size: "default",
  variant: "default",
});

function ToggleGroup<Value extends string>({
  className,
  variant,
  size,
  children,
  ...props
}: ToggleGroupPrimitive.Props<Value> & VariantProps<typeof toggleVariants>) {
  return (
    <ToggleGroupPrimitive<Value>
      data-slot="toggle-group"
      data-variant={variant}
      data-size={size}
      className={cn(
        "group/toggle-group flex flex-wrap items-center gap-2 data-[variant=segment]:gap-1 data-[variant=segment]:rounded-lg data-[variant=segment]:border data-[variant=segment]:border-border data-[variant=segment]:bg-muted data-[variant=segment]:p-1",
        className,
      )}
      {...props}
    >
      <ToggleGroupContext.Provider value={{ variant, size }}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive>
  );
}

function ToggleGroupItem({
  className,
  children,
  variant = "default",
  size = "default",
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  const context = useContext(ToggleGroupContext);

  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      className={cn(
        "shrink-0 focus-visible:z-10",
        toggleVariants({
          variant: context.variant || variant,
          size: context.size || size,
        }),
        className,
      )}
      {...props}
    >
      {children}
    </TogglePrimitive>
  );
}

export { ToggleGroup, ToggleGroupItem };
