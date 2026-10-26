import { describe, expect, it } from "vitest";
import {
  assetHint,
  safeExternalUrl,
  splitExerciseAssets,
  youtubeVideoId,
} from "../exercise-assets";

const asset = (
  kind: "video" | "article" | "image",
  url: string,
  title = "t",
) => ({ kind, url, title });

describe("youtubeVideoId", () => {
  it.each([
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "https://m.youtube.com/shorts/dQw4w9WgXcQ",
  ])("reads the id from %s", (url) => {
    expect(youtubeVideoId(url)).toBe("dQw4w9WgXcQ");
  });

  it("rejects other hosts and malformed ids", () => {
    expect(youtubeVideoId("https://vimeo.com/123456789")).toBeNull();
    expect(youtubeVideoId("https://evil.test/watch?v=dQw4w9WgXcQ")).toBeNull();
    expect(youtubeVideoId("https://www.youtube.com/watch?v=short")).toBeNull();
    expect(youtubeVideoId("not a url")).toBeNull();
  });
});

describe("safeExternalUrl", () => {
  it("allows http(s) only", () => {
    expect(safeExternalUrl("https://example.org/a")).toBe(
      "https://example.org/a",
    );
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalUrl("data:text/html,x")).toBeNull();
    expect(safeExternalUrl(null)).toBeNull();
  });
});

describe("splitExerciseAssets", () => {
  it("plays the first inline-capable video and keeps the rest as references", () => {
    const first = asset("video", "https://youtu.be/dQw4w9WgXcQ", "setup");
    const second = asset("video", "https://youtu.be/aaaaaaaaaaa", "mistakes");
    const article = asset("article", "https://example.org/a");
    const { video, references } = splitExerciseAssets([article, first, second]);
    expect(video?.youtubeId).toBe("dQw4w9WgXcQ");
    expect(references).toEqual([article, second]);
  });

  it("keeps a video that cannot play inline as a reference", () => {
    const vimeo = asset("video", "https://vimeo.com/123456789");
    const { video, references } = splitExerciseAssets([vimeo]);
    expect(video).toBeNull();
    expect(references).toEqual([vimeo]);
  });

  it("drops assets with unsafe urls", () => {
    const { video, references } = splitExerciseAssets([
      asset("article", "javascript:alert(1)"),
    ]);
    expect(video).toBeNull();
    expect(references).toEqual([]);
  });
});

describe("assetHint", () => {
  it("prefers video over link, and is null with nothing to show", () => {
    expect(
      assetHint(
        [
          asset("article", "https://example.org/a"),
          asset("video", "https://youtu.be/dQw4w9WgXcQ"),
        ],
        null,
      ),
    ).toBe("video");
    expect(assetHint([asset("article", "https://example.org/a")], null)).toBe(
      "link",
    );
    expect(assetHint([], "https://example.org/ref")).toBe("link");
    expect(assetHint([], null)).toBeNull();
    expect(assetHint([], "javascript:alert(1)")).toBeNull();
  });
});
