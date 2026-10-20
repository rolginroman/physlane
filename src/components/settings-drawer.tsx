import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "#/components/ui/sheet";
import { signOut, useSession } from "#/lib/auth-client";
import { getViewer, saveSettings } from "#/lib/auth-guard.fns";
import { rotateShareLink } from "#/server/share.fns";
import { shareUrl } from "#/lib/share";
import { exportIntakeCsv, exportMeasurementsCsv } from "#/server/export.fns";
import type { Sex } from "#/lib/navy-bf";
import { RadioGroup, RadioGroupItem } from "#/components/ui/radio-group";
import { Switch } from "#/components/ui/switch";
import { lengthFromInput, lengthToInput, type UnitSystem } from "#/lib/units";

const SEX_RADIO_NONE = "none";

function sexToRadioValue(sex: Sex | null): string {
  return sex ?? SEX_RADIO_NONE;
}

function sexFromRadioValue(value: string): Sex | null {
  if (value === SEX_RADIO_NONE) return null;
  return value as Sex;
}

const SEX_OPTIONS: { value: Sex | null; label: string }[] = [
  { value: null, label: "Prefer not to say" },
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
];

/** Height is optional; stored in cm for the Navy estimate. */
function optionalHeightError(
  height: string,
  units: UnitSystem,
): string | undefined {
  if (!height.trim()) return undefined;
  const cm = lengthFromInput(height, units);
  if (cm == null)
    return units === "metric"
      ? "Enter a number in cm."
      : "Enter a number in inches.";
  if (cm < 90 || cm > 250) {
    return units === "metric"
      ? "Enter a height between 90 and 250 cm."
      : "Enter a height between 36 and 98 in.";
  }
  return undefined;
}

/** Client-side CSV download via Blob. */
function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const sectionClass = "border-t border-border pt-4";

/** Device timezone, the only source of truth for reminder delivery. */
function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

/** "GMT+2"-style offset for the hint line. */
function tzOffsetLabel(tz: string): string {
  try {
    const part = new Intl.DateTimeFormat("en", {
      timeZone: tz,
      timeZoneName: "shortOffset",
    })
      .formatToParts(new Date())
      .find((p) => p.type === "timeZoneName");
    return part?.value ?? "";
  } catch {
    return "";
  }
}

const rowButton =
  "inline-flex min-h-11 items-center rounded-lg border border-border px-3 text-sm font-medium text-secondary hover:text-foreground disabled:opacity-60";

interface ViewerSettings {
  units: UnitSystem;
  heightCm: number | null;
  sex: Sex | null;
  telegramId: string | null;
  reminderTime: string | null;
  reminderTz: string | null;
  shareToken: string | null;
}

