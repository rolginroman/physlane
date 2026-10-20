import { useEffect, useSyncExternalStore } from "react";
import { RadioGroup, RadioGroupItem } from "#/components/ui/radio-group";
import {
  readThemePreference,
  setThemePreference,
  subscribeThemePreference,
  applyThemePreference,
  type ThemePreference,
} from "#/lib/theme";

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

function ThemeIcon({ value }: { value: ThemePreference }) {
  if (value === "light") {
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <circle cx="8" cy="8" r="3" stroke="currentColor" strokeWidth="1.5" />
        <path
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.4 3.4l1.42 1.42M11.18 11.18l1.42 1.42M3.4 12.6l1.42-1.42M11.18 4.82l1.42-1.42"
        />
      </svg>
    );
  }
  if (value === "dark") {
    return (
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M6.2 1.8a6.5 6.5 0 1 0 8 8A5.5 5.5 0 1 1 6.2 1.8Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <rect
        x="2"
        y="3"
        width="12"
        height="8"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        d="M6 14h4M8 11v3"
      />
    </svg>
  );
}

/**
 * Light / Dark / System radiogroup. `pill` (default) is the compact app
 * Header control; `segmented` renders text-only options styled by the
 * site's `.theme-seg` rules (src/styles/site.css).
 */
export function ThemeSwitch({
  className = "",
  variant = "pill",
}: {
  className?: string;
  variant?: "pill" | "segmented";
}) {
  const preference = useSyncExternalStore(
    subscribeThemePreference,
    readThemePreference,
    () => "system" as ThemePreference,
  );

  useEffect(() => {
    applyThemePreference(preference);
  }, [preference]);

  useEffect(() => {
    if (preference !== "system") return undefined;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyThemePreference("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [preference]);

  if (variant === "segmented") {
    return (
      <div
        role="radiogroup"
        aria-label="Color theme"
        className={`theme-seg ${className}`}
      >
        {OPTIONS.map((opt) => (
          <label key={opt.value}>
            <input
              type="radio"
              name="theme"
              value={opt.value}
              checked={preference === opt.value}
              className="sr-only"
              onChange={() => setThemePreference(opt.value)}
            />
            {opt.label}
          </label>
        ))}
      </div>
    );
  }

  // Below sm the pill collapses to one button that cycles the same three
  // options, so the header fits 320px phones with a 44px tap target.
  const currentIdx = Math.max(
    0,
    OPTIONS.findIndex((o) => o.value === preference),
  );
  const current = OPTIONS[currentIdx];
  const next = OPTIONS[(currentIdx + 1) % OPTIONS.length];
  if (current === undefined || next === undefined) {
    throw new Error("theme OPTIONS misconfigured");
  }
  return (
    <>
      <button
        type="button"
        aria-label={`Color theme: ${current.label}. Switch to ${next.label}`}
        onClick={() => setThemePreference(next.value)}
        className={`inline-flex size-11 items-center justify-center rounded-full text-secondary hover:text-foreground sm:hidden ${className}`}
      >
        <ThemeIcon value={preference} />
      </button>
      <RadioGroup
        value={preference}
        onValueChange={(next) => setThemePreference(next as ThemePreference)}
        aria-label="Color theme"
        className={`hidden w-auto items-center gap-0.5 rounded-full border border-border bg-card p-0.5 sm:inline-flex ${className}`}
      >
        {OPTIONS.map((opt) => {
          const checked = preference === opt.value;
          return (
            <RadioGroupItem
              key={opt.value}
              value={opt.value}
              className={`min-h-9 cursor-pointer items-center justify-center rounded-full px-2.5 text-xs font-medium transition-colors duration-150 ease-out ${
                checked
                  ? "bg-muted text-foreground"
                  : "text-secondary hover:text-foreground"
              }`}
            >
              {opt.label}
            </RadioGroupItem>
          );
        })}
      </RadioGroup>
    </>
  );
}
