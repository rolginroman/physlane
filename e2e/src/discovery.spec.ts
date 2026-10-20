import { describe, expect, it } from "vitest";
import { BASE_URL } from "./env";
import { fetchJson } from "./harness";
import { REDIRECT_URI } from "./oauth";

describe("discovery", () => {
  let resourceMetadataUrl = "";
  let registrationEndpoint = "";

  it("(a) unauthenticated POST /mcp -> 401 + WWW-Authenticate", async () => {
    const res = await fetchJson(`${BASE_URL}/mcp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      }),
    });
    expect(res.status).toBe(401);
    const www = res.headers.get("www-authenticate");
    expect(www).toBeTruthy();
    // (f) the challenge points at the resource metadata
    const m = /resource_metadata="([^"]+)"/i.exec(www ?? "");
    expect(m).not.toBeNull();
    resourceMetadataUrl = m?.[1] ?? "";
  });

  it("(f) resource_metadata URL from the challenge resolves", async () => {
    // Dev server advertises loopback :3000 in the challenge; follow the path on
    // the server under test.
    const res = await fetchJson<{ resource?: string }>(
      `${BASE_URL}${new URL(resourceMetadataUrl).pathname}`,
    );
    expect(res.status).toBe(200);
    expect(res.json.resource).toBeTypeOf("string");
  });

  it("(b) protected-resource metadata names resource + this AS", async () => {
    const res = await fetchJson<{
      resource?: string;
      authorization_servers?: string[];
    }>(`${BASE_URL}/.well-known/oauth-protected-resource`);
    expect(res.status).toBe(200);
    expect(res.json.resource).toBeTypeOf("string");
    expect(new URL(res.json.authorization_servers?.[0] ?? "").origin).toBe(
      new URL(BASE_URL).origin,
    );
  });

  it("(c) authorization-server metadata", async () => {
    const res = await fetchJson<{
      issuer?: string;
      response_types_supported?: string[];
      registration_endpoint?: string;
    }>(`${BASE_URL}/.well-known/oauth-authorization-server`);
    expect(res.status).toBe(200);
    expect(res.json.issuer).toBeTypeOf("string");
    expect(res.json.response_types_supported).toBeInstanceOf(Array);
    expect(res.json.registration_endpoint).toBeTypeOf("string");
    registrationEndpoint = res.json.registration_endpoint ?? "";
  });

  it("(d) dynamic client registration returns client_id", async () => {
    const res = await fetchJson<{ client_id?: string }>(registrationEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        client_name: "physlane-e2e-discovery",
        redirect_uris: [REDIRECT_URI],
      }),
    });
    expect([200, 201]).toContain(res.status);
    expect(res.json.client_id).toBeTypeOf("string");
  });

  it("(e) jwks exposes keys", async () => {
    const res = await fetchJson<{ keys?: unknown[] }>(
      `${BASE_URL}/api/auth/jwks`,
    );
    expect(res.status).toBe(200);
    expect(res.json.keys?.length).toBeGreaterThan(0);
  });
});
