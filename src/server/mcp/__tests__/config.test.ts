import { describe, expect, it, vi } from "vitest";

vi.mock("cloudflare:workers", () => ({
  env: { APP_URL: "https://physlane.unpackit.top" },
}));

const { mcpResourceFromAppUrl } = await import("#/server/mcp/config");

describe("mcpResourceFromAppUrl", () => {
  it("appends /mcp without double slashes", () => {
    expect(mcpResourceFromAppUrl("https://physlane.unpackit.top")).toBe(
      "https://physlane.unpackit.top/mcp",
    );
  });

  it("strips a trailing slash on the base URL", () => {
    expect(mcpResourceFromAppUrl("http://localhost:3000/")).toBe(
      "http://localhost:3000/mcp",
    );
  });
});
