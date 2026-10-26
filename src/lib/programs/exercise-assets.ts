export type AssetLike = {
  kind: "video" | "article" | "image";
  url: string;
  title: string;
};

/** Only http(s) links are rendered; anything else (javascript:, data:) is dropped. */
export function safeExternalUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:"
      ? parsed.toString()
      : null;
  } catch {
    return null;
  }
}

export function urlHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "m.youtube.com",
  "youtube-nocookie.com",
  "youtu.be",
]);
const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

export function youtubeVideoId(url: string): string | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  const host = parsed.hostname.replace(/^www\./, "");
  if (!YOUTUBE_HOSTS.has(host)) return null;
  let id: string | null | undefined;
  if (host === "youtu.be") {
    id = parsed.pathname.split("/")[1];
  } else if (parsed.pathname === "/watch") {
    id = parsed.searchParams.get("v");
  } else {
    const [, kind, embedded] = parsed.pathname.split("/");
    id = kind === "embed" || kind === "shorts" ? embedded : null;
  }
  return id && YOUTUBE_ID.test(id) ? id : null;
}

export type SplitAssets<T extends AssetLike> = {
  /** First video that can play inline; the rest stay in references. */
  video: (T & { youtubeId: string }) | null;
  references: T[];
};

export function splitExerciseAssets<T extends AssetLike>(
  assets: readonly T[],
): SplitAssets<T> {
  let video: SplitAssets<T>["video"] = null;
  const references: T[] = [];
  for (const asset of assets) {
    if (!safeExternalUrl(asset.url)) continue;
    const youtubeId: string | null =
      !video && asset.kind === "video" ? youtubeVideoId(asset.url) : null;
    if (youtubeId) {
      video = { ...asset, youtubeId };
    } else {
      references.push(asset);
    }
  }
  return { video, references };
}

export type AssetHint = "video" | "link" | null;

/** What tapping the exercise will show, so the row can say so before the tap. */
export function assetHint(
  assets: readonly AssetLike[],
  refUrl: string | null | undefined,
): AssetHint {
  const usable = assets.filter((asset) => safeExternalUrl(asset.url));
  if (usable.some((asset) => asset.kind === "video")) return "video";
  if (usable.length > 0 || safeExternalUrl(refUrl)) return "link";
  return null;
}
