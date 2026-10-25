import { describe, expect, it, vi } from "vitest";
import { throwProgramPathHistoryRedirect } from "../history-redirect";

vi.mock("@tanstack/react-router", () => ({
  redirect: (options: unknown) => {
    throw Object.assign(new Error("REDIRECT"), { redirect: options });
  },
}));

describe("throwProgramPathHistoryRedirect", () => {
  it("redirects slug history to the public slug route", () => {
    try {
      throwProgramPathHistoryRedirect("/u/tara/old-slug");
    } catch (e) {
      expect(e).toMatchObject({
        redirect: {
          to: "/u/$authorSlug/$programRef",
          params: { authorSlug: "tara", programRef: "old-slug" },
          statusCode: 301,
        },
      });
    }
  });

  it("redirects slug history with token to the share-token route", () => {
    try {
      throwProgramPathHistoryRedirect("/u/tara/old-slug/share-tok");
    } catch (e) {
      expect(e).toMatchObject({
        redirect: {
          to: "/u/$authorSlug/$programRef/$shareToken",
          params: {
            authorSlug: "tara",
            programRef: "old-slug",
            shareToken: "share-tok",
          },
          statusCode: 301,
        },
      });
    }
  });
});
