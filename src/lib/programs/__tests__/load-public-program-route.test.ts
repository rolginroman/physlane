import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicProgramDTO } from "#/server/programs.fns";

const serverMocks = vi.hoisted(() => ({
  getPublicProgramBySlug: vi.fn(),
  getPublicProgramByToken: vi.fn(),
  getPublicProgramById: vi.fn(),
  resolvePublicProgramRedirect: vi.fn(),
  resolveProgramIdForPublicPath: vi.fn(),
  getPublicProgramRemoval: vi.fn(),
}));

vi.mock("#/server/programs.fns", () => serverMocks);

vi.mock("@tanstack/react-router", () => ({
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
  redirect: (options: unknown) => {
    throw Object.assign(new Error("REDIRECT"), { redirect: options });
  },
}));

import {
  loadPermalinkProgramRoute,
  loadPublicSlugProgramRoute,
  loadShareTokenProgramRoute,
} from "../load-public-program-route";

function program(overrides: Partial<PublicProgramDTO> = {}): PublicProgramDTO {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Test",
    visibility: "public",
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
    ...overrides,
  } as PublicProgramDTO;
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe("loadPublicSlugProgramRoute", () => {
  it("returns 404 for uuid-shaped refs (permalink owns ids)", async () => {
    await expect(
      loadPublicSlugProgramRoute({
        authorSlug: "tara",
        programSlug: "11111111-1111-4111-8111-111111111111",
      }),
    ).rejects.toThrow("NOT_FOUND");
  });

  it("returns public program data on slug hit", async () => {
    const dto = program();
    serverMocks.getPublicProgramBySlug.mockResolvedValue(dto);
    const result = await loadPublicSlugProgramRoute({
      authorSlug: "tara",
      programSlug: "hypertrophy",
    });
    expect(result).toMatchObject({ kind: "program", variant: "public" });
  });

  it("301 via slug history redirect target", async () => {
    serverMocks.getPublicProgramBySlug.mockRejectedValue(
      new Error("PROGRAM_NOT_FOUND"),
    );
    serverMocks.resolvePublicProgramRedirect.mockResolvedValue({
      kind: "redirect",
      path: "/u/tara/hypertrophy",
      search: {},
    });
    await expect(
      loadPublicSlugProgramRoute({
        authorSlug: "old",
        programSlug: "old-slug",
      }),
    ).rejects.toMatchObject({
      redirect: {
        to: "/u/$authorSlug/$programRef",
        params: { authorSlug: "tara", programRef: "hypertrophy" },
        statusCode: 301,
      },
    });
  });
});

describe("loadShareTokenProgramRoute", () => {
  it("301 to bare canonical when program is public", async () => {
    serverMocks.getPublicProgramByToken.mockResolvedValue(program());
    await expect(
      loadShareTokenProgramRoute({
        authorSlug: "tara",
        programSlug: "hypertrophy",
        shareToken: "tok",
      }),
    ).rejects.toMatchObject({
      redirect: {
        to: "/u/$authorSlug/$programRef",
        params: { authorSlug: "tara", programRef: "hypertrophy" },
      },
    });
  });

  it("301 to current slug+token when path prefix is stale", async () => {
    serverMocks.getPublicProgramByToken.mockResolvedValue(
      program({ visibility: "unlisted", shareToken: "tok" }),
    );
    await expect(
      loadShareTokenProgramRoute({
        authorSlug: "old",
        programSlug: "old-slug",
        shareToken: "tok",
      }),
    ).rejects.toMatchObject({
      redirect: {
        to: "/u/$authorSlug/$programRef/$shareToken",
        params: {
          authorSlug: "tara",
          programRef: "hypertrophy",
          shareToken: "tok",
        },
      },
    });
  });

  it("returns unlisted program when token and path match", async () => {
    serverMocks.getPublicProgramByToken.mockResolvedValue(
      program({ visibility: "unlisted", shareToken: "tok" }),
    );
    const result = await loadShareTokenProgramRoute({
      authorSlug: "tara",
      programSlug: "hypertrophy",
      shareToken: "tok",
    });
    expect(result).toMatchObject({ kind: "program", variant: "unlisted" });
  });
});

describe("loadPermalinkProgramRoute", () => {
  it("returns public program for id permalink", async () => {
    const dto = program();
    serverMocks.getPublicProgramById.mockResolvedValue(dto);
    const result = await loadPermalinkProgramRoute({
      programId: dto.id,
    });
    expect(result).toMatchObject({ kind: "program", variant: "public" });
  });

  it("404 when permalink program is not public-only visible", async () => {
    serverMocks.getPublicProgramById.mockRejectedValue(
      new Error("PROGRAM_NOT_FOUND"),
    );
    await expect(
      loadPermalinkProgramRoute({
        programId: "11111111-1111-4111-8111-111111111111",
      }),
    ).rejects.toThrow("NOT_FOUND");
  });
});
