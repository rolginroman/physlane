import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import { signOut, useSession } from "#/lib/auth-client";
import { getViewer, saveSettings } from "#/lib/auth-guard.fns";
import { rotateShareLink } from "#/server/share.fns";
import { shareUrl } from "#/lib/share";
import { exportIntakeCsv, exportMeasurementsCsv } from "#/server/export.fns";
import type { Sex } from "#/lib/navy-bf";
import { lengthFromInput, lengthToInput, type UnitSystem } from "#/lib/units";

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

const sectionClass = "border-t border-line pt-4";

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
  "inline-flex min-h-11 items-center rounded-lg border border-line px-3 text-sm font-medium text-dim hover:text-text disabled:opacity-60";

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
  const panelRef = useRef<HTMLDivElement>(null);
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

  // Scroll lock + Escape + focus while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab") trapFocus(e);
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /** Keep Tab inside the panel while the drawer is open. */
  function trapFocus(e: KeyboardEvent) {
    const panel = panelRef.current;
    if (!panel) return;
    const focusable = panel.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close settings"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-black/50"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        className="absolute inset-y-0 right-0 flex w-full flex-col border-l border-line bg-bg shadow-2xl motion-safe:animate-[drawer-in_200ms_cubic-bezier(0.25,1,0.5,1)] sm:w-[24rem]"
      >
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-line px-4">
          <h2 className="m-0 text-base font-semibold tracking-tight">
            Settings
          </h2>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="inline-flex size-11 items-center justify-center rounded-md text-dim hover:text-text"
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
              <div className="h-11 animate-pulse rounded-lg bg-surface2" />
              <div className="h-11 animate-pulse rounded-lg bg-surface2" />
              <div className="h-11 animate-pulse rounded-lg bg-surface2" />
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
                    className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-surface2 text-sm font-semibold text-dim"
                  >
                    {initial || "·"}
                  </span>
                  <div className="min-w-0">
                    <p className="m-0 truncate text-sm">{displayName}</p>
                    <p className="m-0 text-xs text-faint">
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
                <div
                  role="radiogroup"
                  aria-labelledby="set-units"
                  className="mt-2 grid grid-cols-2 gap-1 rounded-lg border border-line bg-surface2 p-1"
                >
                  {(["metric", "imperial"] as const).map((u) => (
                    <button
                      key={u}
                      type="button"
                      role="radio"
                      aria-checked={units === u}
                      onClick={() => pickUnits(u)}
                      className={`min-h-11 rounded-md px-3 text-sm font-medium ${
                        units === u
                          ? "bg-surface text-text"
                          : "text-dim hover:text-text"
                      }`}
                    >
                      {u === "metric" ? "Metric (kg, cm)" : "Imperial (lb, in)"}
                    </button>
                  ))}
                </div>
              </section>

              {/* Profile */}
              <section
                aria-labelledby="set-profile"
                className={sectionClass + " mt-4"}
              >
                <h3 id="set-profile" className="m-0 text-sm font-semibold">
                  Profile
                </h3>
                <p className="m-0 mt-1 text-xs text-dim">
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
                    <div
                      role="radiogroup"
                      aria-labelledby="set-sex-label"
                      className="grid grid-cols-3 gap-1 rounded-lg border border-line bg-surface2 p-1"
                    >
                      {SEX_OPTIONS.map((opt) => (
                        <button
                          key={opt.label}
                          type="button"
                          role="radio"
                          aria-checked={sexChoice === opt.value}
                          onClick={() => {
                            setSexChoice(opt.value);
                            setSaved(false);
                          }}
                          className={`min-h-11 rounded-md px-2 text-sm font-medium ${
                            sexChoice === opt.value
                              ? "bg-surface text-text"
                              : "text-dim hover:text-text"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
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
                  <p className="m-0 mt-1 text-xs text-dim">
                    Linked. Quick logging and reminders are on.
                  </p>
                ) : (
                  <p className="m-0 mt-1 max-w-xl text-xs leading-relaxed text-dim">
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
                <p className="m-0 mt-1 text-xs text-dim">
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
                    <button
                      type="button"
                      role="switch"
                      aria-checked={reminderEnabled}
                      onClick={() => {
                        setTime(reminderEnabled ? "" : time || "09:00");
                        setSaved(false);
                      }}
                      className={`inline-flex min-h-11 items-center justify-center rounded-lg border px-4 text-sm font-medium ${
                        reminderEnabled
                          ? "border-brand-text/60 bg-brand-text/10 text-brand-text"
                          : "border-line text-dim hover:text-text"
                      }`}
                    >
                      {reminderEnabled ? "On" : "Off"}
                    </button>
                    <div className="col-span-2 min-w-0">
                      <span className="label">Time zone</span>
                      <p className="m-0 rounded-lg border border-line bg-surface2 px-3 py-2.5 text-sm text-dim">
                        {browserTz}
                        {tzOffsetLabel(browserTz) ? (
                          <span className="text-faint">
                            {" "}
                            · {tzOffsetLabel(browserTz)} · from this device
                          </span>
                        ) : (
                          <span className="text-faint">
                            {" "}
                            · from this device
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="m-0 mt-2 text-xs text-dim">
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
                <p className="m-0 mt-1 text-xs text-dim">
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
                    <p role="status" className="m-0 text-xs text-dim">
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
                  <p role="status" className="m-0 text-xs text-dim">
                    Saved.
                  </p>
                )}
              </div>
            </form>
          )}
        </div>

        <div
          className="shrink-0 border-t border-line px-4 py-3"
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
      </div>
    </div>
  );
}
