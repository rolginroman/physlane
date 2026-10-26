export type ShareVisibility = "draft" | "unlisted" | "public";

export const SHARE_QUESTION = "Who can open this program?";

export const HIDDEN_BY_MODERATION_NOTICE =
  "physlane moderation hid this program. Only you can see it, and its visibility can't be changed.";

const VISIBILITY_LINES: Record<ShareVisibility, string> = {
  draft: "Only you.",
  unlisted: "Anyone with the link. Not on your profile, not in search.",
  public: "On your profile. Search engines can find it.",
};

export const SHARE_VISIBILITIES: readonly ShareVisibility[] = [
  "draft",
  "unlisted",
  "public",
];

export function visibilityLine(visibility: ShareVisibility): string {
  return VISIBILITY_LINES[visibility];
}

/** A draft preselects Unlisted so the first action is "Create share link". */
export function defaultShareSelection(
  current: ShareVisibility,
): ShareVisibility {
  return current === "draft" ? "unlisted" : current;
}

export type ShareConfirm = {
  title: string;
  bullets: string[];
  confirmLabel: string;
  cancelLabel: string;
  destructive: boolean;
};

export type ShareChange = {
  target: ShareVisibility;
  label: string;
  pendingLabel: string;
  consequence: string;
  destructive: boolean;
  /** Author has no published profile: collect it before the confirm step. */
  needsProfile: boolean;
  confirm: ShareConfirm | null;
};

type PlanInput = {
  current: ShareVisibility;
  selected: ShareVisibility;
  title: string;
  profilePublished: boolean;
  hasShareLink: boolean;
  /** Host-relative profile address, e.g. "physlane.app/u/tara". */
  profileLabel: string | null;
};

function publicBullets(input: PlanInput): string[] {
  const listed = input.profileLabel
    ? `Listed on your profile at ${input.profileLabel}.`
    : "Listed on your profile.";
  const bullets = [listed, "Search engines can index it."];
  if (input.hasShareLink) {
    bullets.push("Your share link keeps working and opens the public page.");
  }
  return bullets;
}

/** Null when the selection is the current state: nothing to do. */
export function planShareChange(input: PlanInput): ShareChange | null {
  const { current, selected } = input;
  if (current === selected) return null;

  if (selected === "unlisted" && current === "draft") {
    return {
      target: "unlisted",
      label: "Create share link",
      pendingLabel: "Creating link…",
      consequence:
        "Anyone with the link can open and copy this program. You can replace the link or turn it off later.",
      destructive: false,
      needsProfile: false,
      confirm: null,
    };
  }

  if (selected === "public") {
    const bullets = publicBullets(input);
    return {
      target: "public",
      label: "Go public",
      pendingLabel: "Going public…",
      consequence: bullets.join(" "),
      destructive: false,
      needsProfile: !input.profilePublished,
      confirm: input.profilePublished
        ? null
        : {
            title: `Make “${input.title}” public?`,
            bullets,
            confirmLabel: "Go public",
            cancelLabel: "Back",
            destructive: false,
          },
    };
  }

  if (selected === "draft") {
    const fromPublic = current === "public";
    return {
      target: "draft",
      label: "Move to draft…",
      pendingLabel: "Moving to draft…",
      consequence: fromPublic
        ? "Takes it off your profile and turns off every link to it. You confirm on the next step."
        : "The share link stops working. If you share again later, you get a different link.",
      destructive: true,
      needsProfile: false,
      confirm: {
        title: "Move to draft?",
        bullets: fromPublic
          ? [
              "Removed from your profile and from search.",
              "The public address, the QR and print link, and any share links stop working.",
              "The address is kept for you: going public again reuses it.",
            ]
          : [
              "The share link stops working.",
              "If you share again later, you get a different link.",
            ],
        confirmLabel: "Move to draft",
        cancelLabel: "Cancel",
        destructive: true,
      },
    };
  }

  return {
    target: "unlisted",
    label: "Make unlisted…",
    pendingLabel: "Making unlisted…",
    consequence:
      "Takes it off your profile and out of search. The public address stops working. You confirm on the next step.",
    destructive: true,
    needsProfile: false,
    confirm: {
      title: "Make unlisted?",
      bullets: [
        "Removed from your profile and from search.",
        "The public address and the QR and print link stop working.",
        "You get a new share link. Older share links stop working.",
      ],
      confirmLabel: "Make unlisted",
      cancelLabel: "Cancel",
      destructive: true,
    },
  };
}

/** The "what changed" list shown right after a program goes public. */
export function publicChangeSummary(input: {
  profileLabel: string | null;
  firstPublic: boolean;
  hadShareLink: boolean;
}): string[] {
  const lines = ["Public. Listed on your profile."];
  if (input.firstPublic && input.profileLabel) {
    lines.push(`Your profile page is live at ${input.profileLabel}.`);
  }
  if (input.hadShareLink) {
    lines.push("Old share links open this public page.");
  }
  return lines;
}
