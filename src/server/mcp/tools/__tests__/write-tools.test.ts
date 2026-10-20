import { Client } from "@modelcontextprotocol/client";
import {
  InMemoryTransport,
  McpServer,
  type AuthInfo,
} from "@modelcontextprotocol/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const MCP_READ = "mcp:read";
const MCP_WRITE = "mcp:write";
import { register as registerCycles } from "#/server/mcp/tools/cycles";
import { register as registerIntake } from "#/server/mcp/tools/intake";
import { register as registerMeasurements } from "#/server/mcp/tools/measurements";
import { PRO_UPGRADE_COPY } from "#/server/mcp/tools/tool-helpers";
import type { SessionUser } from "#/server/auth.core";

const mockUser: SessionUser = {
  id: "user-test-1",
  name: "Test",
  email: "t@test.local",
  unitSystem: "metric",
  plan: "free",
  onGlp1: false,
  heightCm: null,
  sex: null,
  telegramId: null,
  reminderTime: null,
  reminderTz: null,
  shareToken: null,
  targetPromptLastAppliedAt: null,
  targetPromptLastDismissedAt: null,
  targetPromptAppliedKcal: null,
};

vi.mock("#/server/auth.core", () => ({
  loadUserById: vi.fn(async (id: string) =>
    id === mockUser.id ? mockUser : null,
  ),
}));

vi.mock("#/server/intake.core", () => ({
  upsertIntakeForUser: vi.fn(async (_user, input) => ({
    date: input.date,
    kcal: input.kcal,
    proteinG: input.proteinG ?? null,
  })),
}));

vi.mock("#/server/measurements.core", () => ({
  saveMeasurementForUser: vi.fn(async (_user, input) => ({
    id: "m1",
    takenAt: input.takenAt,
    weightKg: input.weightKg ?? null,
    neckCm: null,
    chestCm: null,
    waistCm: input.waistCm ?? null,
    hipsCm: null,
    armLeftCm: null,
    armRightCm: null,
    thighLeftCm: null,
    thighRightCm: null,
    calfCm: null,
    notes: null,
  })),
}));

vi.mock("#/server/cycles.core", () => ({
  saveCycleForUser: vi.fn(async () => ({
    id: "c1",
    phase: "cut",
    startDate: new Date().toISOString(),
    endDate: null,
    startWeightKg: null,
    targetRateKgPerWeek: null,
    kcalTargetPerDay: null,
    notes: null,
  })),
}));

vi.mock("#/server/target-prompt.core", () => ({
  applyMeasuredTargetForUser: vi.fn(async (user: SessionUser) => {
    if (user.plan !== "pro") throw new Error("PRO_REQUIRED");
    return { ok: true, kcalTargetPerDay: 2200 };
  }),
}));

function makeAuthInfo(scopes: string[], token?: string): AuthInfo {
  const payload = Buffer.from(
    JSON.stringify({ sub: mockUser.id }),
    "utf8",
  ).toString("base64url");
  return {
    token: token ?? `hdr.${payload}.sig`,
    clientId: "test-client",
    scopes,
    expiresAt: Math.floor(Date.now() / 1000) + 3600,
    extra: { sub: mockUser.id },
  };
}

function buildWriteToolsServer(): McpServer {
  const server = new McpServer(
    { name: "physlane-write-test", version: "0.0.0" },
    { capabilities: { tools: {} } },
  );
  registerIntake(server);
  registerMeasurements(server);
  registerCycles(server);
  return server;
}

async function withMcpClient<T>(
  scopes: string[],
  fn: (client: Client) => Promise<T>,
): Promise<T> {
  const authInfo = makeAuthInfo(scopes);
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const origSend = clientTransport.send.bind(clientTransport);
  clientTransport.send = async (message, options) =>
    origSend(message, { ...options, authInfo: options?.authInfo ?? authInfo });

  const server = buildWriteToolsServer();
  await server.connect(serverTransport);

  const client = new Client({ name: "test", version: "0" });
  await client.connect(clientTransport);

  try {
    return await fn(client);
  } finally {
    await client.close();
    await server.close();
  }
}

