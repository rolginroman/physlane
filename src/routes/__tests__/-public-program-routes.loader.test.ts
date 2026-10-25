import { beforeEach, describe, expect, it, vi } from "vitest";

const serverMocks = vi.hoisted(() => ({
  getPublicProgramBySlug: vi.fn(),
  getPublicProgramByToken: vi.fn(),
  getPublicProgramById: vi.fn(),
  resolvePublicProgramRedirect: vi.fn(),
  resolveProgramIdForPublicPath: vi.fn(),
  getPublicProgramRemoval: vi.fn(),
  getAuthorProgramSuggestions: vi.fn(),
}));

vi.mock("#/server/programs.fns", () => serverMocks);

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    notFound: () => {
      throw new Error("NOT_FOUND");
    },
    redirect: (options: unknown) => {
      throw Object.assign(new Error("REDIRECT"), { redirect: options });
    },
    createFileRoute: actual.createFileRoute,
  };
});

import { Route as permalinkRoute } from "#/routes/u.$authorSlug.p.$programId";
import { Route as slugRoute } from "#/routes/u.$authorSlug.$programRef";
import { Route as tokenRoute } from "#/routes/u.$authorSlug.$programRef.$shareToken";

const publicProgram = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Test",
  visibility: "public" as const,
  slug: "hypertrophy",
  shareToken: null,
  author: {
    authorSlug: "tara",
    authorDisplayName: "Tara",
    hasPublicProfile: true,
  },
  sessions: [],
  exercises: {},
  forkable: true,
  goal: "hypertrophy",
  level: "intermediate",
  daysPerWeek: 4,
  weeks: 8,
  description: null,
  forkSourceLabel: null,
  revision: 1,
  userId: "u1",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  vi.resetAllMocks();
});

type LoaderCtx = {
  params: Record<string, string>;
  deps: { copy?: boolean };
  location: { pathname: string; searchStr: string };
};

async function runRouteLoader(
  loaderSpec: unknown,
  ctx: LoaderCtx,
): Promise<{ route: { kind: string; variant?: string } }> {
  if (typeof loaderSpec === "function") {
    return loaderSpec(ctx as never);
  }
  if (
    loaderSpec &&
    typeof loaderSpec === "object" &&
    "loader" in loaderSpec &&
    typeof loaderSpec.loader === "function"
  ) {
    return loaderSpec.loader(ctx as never);
  }
  throw new Error("missing route loader");
}

describe("public program route loaders", () => {
  it("slug route loader returns 200 payload", async () => {
    serverMocks.getPublicProgramBySlug.mockResolvedValue(publicProgram);
    const data = await runRouteLoader(slugRoute.options.loader, {
      params: { authorSlug: "tara", programRef: "hypertrophy" },
      deps: { copy: undefined },
      location: { pathname: "/u/tara/hypertrophy", searchStr: "" },
    });
    expect(data.route).toMatchObject({ kind: "program", variant: "public" });
  });

  it("slug route loader skips resolution when a share-token segment is present", async () => {
    const data = await runRouteLoader(slugRoute.options.loader, {
      params: {
        authorSlug: "tara",
        programRef: "hypertrophy",
        shareToken: "tok",
      },
      deps: { copy: undefined },
      location: { pathname: "/u/tara/hypertrophy/tok", searchStr: "" },
    });
    expect(data.route).toBeNull();
    expect(serverMocks.getPublicProgramBySlug).not.toHaveBeenCalled();
  });

  it("token route loader 301 when public", async () => {
    serverMocks.getPublicProgramByToken.mockResolvedValue(publicProgram);
    await expect(
      runRouteLoader(tokenRoute.options.loader, {
        params: {
          authorSlug: "tara",
          programRef: "hypertrophy",
          shareToken: "tok",
        },
        deps: { copy: undefined },
        location: {
          pathname: "/u/tara/hypertrophy/tok",
          searchStr: "",
        },
      }),
    ).rejects.toMatchObject({
      redirect: { to: "/u/$authorSlug/$programRef" },
    });
  });

  it("permalink route loader returns 200 without redirect", async () => {
    serverMocks.getPublicProgramById.mockResolvedValue(publicProgram);
    const data = await runRouteLoader(permalinkRoute.options.loader, {
      params: {
        authorSlug: "stale",
        programId: publicProgram.id,
      },
      deps: { copy: undefined },
      location: {
        pathname: `/u/stale/p/${publicProgram.id}`,
        searchStr: "",
      },
    });
    expect(data.route).toMatchObject({ kind: "program", variant: "public" });
  });
});
