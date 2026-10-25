import { useCallback, useEffect, useId, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  AlertCircle,
  ArrowUpRight,
  Check,
  Copy,
  Globe,
  Info,
  Link2,
  QrCode as QrCodeIcon,
  RotateCw,
} from "lucide-react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import { RadioGroup, RadioGroupItem } from "#/components/ui/radio-group";
import {
  ResponsiveSheetBody,
  ResponsiveSheetContent,
  ResponsiveSheetHeader,
} from "#/components/ui/responsive-sheet";
import { Sheet, SheetTitle } from "#/components/ui/sheet";
import { AuthorProfileSetup } from "#/components/programs/author-profile-setup";
import { QrCode } from "#/components/programs/qr-code";
import { useMediaQuery } from "#/hooks/use-media-query";
import { isAppErrorCode } from "#/lib/app-error";
import { visibilityDisplayLabel } from "#/lib/programs/display-labels";
import { programActionErrorMessage } from "#/lib/programs/program-error-message";
import {
  publicProgramCanonicalUrlFromOrigin,
  publicProgramIdPermalinkUrlFromOrigin,
  shareLinkUrlFromOrigin,
} from "#/lib/programs/program-urls";
import {
  defaultShareSelection,
  HIDDEN_BY_MODERATION_NOTICE,
  planShareChange,
  publicChangeSummary,
  SHARE_QUESTION,
  SHARE_VISIBILITIES,
  visibilityLine,
  type ShareChange,
  type ShareVisibility,
} from "#/lib/programs/share-plan";
import {
  getMyAuthorSlug,
  rotateShareToken,
  setVisibility,
  type ProgramDTO,
} from "#/server/programs.fns";

export type ShareDialogProgram = Pick<
  ProgramDTO,
  | "id"
  | "title"
  | "visibility"
  | "shareToken"
  | "slug"
  | "revision"
  | "hiddenAt"
>;

type ShareDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Source of truth: the host echoes every change back via onProgramUpdated. */
  program: ShareDialogProgram;
  onProgramUpdated: (program: ProgramDTO | ShareDialogProgram) => void;
  /** Serializes revision-bumping writes with the host's other saves. */
  runExclusive?: <T>(job: () => Promise<T>) => Promise<T>;
  /** Opens straight on the replace-link confirm (library row action). */
  startWith?: "replace";
};

type Step =
  | { kind: "main" }
  | { kind: "replace" }
  | { kind: "confirm" }
  | { kind: "public-done"; summary: string[] };

type Identity = { authorSlug: string | null; profilePublished: boolean };

const COPY_RESET_MS = 2000;

function errorCode(error: unknown): string {
  const code = error instanceof Error ? error.message : "";
  return isAppErrorCode(code) ? code : "";
}

function Notice({
  tone = "info",
  children,
}: {
  tone?: "info" | "danger";
  children: ReactNode;
}) {
  const Icon = tone === "danger" ? AlertCircle : Info;
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={`flex items-start gap-2 rounded-lg border bg-muted p-3 text-sm text-foreground ${
        tone === "danger" ? "border-destructive/40" : "border-border"
      }`}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </div>
  );
}