export function SettingsDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { data: session } = useSession();
  const closeRef = useRef<HTMLButtonElement>(null);

  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [viewer, setViewer] = useState<ViewerSettings | null>(null);

  // Profile form state (loaded once per open).
  const [height, setHeight] = useState("");
  const [sexChoice, setSexChoice] = useState<Sex | null>(null);
  const [time, setTime] = useState("");
  const [pending, setPending] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Share state (instant actions).
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  const [sharePending, setSharePending] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  // Export state.
  const [exporting, setExporting] = useState<"measurements" | "intake" | null>(
    null,
  );
  const [exportError, setExportError] = useState<string | null>(null);

  const units = viewer?.units ?? "metric";
  const telegramId = viewer?.telegramId ?? null;
  const reminderEnabled = time !== "";
  const liveHeight = optionalHeightError(height, units);
  // Drawer renders only when open (client), so this is never evaluated on the server.
  const browserTz = browserTimeZone();

  // Load settings on open; refetch each time so saves elsewhere stay honest.
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setLoadError(false);
    getViewer()
      .then((v) => {
        if (!v) {
          setLoadError(true);
          return;
        }
        setViewer({
          units: (v.unitSystem ?? "metric") as UnitSystem,
          heightCm: v.heightCm ?? null,
          sex: v.sex ?? null,
          telegramId: v.telegramId ?? null,
          reminderTime: v.reminderTime ?? null,
          reminderTz: v.reminderTz ?? null,
          shareToken: v.shareToken ?? null,
        });
        setHeight(
          lengthToInput(
            v.heightCm ?? null,
            (v.unitSystem ?? "metric") as UnitSystem,
          ),
        );
        setSexChoice(v.sex ?? null);
        setTime(v.reminderTime ?? "");
        setShareToken(v.shareToken ?? null);
        setSaved(false);
      })
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => setOrigin(window.location.origin), []);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
  }, [open]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (liveHeight || pending || !viewer) return;
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      await saveSettings({
        data: {
          heightCm: lengthFromInput(height, units),
          sex: sexChoice,
          ...(telegramId
            ? {
                reminderTime: time || null,
                reminderTz: time ? browserTz : null,
              }
            : {}),
        },
      });
      await router.invalidate();
      setSaved(true);
    } catch {
      setError("Could not save your settings. Try again.");
    } finally {
      setPending(false);
    }
  }

  async function pickUnits(next: UnitSystem) {
    if (next === units) return;
    try {
      await saveSettings({ data: { unitSystem: next } });
      setViewer((v) => (v ? { ...v, units: next } : v));
      setHeight((h) =>
        h.trim() ? lengthToInput(lengthFromInput(h, units), next) : h,
      );
      await router.invalidate();
    } catch {
      // Stays on current units; tapping again retries.
    }
  }

  async function handleRotate() {
    if (sharePending) return;
    setSharePending(true);
    setShareError(null);
    setCopied(false);
    try {
      const { token } = await rotateShareLink();
      setShareToken(token);
      await router.invalidate();
    } catch {
      setShareError("Could not update the share link. Try again.");
    } finally {
      setSharePending(false);
    }
  }

  async function handleCopy() {
    if (!shareToken || !origin) return;
    setCopied(false);
    try {
      await navigator.clipboard.writeText(shareUrl(origin, shareToken));
      setCopied(true);
    } catch {
      setShareError(
        "Could not copy. Select the link text and copy it manually.",
      );
    }
  }

  async function handleExport(kind: "measurements" | "intake") {
    if (exporting) return;
    setExporting(kind);
    setExportError(null);
    try {
      const csv =
        kind === "measurements"
          ? await exportMeasurementsCsv()
          : await exportIntakeCsv();
      downloadCsv(`${kind}.csv`, csv);
    } catch {
      setExportError("Could not build the export. Try again.");
    } finally {
      setExporting(null);
    }
  }

  async function handleSignOut() {
    await signOut();
    await router.navigate({ to: "/" });
    void router.invalidate();
  }

  const user = session?.user;
  const displayName = user?.name?.trim() || user?.email || "";
  const initial = displayName ? (displayName[0] ?? "").toUpperCase() : "";

  return (
    <Sheet
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        className="flex h-full w-full max-w-none flex-col gap-0 border-border bg-background p-0 shadow-2xl sm:w-[24rem] sm:max-w-[24rem]"
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-4">
          <SheetTitle className="m-0 text-base font-semibold tracking-tight">
            Settings
          </SheetTitle>
          <SheetDescription className="sr-only">
            Account, units, profile, reminders, sharing, and export.
          </SheetDescription>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="inline-flex size-11 items-center justify-center rounded-md text-secondary hover:text-foreground"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M4 4l10 10M14 4L4 14"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="space-y-3" aria-label="Loading settings">
              <div className="h-11 animate-pulse rounded-lg bg-muted" />
              <div className="h-11 animate-pulse rounded-lg bg-muted" />
              <div className="h-11 animate-pulse rounded-lg bg-muted" />
            </div>
          ) : loadError ? (
            <p role="alert" className="m-0 text-sm text-danger">
              Could not load your settings. Close and reopen the drawer to
              retry.
            </p>
          ) : (
            <form onSubmit={handleSave} noValidate className="m-0">
              {/* Account */}
              <section
                aria-labelledby="set-account"
                className={sectionClass + " border-t-0 pt-0"}
              >
                <h3 id="set-account" className="m-0 text-sm font-semibold">
                  Account
                </h3>
                <div className="mt-2 flex items-center gap-3">
                  <span
                    aria-hidden="true"
                    className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-sm font-semibold text-secondary"
                  >
                    {initial || "·"}
                  </span>
                  <div className="min-w-0">
                    <p className="m-0 truncate text-sm">{displayName}</p>
                    <p className="m-0 text-xs text-muted-foreground">
                      Free plan while beta
                    </p>
                  </div>
                </div>
              </section>

              {/* Units */}
              <section
                aria-labelledby="set-units"
                className={sectionClass + " mt-4"}
              >
                <h3 id="set-units" className="m-0 text-sm font-semibold">
                  Units
                </h3>
                <RadioGroup
                  value={units}
                  onValueChange={(next) => pickUnits(next as UnitSystem)}
                  aria-labelledby="set-units"
                  className="mt-2 grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted p-1"
                >
                  {(["metric", "imperial"] as const).map((u) => (
                    <RadioGroupItem
                      key={u}
                      value={u}
                      className={`min-h-11 items-center justify-center rounded-md px-3 text-sm font-medium ${
                        units === u
                          ? "bg-card text-foreground"
                          : "text-secondary hover:text-foreground"
                      }`}
                    >
                      {u === "metric" ? "Metric (kg, cm)" : "Imperial (lb, in)"}
                    </RadioGroupItem>
                  ))}
                </RadioGroup>
              </section>

              {/* Profile */}
              <section
                aria-labelledby="set-profile"
                className={sectionClass + " mt-4"}
              >
                <h3 id="set-profile" className="m-0 text-sm font-semibold">
                  Profile
                </h3>
                <p className="m-0 mt-1 text-xs text-secondary">
                  Height and sex tune the body fat estimate. Optional.
                </p>
                <div className="mt-3 grid gap-3">
                  <div>
                    <label htmlFor="set-height" className="label">
                      Height ({units === "metric" ? "cm" : "in"})
                    </label>
                    <input
                      id="set-height"
                      type="text"
                      inputMode="decimal"
                      className="input num"
                      placeholder={units === "metric" ? "180" : "71"}
                      value={height}
                      onChange={(e) => {
                        setHeight(e.target.value);
                        setSaved(false);
                      }}
                      aria-invalid={liveHeight ? true : undefined}
                      aria-describedby={
                        liveHeight ? "set-height-error" : "set-height-hint"
                      }
                    />
                    {liveHeight ? (
                      <p id="set-height-error" className="field-error">
                        {liveHeight}
                      </p>
                    ) : (
                      <p id="set-height-hint" className="hint">
                        Leave blank to clear.
                      </p>
                    )}
                  </div>
                  <div>
                    <span className="label" id="set-sex-label">
                      Sex
                    </span>
                    <RadioGroup
                      value={sexToRadioValue(sexChoice)}
                      onValueChange={(next) => {
                        setSexChoice(sexFromRadioValue(next));
                        setSaved(false);
                      }}
                      aria-labelledby="set-sex-label"
                      className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-muted p-1"
                    >
                      {SEX_OPTIONS.map((opt) => (
                        <RadioGroupItem
                          key={opt.label}
                          value={sexToRadioValue(opt.value)}
                          className={`min-h-11 items-center justify-center rounded-md px-2 text-sm font-medium ${
                            sexChoice === opt.value
                              ? "bg-card text-foreground"
                              : "text-secondary hover:text-foreground"
                          }`}
                        >
                          {opt.label}
                        </RadioGroupItem>
                      ))}
                    </RadioGroup>
                  </div>
                </div>
              </section>

              {/* Telegram */}
              <section
                aria-labelledby="set-telegram"
                className={sectionClass + " mt-4"}
              >
                <h3 id="set-telegram" className="m-0 text-sm font-semibold">
                  Telegram
                </h3>
                {telegramId ? (
                  <p className="m-0 mt-1 text-xs text-secondary">
                    Linked. Quick logging and reminders are on.
                  </p>
                ) : (
                  <p className="m-0 mt-1 max-w-xl text-xs leading-relaxed text-secondary">
                    Open physlane in Telegram and sign in; the accounts merge
                    via your email. Enables quick logging and daily reminders.
                  </p>
                )}
              </section>

              {/* Reminder */}
              <section
                aria-labelledby="set-reminder"
                className={sectionClass + " mt-4"}
              >
                <h3 id="set-reminder" className="m-0 text-sm font-semibold">
                  Daily reminder
                </h3>
                <p className="m-0 mt-1 text-xs text-secondary">
                  One Telegram nudge at your time, only on days you have not
                  logged yet.
                </p>
                {telegramId ? (
                  <div className="mt-2 grid grid-cols-[1fr_auto] items-end gap-2">
                    <div className="min-w-0">
                      <label htmlFor="set-remind-time" className="label">
                        Time
                      </label>
                      <input
                        id="set-remind-time"
                        type="time"
                        className="input num w-full"
                        value={time}
                        onChange={(e) => {
                          setTime(e.target.value);
                          setSaved(false);
                        }}
                      />
                    </div>
                    <div className="flex min-h-11 flex-col items-end justify-end gap-1 pb-0.5">
                      <span
                        id="set-remind-enabled-label"
                        className="text-xs text-secondary"
                      >
                        Reminder
                      </span>
                      <Switch
                        id="set-remind-enabled"
                        checked={reminderEnabled}
                        aria-labelledby="set-remind-enabled-label"
                        onCheckedChange={(checked) => {
                          setTime(checked ? time || "09:00" : "");
                          setSaved(false);
                        }}
                      />
                    </div>
                    <div className="col-span-2 min-w-0">
                      <span className="label">Time zone</span>
                      <p className="m-0 rounded-lg border border-border bg-muted px-3 py-2.5 text-sm text-secondary">
                        {browserTz}
                        {tzOffsetLabel(browserTz) ? (
                          <span className="text-muted-foreground">
                            {" "}
                            · {tzOffsetLabel(browserTz)} · from this device
                          </span>
                        ) : (
                          <span className="text-muted-foreground">
                            {" "}
                            · from this device
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="m-0 mt-2 text-xs text-secondary">
                    Link Telegram above to get reminders.
                  </p>
                )}
              </section>

              {/* Share */}
              <section
                aria-labelledby="set-share"
                className={sectionClass + " mt-4"}
              >
                <h3 id="set-share" className="m-0 text-sm font-semibold">
                  Share progress
                </h3>
                <p className="m-0 mt-1 text-xs text-secondary">
                  A read-only page with your numbers. No email or Telegram
                  details.
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    aria-label="Share link"
                    className="input num min-w-44 flex-1"
                    placeholder="No link yet"
                    value={
                      shareToken && origin ? shareUrl(origin, shareToken) : ""
                    }
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  {shareToken && (
                    <button
                      type="button"
                      onClick={handleCopy}
                      className={rowButton}
                    >
                      Copy
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleRotate}
                    disabled={sharePending}
                    className={rowButton}
                  >
                    {sharePending
                      ? "Updating…"
                      : shareToken
                        ? "Revoke / new link"
                        : "Create link"}
                  </button>
                  {copied && !sharePending && (
                    <p role="status" className="m-0 text-xs text-secondary">
                      Copied.
                    </p>
                  )}
                </div>
                {shareError && (
                  <p role="alert" className="m-0 mt-2 text-xs text-danger">
                    {shareError}
                  </p>
                )}
              </section>

              {/* Export */}
              <section
                aria-labelledby="set-export"
                className={sectionClass + " mt-4"}
              >
                <h3 id="set-export" className="m-0 text-sm font-semibold">
                  Export
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleExport("measurements")}
                    disabled={exporting != null}
                    className={rowButton}
                  >
                    {exporting === "measurements"
                      ? "Exporting…"
                      : "Measurements CSV"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport("intake")}
                    disabled={exporting != null}
                    className={rowButton}
                  >
                    {exporting === "intake" ? "Exporting…" : "Intake CSV"}
                  </button>
                </div>
                {exportError && (
                  <p role="alert" className="m-0 mt-2 text-xs text-danger">
                    {exportError}
                  </p>
                )}
              </section>

              {error && (
                <p
                  role="alert"
                  className="mt-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
                >
                  {error}
                </p>
              )}

              <div className="mt-4 flex items-center gap-3 pb-2">
                <button
                  type="submit"
                  disabled={pending || Boolean(liveHeight)}
                  className="btn-primary px-5"
                >
                  {pending ? "Saving…" : "Save changes"}
                </button>
                {saved && !pending && (
                  <p role="status" className="m-0 text-xs text-secondary">
                    Saved.
                  </p>
                )}
              </div>
            </form>
          )}
        </div>

        <div
          className="shrink-0 border-t border-border px-4 py-3"
          style={{
            paddingBottom: "calc(0.75rem + var(--tg-safe-bottom, 0px))",
          }}
        >
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-danger/40 px-4 text-sm font-medium text-danger hover:bg-danger/10"
          >
            Sign out
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
