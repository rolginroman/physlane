import { describe, expect, it } from "vitest";
import { newShareToken, publicFirstName, shareUrl } from "./share";

describe("newShareToken", () => {
  it("is 32 hex chars, no dashes", () => {
    const token = newShareToken();
    expect(token).toMatch(/^[0-9a-f]{32}$/);
    expect(token).not.toContain("-");
  });

  it("is unguessable across calls", () => {
    const tokens = new Set(Array.from({ length: 100 }, () => newShareToken()));
    expect(tokens.size).toBe(100);
  });
});

describe("shareUrl", () => {
  it("joins origin and token, trimming a trailing slash", () => {
    expect(shareUrl("https://physlane.unpackit.top", "abc123")).toBe(
      "https://physlane.unpackit.top/share/abc123",
    );
    expect(shareUrl("http://localhost:3000/", "abc123")).toBe(
      "http://localhost:3000/share/abc123",
    );
  });
});

describe("publicFirstName", () => {
  it("keeps only the first name", () => {
    expect(publicFirstName("Roman Heinrich")).toBe("Roman");
    expect(publicFirstName("Anna")).toBe("Anna");
  });

  it("trims and returns null for empty/whitespace names", () => {
    expect(publicFirstName("  Anna  ")).toBe("Anna");
    expect(publicFirstName("")).toBeNull();
    expect(publicFirstName("   ")).toBeNull();
    expect(publicFirstName(null)).toBeNull();
    expect(publicFirstName(undefined)).toBeNull();
  });
});
