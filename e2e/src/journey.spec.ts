import { beforeAll, describe, expect, it } from "vitest";
import { ModernMcpClient, type Tool } from "./modern-client";
import { signUpFreshUser, type TestUser } from "./harness";
import {
  discoverResource,
  FULL_SCOPE,
  mintAccessToken,
  READ_ONLY_SCOPE,
  registerClient,
  type MintedToken,
} from "./oauth";

const EXPECTED_TOOLS = [
  "apply_measured_target",
  "get_history",
  "get_status",
  "log_intake",
  "log_measurement",
  "set_cycle",
];

const isoDay = (daysAgo: number): string =>
  new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10);

/**
 * Numeric leaves under a "kcal" key. bandKcal is exempt: it is the free-tier
 * confidence-band width (schedule of pair count), not the TDEE estimate.
 */
function kcalNumbers(node: unknown, path = "tdeeStatus"): string[] {
  if (Array.isArray(node)) {
    return node.flatMap((v, i) => kcalNumbers(v, `${path}[${i}]`));
  }
  if (node && typeof node === "object") {
    return Object.entries(node).flatMap(([k, v]) =>
      typeof v === "number" && /kcal/i.test(k) && k !== "bandKcal"
        ? [`${path}.${k}=${v}`]
        : kcalNumbers(v, `${path}.${k}`),
    );
  }
  return [];
}

describe("auth + tool journey", () => {
  let user: TestUser;
  let resource: string;
  let full: MintedToken;
  let mcp: ModernMcpClient;
  const day = isoDay(1);

  beforeAll(async () => {
    user = await signUpFreshUser();
    resource = await discoverResource();
    const client = await registerClient();
    full = await mintAccessToken({
      client,
      user,
      scope: FULL_SCOPE,
      resource,
    });
    mcp = new ModernMcpClient(full.accessToken);
  });

  it("(i) token is minted with full scope", () => {
    const scopes = full.scope.split(/\s+/);
    expect(scopes).toContain("mcp:read");
    expect(scopes).toContain("mcp:write");
  });

  it("(ii) handshake + tools/list: exactly 6 tools, annotations", async () => {
    await mcp.initialize();
    const tools = await mcp.listTools();
    expect(tools.map((t) => t.name).sort()).toEqual(EXPECTED_TOOLS);
    const byName = new Map<string, Tool>(tools.map((t) => [t.name, t]));
    expect(byName.get("get_status")?.annotations?.readOnlyHint).toBe(true);
    expect(byName.get("get_history")?.annotations?.readOnlyHint).toBe(true);
    expect(byName.get("set_cycle")?.annotations?.destructiveHint).toBe(true);
  });

  it("(iii) log_intake echoes structuredContent.date", async () => {
    const out = await mcp.callOk("log_intake", { date: day, kcal: 2100 });
    expect(out.date).toBe(day);
  });

  it("(iv) get_history read-back proves persistence", async () => {
    const out = await mcp.callOk("get_history", {
      kind: "intake",
      from: day,
      to: day,
    });
    const items = out.items as Array<{ date: string; kcal: number }>;
    expect(items).toEqual([expect.objectContaining({ date: day, kcal: 2100 })]);
  });

  it("(v) idempotent: same date twice -> one row, latest value", async () => {
    await mcp.callOk("log_intake", { date: day, kcal: 2300 });
    const out = await mcp.callOk("get_history", {
      kind: "intake",
      from: day,
      to: day,
    });
    const items = out.items as Array<{ date: string; kcal: number }>;
    expect(items).toHaveLength(1);
    expect(items[0]?.kcal).toBe(2300);
  });

  it("(vi) read-only token: write tool -> 403 insufficient_scope", async () => {
    const client = await registerClient();
    const readOnly = await mintAccessToken({
      client,
      user,
      scope: READ_ONLY_SCOPE,
      resource,
    });
    const ro = new ModernMcpClient(readOnly.accessToken);
    const out = await ro.callTool("log_intake", { date: day, kcal: 2100 });
    expect(out.kind).toBe("insufficient_scope");
    if (out.kind === "insufficient_scope") {
      expect(out.wwwAuthenticate).toContain("mcp:write");
    }
    // reads still work with the narrow token
    const status = await ro.callTool("get_status");
    expect(status.kind).toBe("ok");
  });

  it("(vii) free plan: tdeeStatus ready + gated, no kcal numbers", async () => {
    // 21 consecutive complete (kcal + weight) days make TDEE "ready".
    for (let i = 1; i <= 21; i++) {
      const date = isoDay(i);
      await mcp.callOk("log_intake", { date, kcal: 2200 });
      await mcp.callOk("log_measurement", {
        unit: "metric",
        weight: 80 - (21 - i) * 0.05,
        takenAt: `${date}T08:00:00Z`,
      });
    }
    const status = await mcp.callOk("get_status");
    expect(status.plan).toBe("free");
    const tdee = status.tdeeStatus as { status: string; gated: boolean };
    expect(tdee.status).toBe("ready");
    expect(tdee.gated).toBe(true);
    expect(kcalNumbers(tdee)).toEqual([]);
  });
});
