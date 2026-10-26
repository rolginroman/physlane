import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "#/components/ui/select";

type Option<T extends string> = { value: T; label: string };

type OptionSelectProps<T extends string> = {
  id?: string;
  value: T | null;
  onValueChange: (value: T) => void;
  options: readonly Option<T>[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
};

/** Select composed from a flat option list; the common case needs no item markup. */
export function OptionSelect<T extends string>({
  id,
  value,
  onValueChange,
  options,
  placeholder,
  disabled,
  className,
  ...aria
}: OptionSelectProps<T>) {
  return (
    <Select<T>
      id={id}
      items={options}
      value={value}
      disabled={disabled}
      onValueChange={(next) => {
        if (next != null) onValueChange(next);
      }}
    >
      <SelectTrigger className={className} {...aria}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent alignItemWithTrigger={false}>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
