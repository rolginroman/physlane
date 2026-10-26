import { useId } from "react";
import { ToggleGroup, ToggleGroupItem } from "#/components/ui/toggle-group";

/** Required single choice: the pressed option cannot be toggled off. */
export function ProgramChoiceGroup<T extends string>({
  label,
  options,
  value,
  onChange,
  optionLabel,
  variant = "chip",
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  optionLabel: (value: T) => string;
  variant?: "chip" | "segment";
}) {
  const labelId = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <span id={labelId} className="text-sm font-medium text-muted-foreground">
        {label}
      </span>
      <ToggleGroup<T>
        aria-labelledby={labelId}
        variant={variant}
        size="touch"
        value={[value]}
        onValueChange={(next) => {
          const picked = next[0];
          if (picked !== undefined) onChange(picked);
        }}
      >
        {options.map((option) => (
          <ToggleGroupItem key={option} value={option}>
            {optionLabel(option)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
