import { describe, expect, it } from "vitest";
import { oauthScopeLabel, oauthScopeLabels } from "../-oauth-scope-labels";

describe("oauthScopeLabel", () => {
  it("maps known MCP and OIDC scopes", () => {
    expect(oauthScopeLabel("openid")).toBe(
      "Verify your identity (OpenID Connect)",
    );
    expect(oauthScopeLabel("mcp:read")).toBe("Read your physlane data");
    expect(oauthScopeLabel("mcp:write")).toBe(
      "Write: log meals, measurements, cycles",
    );
  });

  it("falls back to the raw scope for unknown values", () => {
    expect(oauthScopeLabel("custom:thing")).toBe("custom:thing");
  });
});

describe("oauthScopeLabels", () => {
  it("dedupes while preserving order", () => {
    expect(
      oauthScopeLabels([
        "openid",
        "profile",
        "openid",
        "mcp:read",
        "mcp:write",
      ]),
    ).toEqual([
      "Verify your identity (OpenID Connect)",
      "Your name and profile information",
      "Read your physlane data",
      "Write: log meals, measurements, cycles",
    ]);
  });
});
