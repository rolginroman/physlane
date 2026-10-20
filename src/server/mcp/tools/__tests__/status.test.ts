import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport, McpServer } from "@modelcontextprotocol/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { computeTdee } from "#/lib/tdee";
import type { SessionUser } from "#/server/auth.core";
import type { IntakeContext } from "#/server/intake.types";
import { assembleTdeeStatusPayload } from "#/server/intake.tdee-assembly";
import {
  GET_STATUS_DESCRIPTION,
  register as registerStatus,
} from "#/server/mcp/tools/status";

vi.mock("#/server/auth.core", () => ({
  loadUserById: vi.fn(),
}));

vi.mock("#/server/intake.core", () => ({
  buildTdeeStatusForUser: vi.fn(),
  intakeStreakForUser: vi.fn(),
  loadActiveCycle: vi.fn(),
}));

vi.mock("#/server/measurements.core", () => ({
  latestMeasurementForUser: vi.fn(),
}));

const { loadUserById } = await import("#/server/auth.core");
const intakeCore = await import("#/server/intake.core");
const measurementsCore = await import("#/server/measurements.core");

const freeUser = (): SessionUser => ({
  id: "u1",
  name: "Test",
  email: "t@example.com",
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
});

const imperialUser = (): SessionUser => ({
  ...freeUser(),
  unitSystem: "imperial",
});

const DAY_MS = 86_400_000;
const day = (start: string, n: number): string =>
  new Date(Date.parse(`${start}T00:00:00Z`) + n * DAY_MS)
    .toISOString()
    .slice(0, 10);

function readyMaintenanceContext(): IntakeContext {
  const entries = Array.from({ length: 28 }, (_, d) => ({
    date: day("2026-01-01", d),
    kcal: 2800,
    weightKg: 80,
  }));
  return {
    entries,
    intakeRows: entries.map((e) => ({ date: e.date, kcal: e.kcal })),
    measurementRows: entries.map((e) => ({
      takenAt: new Date(`${e.date}T12:00:00Z`),
      weightKg: e.weightKg,
    })),
  };
}

const testAuthInfo = {
  token: "test",
  clientId: "client",
  scopes: ["mcp:read"],
  extra: { sub: "u1" },
};

function buildLocalMcpServer(): McpServer {
  const server = new McpServer(
    { name: "physlane-test", version: "2.0.0" },
    { capabilities: { tools: {} } },
  );
  registerStatus(server);
  return server;
}

function linkedPairWithAuth() {
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const baseSend = clientTransport.send.bind(clientTransport);
  clientTransport.send = (message, options) =>
    baseSend(message, { ...options, authInfo: testAuthInfo });
  return { clientTransport, serverTransport };
}

async function withMcpClient(run: (client: Client) => Promise<void>) {
  const { clientTransport, serverTransport } = linkedPairWithAuth();
  const server = buildLocalMcpServer();
  const client = new Client({ name: "test", version: "1.0.0" });
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  try {
    await run(client);
  } finally {
    await client.close();
    await server.close();
  }
}

describe("get_status MCP tool", () => {
  function mockRealTdeeGate() {
    const ctx = readyMaintenanceContext();
    const result = computeTdee(ctx.entries);
    vi.mocked(intakeCore.buildTdeeStatusForUser).mockImplementation(
      async (u) => {
        const activeCycle = await intakeCore.loadActiveCycle(u.id);
        return assembleTdeeStatusPayload(u, ctx, result, activeCycle);
      },
    );
  }

  beforeEach(() => {
    vi.mocked(loadUserById).mockReset();
    vi.mocked(intakeCore.buildTdeeStatusForUser).mockReset();
    vi.mocked(intakeCore.intakeStreakForUser).mockReset();
    vi.mocked(intakeCore.loadActiveCycle).mockReset();
    vi.mocked(measurementsCore.latestMeasurementForUser).mockReset();
  });

  it("tools/list includes get_status with readOnly and idempotent annotations", async () => {
    await withMcpClient(async (client) => {
      const { tools } = await client.listTools();
      const status = tools.find((t) => t.name === "get_status");
      expect(status).toBeDefined();
      expect(status?.description).toBe(GET_STATUS_DESCRIPTION);
      expect(status?.annotations?.readOnlyHint).toBe(true);
      expect(status?.annotations?.idempotentHint).toBe(true);
    });
  });

  it("free user: real TDEE gate hides estimate kcal and projection", async () => {
    const user = freeUser();
    vi.mocked(loadUserById).mockResolvedValue(user);
    mockRealTdeeGate();
    vi.mocked(intakeCore.intakeStreakForUser).mockResolvedValue(3);
    vi.mocked(intakeCore.loadActiveCycle).mockResolvedValue(null);
    vi.mocked(measurementsCore.latestMeasurementForUser).mockResolvedValue({
      id: "m1",
      takenAt: "2026-10-01T00:00:00.000Z",
      weightKg: 80,
      neckCm: null,
      chestCm: null,
      waistCm: null,
      hipsCm: null,
      armLeftCm: null,
      armRightCm: null,
      thighLeftCm: null,
      thighRightCm: null,
      calfCm: null,
      notes: null,
    });

    await withMcpClient(async (client) => {
      const result = await client.callTool({
        name: "get_status",
        arguments: {},
      });
      const serialized = JSON.stringify(result);
      expect(serialized).not.toMatch(/\b2800\b/);
      const tdee = (
        result.structuredContent as { tdeeStatus: Record<string, unknown> }
      ).tdeeStatus;
      expect(tdee).toMatchObject({
        status: "ready",
        gated: true,
        kcal: null,
        projection: null,
      });
      expect(result.structuredContent).toMatchObject({
        units: "metric",
        plan: "free",
        streak: 3,
      });
    });
  });

  it("summary text uses imperial weight units", async () => {
    const user = imperialUser();
    vi.mocked(loadUserById).mockResolvedValue(user);
    mockRealTdeeGate();
    vi.mocked(intakeCore.intakeStreakForUser).mockResolvedValue(0);
    vi.mocked(intakeCore.loadActiveCycle).mockResolvedValue(null);
    vi.mocked(measurementsCore.latestMeasurementForUser).mockResolvedValue({
      id: "m1",
      takenAt: "2026-10-01T00:00:00.000Z",
      weightKg: 80,
      neckCm: null,
      chestCm: null,
      waistCm: null,
      hipsCm: null,
      armLeftCm: null,
      armRightCm: null,
      thighLeftCm: null,
      thighRightCm: null,
      calfCm: null,
      notes: null,
    });

    await withMcpClient(async (client) => {
      const result = await client.callTool({
        name: "get_status",
        arguments: {},
      });
      const text =
        result.content?.[0]?.type === "text" ? result.content[0].text : "";
      expect(text).toContain("lb");
      expect(text).not.toContain(" kg");
    });
  });
});
