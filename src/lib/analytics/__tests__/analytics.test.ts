import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sanitizeAnalyticsPath } from "#/lib/analytics/events";

describe("sanitizeAnalyticsPath", () => {
  it("strips query and hash, collapses share and blog segments", () => {
    expect(sanitizeAnalyticsPath("/share/abc123?q=1")).toBe("/share/$token");
    expect(sanitizeAnalyticsPath("/blog/my-post")).toBe("/blog/$slug");
    expect(sanitizeAnalyticsPath("/dashboard?x=2#frag")).toBe("/dashboard");
    expect(sanitizeAnalyticsPath("/")).toBe("/");
  });
});

describe("captureEvent", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("does not fetch when POSTHOG_KEY is unset", async () => {
    vi.doMock("cloudflare:workers", () => ({
      env: { POSTHOG_KEY: "", POSTHOG_HOST: "" },
    }));
    const { captureEvent } = await import("#/lib/analytics/server");
    captureEvent({ name: "intake_logged" }, "u1");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs capture payload when key is set", async () => {
    fetchMock.mockResolvedValue({ ok: true });
    vi.doMock("cloudflare:workers", () => ({
      env: {
        POSTHOG_KEY: "phc_test",
        POSTHOG_HOST: "https://us.i.posthog.com",
      },
    }));
    const { captureEvent } = await import("#/lib/analytics/server");
    captureEvent({ name: "intake_logged" }, "u1");
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/capture/");
    expect(init.method).toBe("POST");
    const parsed = JSON.parse(String(init.body)) as {
      api_key: string;
      event: string;
      distinct_id: string;
      properties: { uid: string };
    };
    expect(parsed.api_key).toBe("phc_test");
    expect(parsed.event).toBe("intake_logged");
    expect(parsed.distinct_id).toBe("u1");
    expect(parsed.properties.uid).toBe("u1");
  });
});

describe("client analytics before init", () => {
  it("pageview and clientEvent do not throw without window/SDK", async () => {
    const { pageview, clientEvent, setUserUid } =
      await import("#/lib/analytics/client");
    expect(() => pageview("/dashboard")).not.toThrow();
    expect(() => clientEvent({ name: "signup_completed" })).not.toThrow();
    expect(() => setUserUid("u1")).not.toThrow();
  });
});
