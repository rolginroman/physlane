import { redirect } from "@tanstack/react-router";

export const HISTORY_REDIRECT_MAX_AGE_SEC = 86_400;

export function throwHistoryRedirect(options: {
  to: string;
  params?: Record<string, string>;
  search?: Record<string, string>;
}): never {
  throw redirect({
    to: options.to,
    params: options.params,
    search: options.search,
    statusCode: 301,
    headers: {
      "Cache-Control": `public, max-age=${HISTORY_REDIRECT_MAX_AGE_SEC}`,
    },
  });
}

export function throwAuthorProfileHistoryRedirect(currentSlug: string): never {
  throwHistoryRedirect({
    to: "/u/$authorSlug",
    params: { authorSlug: currentSlug },
  });
}

export function throwProgramPathHistoryRedirect(path: string): never {
  const match = /^\/u\/([^/]+)\/([^/]+)(?:\/([^/]+))?$/.exec(path);
  if (!match) {
    throw new Error("Invalid program redirect path");
  }
  const authorSlug = match[1]!;
  const programRef = match[2]!;
  const shareToken = match[3];
  if (shareToken) {
    throwHistoryRedirect({
      to: "/u/$authorSlug/$programRef/$shareToken",
      params: { authorSlug, programRef, shareToken },
    });
  }
  throwHistoryRedirect({
    to: "/u/$authorSlug/$programRef",
    params: { authorSlug, programRef },
  });
}