describe("MCP write tools", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUser.plan = "free";
  });

  afterEach(() => {
    mockUser.plan = "free";
  });

  it("tools/list includes four write tools with set_cycle destructiveHint", async () => {
    await withMcpClient([MCP_READ, MCP_WRITE], async (client) => {
      const { tools } = await client.listTools();
      const names = tools.map((t) => t.name).sort();
      expect(names).toEqual([
        "apply_measured_target",
        "log_intake",
        "log_measurement",
        "set_cycle",
      ]);
      const setCycle = tools.find((t) => t.name === "set_cycle");
      expect(setCycle?.annotations?.destructiveHint).toBe(true);
      for (const t of tools) {
        expect(t.annotations?.openWorldHint).toBe(false);
      }
    });
  });

  it("log_intake rejects kcal above max with bounds message", async () => {
    await withMcpClient([MCP_WRITE], async (client) => {
      const result = await client.callTool({
        name: "log_intake",
        arguments: { date: "2026-01-15", kcal: 20001 },
      });
      expect(result.isError).toBe(true);
      const text =
        result.content[0]?.type === "text" ? result.content[0].text : "";
      expect(text.toLowerCase()).toMatch(/20000|kcal|bounds|maximum|invalid/i);
    });
  });

  it("log_intake double-call same date hits core twice with same canonical input", async () => {
    const { upsertIntakeForUser } = await import("#/server/intake.core");
    await withMcpClient([MCP_WRITE], async (client) => {
      const args = { date: "2026-02-01", kcal: 2100, proteinG: 140 };
      await client.callTool({ name: "log_intake", arguments: args });
      await client.callTool({ name: "log_intake", arguments: args });
      expect(upsertIntakeForUser).toHaveBeenCalledTimes(2);
      expect(upsertIntakeForUser).toHaveBeenNthCalledWith(1, mockUser, {
        date: "2026-02-01",
        kcal: 2100,
        proteinG: 140,
      });
      expect(upsertIntakeForUser).toHaveBeenNthCalledWith(2, mockUser, {
        date: "2026-02-01",
        kcal: 2100,
        proteinG: 140,
      });
    });
  });

  it("log_measurement missing unit is an error", async () => {
    await withMcpClient([MCP_WRITE], async (client) => {
      const result = await client.callTool({
        name: "log_measurement",
        arguments: { weight: 80 },
      });
      expect(result.isError).toBe(true);
    });
  });

  it("log_measurement accepts takenAt with timezone offset", async () => {
    const { saveMeasurementForUser } =
      await import("#/server/measurements.core");
    await withMcpClient([MCP_WRITE], async (client) => {
      await client.callTool({
        name: "log_measurement",
        arguments: {
          unit: "metric",
          weight: 80,
          takenAt: "2026-06-15T14:30:00+02:00",
        },
      });
      expect(saveMeasurementForUser).toHaveBeenCalledTimes(1);
      expect(saveMeasurementForUser).toHaveBeenCalledWith(
        mockUser,
        expect.objectContaining({ takenAt: "2026-06-15T14:30:00+02:00" }),
      );
    });
  });

  it("log_measurement imperial weight converts to kg before core", async () => {
    const { saveMeasurementForUser } =
      await import("#/server/measurements.core");
    await withMcpClient([MCP_WRITE], async (client) => {
      await client.callTool({
        name: "log_measurement",
        arguments: { unit: "imperial", weight: 180, waist: 33 },
      });
      expect(saveMeasurementForUser).toHaveBeenCalledTimes(1);
      const input = vi.mocked(saveMeasurementForUser).mock.calls[0]?.[1];
      expect(input?.weightKg).toBeCloseTo(81.6466, 2);
      expect(input?.waistCm).toBeCloseTo(83.82, 2);
    });
  });

  it("set_cycle calls saveCycleForUser once with mapped fields", async () => {
    const { saveCycleForUser } = await import("#/server/cycles.core");
    await withMcpClient([MCP_WRITE], async (client) => {
      await client.callTool({
        name: "set_cycle",
        arguments: {
          phase: "cut",
          startDate: "2026-03-01",
          targetRateKgPerWeek: -0.5,
          kcalTargetPerDay: 1900,
          notes: "spring cut",
        },
      });
      expect(saveCycleForUser).toHaveBeenCalledTimes(1);
      expect(saveCycleForUser).toHaveBeenCalledWith(mockUser, {
        phase: "cut",
        startDate: "2026-03-01",
        targetRateKgPerWeek: -0.5,
        kcalTargetPerDay: 1900,
        notes: "spring cut",
      });
    });
  });

  it("apply_measured_target on free plan returns Pro upgrade copy", async () => {
    await withMcpClient([MCP_WRITE], async (client) => {
      const result = await client.callTool({
        name: "apply_measured_target",
        arguments: {},
      });
      expect(result.isError).toBe(true);
      const text =
        result.content[0]?.type === "text" ? result.content[0].text : "";
      expect(text).toContain("Unlock with Pro");
      expect(text).toContain("$10/mo or $100/yr");
      expect(text).toContain(PRO_UPGRADE_COPY.slice(0, 40));
    });
  });

  it("resolves user from verified claims when access token is empty", async () => {
    const authInfo = makeAuthInfo([MCP_WRITE], "");
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const origSend = clientTransport.send.bind(clientTransport);
    clientTransport.send = async (message, options) =>
      origSend(message, {
        ...options,
        authInfo: options?.authInfo ?? authInfo,
      });

    const server = buildWriteToolsServer();
    await server.connect(serverTransport);
    const client = new Client({ name: "test", version: "0" });
    await client.connect(clientTransport);
    try {
      const result = await client.callTool({
        name: "log_intake",
        arguments: { date: "2026-04-01", kcal: 1800 },
      });
      expect(result.isError).not.toBe(true);
    } finally {
      await client.close();
      await server.close();
    }
  });

  it("write tool without mcp:write scope returns insufficient_scope", async () => {
    await withMcpClient([MCP_READ], async (client) => {
      const result = await client.callTool({
        name: "log_intake",
        arguments: { date: "2026-01-01", kcal: 2000 },
      });
      expect(result.isError).toBe(true);
      const text =
        result.content[0]?.type === "text" ? result.content[0].text : "";
      expect(text).toContain("insufficient_scope");
      expect(text).toContain(MCP_WRITE);
    });
  });
});
