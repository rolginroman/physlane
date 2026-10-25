import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { cn } from "#/lib/cn";
import {
  loadFromInput,
  loadToInput,
  loadUnitLabel,
} from "#/lib/programs/load-units";
import {
  numberToInput,
  parseNumberInput,
} from "#/lib/programs/entry-validation";
import type { UnitSystem } from "#/lib/units";

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-xs text-destructive">
      {message}
    </p>
  );
}

/** Holds the typed text so "7." or "-" survive while the parsed value is stored. */
function DraftNumberField({
  id,
  label,
  value,
  toText,
  fromText,
  onChange,
  error,
  className,
  inputMode,
}: {
  id: string;
  label: string;
  value: number | null;
  toText: (value: number | null) => string;
  fromText: (text: string) => number | null;
  onChange: (value: number | null) => void;
  error: string | undefined;
  className?: string;
  inputMode: "numeric" | "decimal";
}) {
  const [text, setText] = useState(() => toText(value));
  const lastSent = useRef(value);
  useEffect(() => {
    // Outside changes (type switch, reload) replace the draft; our own edits do not.
    if (!Object.is(value, lastSent.current)) {
      lastSent.current = value;
      setText(toText(value));
    }
  }, [value, toText]);

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        inputMode={inputMode}
        className={cn("mt-1", className)}
        value={text}
        onChange={(e) => {
          const parsed = fromText(e.target.value);
          setText(e.target.value);
          lastSent.current = parsed;
          onChange(parsed);
        }}
        aria-invalid={error != null}
        aria-describedby={error ? `${id}-err` : undefined}
      />
      <FieldError id={`${id}-err`} message={error} />
    </div>
  );
}

export function NumberField(props: {
  id: string;
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  error: string | undefined;
  className?: string;
  inputMode?: "numeric" | "decimal";
}) {
  return (
    <DraftNumberField
      {...props}
      inputMode={props.inputMode ?? "numeric"}
      toText={numberToInput}
      fromText={parseNumberInput}
    />
  );
}

export function LoadField({
  id,
  value,
  unitSystem,
  onChange,
  error,
}: {
  id: string;
  value: number | null;
  unitSystem: UnitSystem;
  onChange: (kg: number | null) => void;
  error: string | undefined;
}) {
  const toText = useCallback(
    (kg: number | null) => loadToInput(kg, unitSystem),
    [unitSystem],
  );
  const fromText = useCallback(
    (text: string) => loadFromInput(text, unitSystem),
    [unitSystem],
  );
  return (
    <DraftNumberField
      id={id}
      label={`Load in ${loadUnitLabel(unitSystem)}`}
      value={value}
      toText={toText}
      fromText={fromText}
      onChange={onChange}
      error={error}
      className="w-24"
      inputMode="decimal"
    />
  );
}
