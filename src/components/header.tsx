import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useSession } from "#/lib/auth-client";
import { useTelegramMode } from "#/lib/telegram-mode";
import { SettingsDrawer } from "#/components/settings-drawer";
import { ThemeSwitch } from "#/components/theme-switch";
import { Button, buttonVariants } from "#/components/ui/button";
import { cn } from "#/lib/cn";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/intake", label: "Intake" },
  { to: "/cycles", label: "Cycles" },
] as const;

const navLinkBase =
  "inline-flex min-h-11 items-center rounded-md px-2 text-sm font-medium sm:px-2.5";
// Signed-in links sit in the header row from sm up; below sm they move to the
// strip under the header (the row cannot fit them on 320-400px phones).
const navLinkWide =
  "hidden min-h-11 items-center rounded-md px-2.5 text-sm font-medium sm:inline-flex";

export function Header() {
  const { data: session, isPending } = useSession();
  // Telegram mode: slim the header, no marketing CTAs.
  const tgMode = useTelegramMode();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const gearRef = useRef<HTMLButtonElement>(null);

  const user = session?.user;

  return (
    <>
      <header
        className={`sticky top-0 z-40 border-b border-line bg-bg/80 backdrop-blur ${
          tgMode ? "min-h-14" : "h-14"
        }`}
        style={tgMode ? { paddingTop: "var(--tg-safe-top, 0px)" } : undefined}
      >
        <div className="mx-auto flex h-full max-w-5xl items-center gap-2 px-3 sm:gap-3 sm:px-4">
          <Link
            to="/"
            aria-label="physlane home"
            className="shrink-0 text-base font-semibold tracking-tight text-text no-underline"
          >
            phys<span className="text-brand-text">lane</span>
          </Link>

          <nav
            aria-label="App"
            className="ml-auto flex items-center gap-0.5 sm:gap-1"
          >
            <ThemeSwitch className="mr-1 shrink-0" />
            {isPending ? null : user ? (
              <>
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={navLinkWide}
                    activeProps={{ className: "text-brand-text" }}
                    inactiveProps={{ className: "text-dim hover:text-text" }}
                  >
                    {item.label}
                  </Link>
                ))}
                {!tgMode && (
                  <Link
                    to="/billing"
                    className={navLinkWide}
                    activeProps={{ className: "text-brand-text" }}
                    inactiveProps={{ className: "text-dim hover:text-text" }}
                  >
                    Billing
                  </Link>
                )}
                <Button
                  ref={gearRef}
                  type="button"
                  variant="ghost"
                  size="icon-lg"
                  onClick={() => setSettingsOpen(true)}
                  aria-label="Settings"
                  aria-haspopup="dialog"
                  className="ml-1 size-11 shrink-0"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 18 18"
                    fill="none"
                    aria-hidden="true"
                  >
                    <path
                      d="M2.5 5h13M2.5 9h13M2.5 13h13"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                    <circle
                      cx="6.5"
                      cy="5"
                      r="1.75"
                      fill="var(--color-canvas)"
                    />
                    <circle
                      cx="12"
                      cy="9"
                      r="1.75"
                      fill="var(--color-canvas)"
                    />
                    <circle
                      cx="5"
                      cy="13"
                      r="1.75"
                      fill="var(--color-canvas)"
                    />
                    <circle
                      cx="6.5"
                      cy="5"
                      r="1.75"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <circle
                      cx="12"
                      cy="9"
                      r="1.75"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                    <circle
                      cx="5"
                      cy="13"
                      r="1.75"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    />
                  </svg>
                </Button>
              </>
            ) : tgMode ? null : (
              <>
                <Link
                  to="/sign-in"
                  className={`${navLinkBase} whitespace-nowrap text-dim hover:text-text`}
                >
                  Sign in
                </Link>
                <Link
                  to="/sign-up"
                  className={cn(
                    buttonVariants(),
                    "min-h-11 whitespace-nowrap px-3 font-semibold no-underline",
                  )}
                >
                  {/* Full label needs ~350px of header; narrower phones get the short one. */}
                  <span className="min-[360px]:hidden">Sign up</span>
                  <span className="hidden min-[360px]:inline">
                    Create account
                  </span>
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>
      {!isPending && user && (
        <nav aria-label="Sections" className="border-b border-line sm:hidden">
          <div className="mx-auto flex max-w-5xl px-3">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`${navLinkBase} flex-1 justify-center`}
                activeProps={{ className: "text-brand-text" }}
                inactiveProps={{ className: "text-dim hover:text-text" }}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
      <SettingsDrawer
        open={settingsOpen}
        onClose={() => {
          setSettingsOpen(false);
          gearRef.current?.focus();
        }}
      />
    </>
  );
}