function LinkBox({
  label,
  value,
  copied,
  onCopy,
}: {
  label: string;
  value: string;
  copied: boolean;
  onCopy: () => void;
}) {
  const id = useId();
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input id={id} readOnly value={value} className="truncate bg-muted" />
        <Button
          type="button"
          variant="outline"
          size="touch"
          className="shrink-0"
          onClick={onCopy}
          aria-live="polite"
        >
          {copied ? (
            <>
              <Check className="size-4" aria-hidden />
              Copied
            </>
          ) : (
            <>
              <Copy className="size-4" aria-hidden />
              Copy
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function VisibilityOptions({
  current,
  selected,
  disabled,
  onSelect,
}: {
  current: ShareVisibility;
  selected: ShareVisibility;
  disabled: boolean;
  onSelect: (visibility: ShareVisibility) => void;
}) {
  const labelId = useId();
  return (
    <div className="flex flex-col gap-2">
      <span id={labelId} className="text-sm font-medium text-muted-foreground">
        {SHARE_QUESTION}
      </span>
      <RadioGroup
        aria-labelledby={labelId}
        value={selected}
        disabled={disabled}
        onValueChange={(next) => onSelect(next as ShareVisibility)}
      >
        {SHARE_VISIBILITIES.map((visibility) => (
          <RadioGroupItem
            key={visibility}
            value={visibility}
            className="min-h-11 w-full items-start gap-3 rounded-lg border border-border bg-card p-3 text-left data-checked:border-primary data-checked:bg-brand-soft"
          >
            <span
              aria-hidden
              className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-input group-data-checked/radio-group-item:border-primary"
            >
              <span className="hidden size-2 rounded-full bg-primary group-data-checked/radio-group-item:block" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex items-center justify-between gap-2">
                <span className="font-medium text-foreground">
                  {visibilityDisplayLabel(visibility)}
                </span>
                {visibility === current ? (
                  <span className="text-xs text-muted-foreground">Current</span>
                ) : null}
              </span>
              <span className="text-sm text-text-secondary">
                {visibilityLine(visibility)}
              </span>
            </span>
          </RadioGroupItem>
        ))}
      </RadioGroup>
    </div>
  );
}

function ConsequenceList({ bullets }: { bullets: string[] }) {
  return (
    <ul className="m-0 flex list-disc flex-col gap-1.5 pl-5 text-sm text-text-secondary">
      {bullets.map((bullet) => (
        <li key={bullet}>{bullet}</li>
      ))}
    </ul>
  );
}

export function ShareDialog({
  open,
  onOpenChange,
  program,
  onProgramUpdated,
  runExclusive = (job) => job(),
  startWith,
}: ShareDialogProps) {
  const [identity, setIdentity] = useState<Identity>({
    authorSlug: null,
    profilePublished: false,
  });
  const [selected, setSelected] = useState<ShareVisibility>(() =>
    defaultShareSelection(program.visibility),
  );
  const [step, setStep] = useState<Step>(() =>
    startWith === "replace" ? { kind: "replace" } : { kind: "main" },
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<"address" | "permalink" | null>(null);
  const [qrToggled, setQrToggled] = useState<boolean | null>(null);
  const [profileSetupOpen, setProfileSetupOpen] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  const wide = useMediaQuery("(min-width: 40rem)");

  // Reset per-open state during render so a host re-render never clobbers a step.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSelected(defaultShareSelection(program.visibility));
      setStep(startWith === "replace" ? { kind: "replace" } : { kind: "main" });
      setError(null);
      setCopied(null);
      setQrToggled(null);
    }
  }

  const loadIdentity = useCallback(async (): Promise<Identity> => {
    try {
      const next = await getMyAuthorSlug();
      setIdentity(next);
      return next;
    } catch {
      return { authorSlug: null, profilePublished: false };
    }
  }, []);

  useEffect(() => {
    if (open) void loadIdentity();
  }, [open, loadIdentity]);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const host = origin.replace(/^https?:\/\//, "");
  const profileLabel = identity.authorSlug
    ? `${host}/u/${identity.authorSlug}`
    : null;

  const { authorSlug } = identity;
  const isPublic = program.visibility === "public";
  const address =
    authorSlug && program.slug
      ? isPublic
        ? publicProgramCanonicalUrlFromOrigin(origin, authorSlug, program.slug)
        : program.shareToken
          ? shareLinkUrlFromOrigin(
              origin,
              authorSlug,
              program.slug,
              program.shareToken,
            )
          : ""
      : "";
  const permalink =
    isPublic && authorSlug
      ? publicProgramIdPermalinkUrlFromOrigin(origin, authorSlug, program.id)
      : "";

  const hidden = program.hiddenAt != null;
  const change = hidden
    ? null
    : planShareChange({
        current: program.visibility,
        selected,
        title: program.title,
        profilePublished: identity.profilePublished,
        hasShareLink: program.shareToken != null,
        profileLabel,
      });

  const copy = async (key: "address" | "permalink", text: string) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(key);
      window.setTimeout(() => setCopied(null), COPY_RESET_MS);
    } catch {
      setError(programActionErrorMessage("copy-link"));
    }
  };

  const applyChange = async (planned: ShareChange) => {
    const firstPublic =
      planned.target === "public" && !identity.profilePublished;
    const hadShareLink = program.shareToken != null;
    setPending(true);
    setError(null);
    try {
      const updated = await runExclusive(async () => {
        const result = await setVisibility({
          data: { programId: program.id, target: planned.target },
        });
        onProgramUpdated(result);
        return result;
      });
      const next = await loadIdentity();
      setSelected(defaultShareSelection(updated.visibility));
      setStep(
        planned.target === "public"
          ? {
              kind: "public-done",
              summary: publicChangeSummary({
                profileLabel: next.authorSlug
                  ? `${host}/u/${next.authorSlug}`
                  : null,
                firstPublic,
                hadShareLink,
              }),
            }
          : { kind: "main" },
      );
    } catch (e) {
      setError(programActionErrorMessage("change-visibility", errorCode(e)));
      setStep({ kind: "main" });
    } finally {
      setPending(false);
    }
  };

  const replaceLink = async () => {
    setPending(true);
    setError(null);
    try {
      await runExclusive(async () => {
        const { shareToken, revision } = await rotateShareToken({
          data: { programId: program.id },
        });
        onProgramUpdated({ ...program, shareToken, revision });
      });
    } catch (e) {
      setError(programActionErrorMessage("replace-link", errorCode(e)));
    } finally {
      setPending(false);
      setStep({ kind: "main" });
    }
  };

  const onPrimary = (planned: ShareChange) => {
    if (planned.needsProfile) {
      setProfileSetupOpen(true);
    } else if (planned.confirm) {
      setStep({ kind: "confirm" });
    } else {
      void applyChange(planned);
    }
  };

  const qrOpen = qrToggled ?? wide;
  const titleText = `Share “${program.title}”`;

  const qrBlock = (
    <div className="flex items-start gap-3">
      <QrCode
        value={isPublic ? permalink : address}
        label="QR code for the link"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        {isPublic ? (
          <LinkBox
            label="Print link"
            value={permalink}
            copied={copied === "permalink"}
            onCopy={() => void copy("permalink", permalink)}
          />
        ) : null}
        <p className="m-0 text-sm text-muted-foreground">
          {isPublic
            ? "Keeps working if you rename your profile or this program. Use it on print."
            : "Scan to open the same link. Anyone who scans it can open the program."}
        </p>
      </div>
    </div>
  );

  const renderStep = () => {
    if (step.kind === "replace") {
      return (
        <>
          <ResponsiveSheetHeader>
            <SheetTitle>Replace the share link?</SheetTitle>
          </ResponsiveSheetHeader>
          <ResponsiveSheetBody>
            <p className="m-0 text-sm text-text-secondary">
              The current link stops working for everyone who has it. You get a
              new link to send to the people who should keep access.
            </p>
            <Button
              type="button"
              variant="destructive"
              size="touch"
              className="w-full"
              disabled={pending}
              onClick={() => void replaceLink()}
            >
              {pending ? "Replacing…" : "Replace link"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="touch"
              className="w-full"
              disabled={pending}
              onClick={() => setStep({ kind: "main" })}
            >
              Cancel
            </Button>
          </ResponsiveSheetBody>
        </>
      );
    }

    if (step.kind === "confirm" && change?.confirm) {
      const { confirm } = change;
      return (
        <>
          <ResponsiveSheetHeader>
            {change.needsProfile ? (
              <p className="m-0 text-xs font-medium text-muted-foreground">
                Step 2 of 2
              </p>
            ) : null}
            <SheetTitle>{confirm.title}</SheetTitle>
          </ResponsiveSheetHeader>
          <ResponsiveSheetBody>
            <ConsequenceList bullets={confirm.bullets} />
            <Button
              type="button"
              variant={confirm.destructive ? "destructive" : "default"}
              size="touch"
              className="w-full"
              disabled={pending}
              onClick={() => void applyChange(change)}
            >
              {change.target === "public" ? (
                <Globe className="size-4" aria-hidden />
              ) : null}
              {pending ? change.pendingLabel : confirm.confirmLabel}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="touch"
              className="w-full"
              disabled={pending}
              onClick={() => setStep({ kind: "main" })}
            >
              {confirm.cancelLabel}
            </Button>
          </ResponsiveSheetBody>
        </>
      );
    }

    if (step.kind === "public-done") {
      return (
        <>
          <ResponsiveSheetHeader>
            <SheetTitle>{titleText}</SheetTitle>
          </ResponsiveSheetHeader>
          <ResponsiveSheetBody>
            <ul className="m-0 flex list-none flex-col gap-2 p-0 text-sm text-foreground">
              {step.summary.map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <Check
                    className="mt-0.5 size-4 shrink-0 text-data-positive"
                    aria-hidden
                  />
                  {line}
                </li>
              ))}
            </ul>
            <LinkBox
              label="Public address"
              value={address}
              copied={copied === "address"}
              onCopy={() => void copy("address", address)}
            />
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-muted-foreground">
                QR and print link
              </span>
              {qrBlock}
            </div>
            {authorSlug && program.slug ? (
              <Link
                to="/u/$authorSlug/$programRef"
                params={{ authorSlug, programRef: program.slug }}
                className="inline-flex min-h-11 items-center gap-1 text-sm font-medium text-brand-text"
              >
                View public page
                <ArrowUpRight className="size-4" aria-hidden />
              </Link>
            ) : null}
          </ResponsiveSheetBody>
        </>
      );
    }

    return (
      <>
        <ResponsiveSheetHeader>
          <SheetTitle>{titleText}</SheetTitle>
        </ResponsiveSheetHeader>
        <ResponsiveSheetBody>
          {hidden ? (
            <>
              <Notice>{HIDDEN_BY_MODERATION_NOTICE}</Notice>
              <RadioGroup value="hidden" disabled>
                <RadioGroupItem
                  value="hidden"
                  className="min-h-11 w-full items-start gap-3 rounded-lg border border-border bg-card p-3 text-left"
                >
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="font-medium text-foreground">Hidden</span>
                    <span className="text-sm text-text-secondary">
                      {visibilityLine("draft")}
                    </span>
                  </span>
                </RadioGroupItem>
              </RadioGroup>
            </>
          ) : (
            <>
              {address && program.visibility !== "draft" ? (
                <>
                  <LinkBox
                    label={isPublic ? "Public address" : "Share link"}
                    value={address}
                    copied={copied === "address"}
                    onCopy={() => void copy("address", address)}
                  />
                  {isPublic ? (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="touch"
                        className="justify-start px-2"
                        aria-expanded={qrOpen}
                        onClick={() => setQrToggled(!qrOpen)}
                      >
                        <QrCodeIcon className="size-4" aria-hidden />
                        QR and print link
                      </Button>
                      {qrOpen && permalink ? qrBlock : null}
                    </>
                  ) : (
                    <>
                      <Button
                        type="button"
                        variant="ghost"
                        size="touch"
                        className="justify-start px-2"
                        disabled={pending}
                        onClick={() => setStep({ kind: "replace" })}
                      >
                        <RotateCw className="size-4" aria-hidden />
                        Replace link…
                      </Button>
                      {qrBlock}
                    </>
                  )}
                </>
              ) : null}
              <VisibilityOptions
                current={program.visibility}
                selected={selected}
                disabled={pending}
                onSelect={(next) => {
                  setSelected(next);
                  setError(null);
                }}
              />
              {error ? <Notice tone="danger">{error}</Notice> : null}
              {change ? (
                <div className="flex flex-col gap-2">
                  <Button
                    type="button"
                    variant={change.destructive ? "destructive" : "default"}
                    size="touch"
                    className="w-full"
                    disabled={pending}
                    onClick={() => onPrimary(change)}
                  >
                    {change.target === "unlisted" &&
                    program.visibility === "draft" ? (
                      <Link2 className="size-4" aria-hidden />
                    ) : null}
                    {change.target === "public" ? (
                      <Globe className="size-4" aria-hidden />
                    ) : null}
                    {pending ? change.pendingLabel : change.label}
                  </Button>
                  <p className="m-0 text-sm text-text-secondary">
                    {change.consequence}
                  </p>
                </div>
              ) : program.visibility === "unlisted" ? (
                <p className="m-0 text-sm text-muted-foreground">
                  Change the selection above to make it public or move it back
                  to draft.
                </p>
              ) : null}
            </>
          )}
        </ResponsiveSheetBody>
      </>
    );
  };

  return (
    <>
      <Sheet open={open && !profileSetupOpen} onOpenChange={onOpenChange}>
        <ResponsiveSheetContent className="sm:max-w-lg">
          {renderStep()}
        </ResponsiveSheetContent>
      </Sheet>

      <AuthorProfileSetup
        open={profileSetupOpen}
        onOpenChange={setProfileSetupOpen}
        mode="go-public"
        onSaved={async (savedSlug) => {
          setIdentity((prev) => ({ ...prev, authorSlug: savedSlug }));
          setStep({ kind: "confirm" });
        }}
      />
    </>
  );
}
