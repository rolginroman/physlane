import { Client } from "@modelcontextprotocol/client";
import { InMemoryTransport, McpServer } from "@modelcontextprotocol/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionUser } from "#/server/auth.core";
import {
  GET_HISTORY_DESCRIPTION,
  register as registerHistory,
} from "#/server/mcp/tools/history";
import { register as registerStatus } from "#/server/mcp/tools/status";

vi.mock("#/server/auth.core", () => ({
  loadUserById: vi.fn(),
}));

vi.mock("#/server/intake.core", () => ({
  buildTdeeStatusForUser: vi.fn(),
  intakeStreakForUser: vi.fn(),
  loadActiveCycle: vi.fn(),
  intakeRangeForUser: vi.fn(),
}));

vi.mock("#/server/measurements.core", () => ({
  latestMeasurementForUser: vi.fn(),
  listMeasurementsForUser: vi.fn(),
}));

vi.mock("#/server/cycles.core", () => ({
  listCyclesForUser: vi.fn(),
}));

const { loadUserById } = await import("#/server/auth.core");
const intakeCore = await import("#/server/intake.core");
const measurementsCore = await import("#/server/measurements.core");
const cyclesCore = await import("#/server/cycles.core");

const sessionUser = (): SessionUser => ({
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
  registerHistory(server);
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

describe("get_history MCP tool", () => {
  beforeEach(() => {
    vi.mocked(loadUserById).mockReset();
    vi.mocked(intakeCore.intakeRangeForUser).mockReset();
    vi.mocked(measurementsCore.listMeasurementsForUser).mockReset();
    vi.mocked(cyclesCore.listCyclesForUser).mockReset();
    vi.mocked(loadUserById).mockResolvedValue(sessionUser());
  });

  it("tools/list includes get_history with readOnly and idempotent annotations", async () => {
    await withMcpClient(async (client) => {
      const { tools } = await client.listTools();
      const history = tools.find((t) => t.name === "get_history");
      expect(history).toBeDefined();
      expect(history?.description).toBe(GET_HISTORY_DESCRIPTION);
      expect(history?.annotations?.readOnlyHint).toBe(true);
      expect(history?.annotations?.idempotentHint).toBe(true);
    });
  });

  it("rejects limit > 400 with isError and actionable message", async () => {
    await withMcpClient(async (client) => {
      const result = await client.callTool({
        name: "get_history",
        arguments: { kind: "intake", limit: 401 },
      });
      expect(result.isError).toBe(true);
      const text =
        result.content?.[0]?.type === "text" ? result.content[0].text : "";
      expect(text).toContain("400");
      expect(text.toLowerCase()).toContain("limit");
    });
  });

  it("dispatches kind=intake to intakeRangeForUser", async () => {
    vi.mocked(intakeCore.intakeRangeForUser).mockResolvedValue([
      { date: "2026-10-01", kcal: 2000, proteinG: null },
    ]);

    await withMcpClient(async (client) => {
      await client.callTool({
        name: "get_history",
        arguments: {
          kind: "intake",
          from: "2026-10-01",
          to: "2026-10-17",
          limit: 10,
        },
      });
      expect(intakeCore.intakeRangeForUser).toHaveBeenCalledWith(
        sessionUser(),
        {
          from: "2026-10-01",
          to: "2026-10-17",
        },
      );
    });
  });

  it("dispatches kind=measurements to listMeasurementsForUser", async () => {
    vi.mocked(measurementsCore.listMeasurementsForUser).mockResolvedValue([]);

    await withMcpClient(async (client) => {
      await client.callTool({
        name: "get_history",
        arguments: { kind: "measurements", limit: 5 },
      });
      expect(measurementsCore.listMeasurementsForUser).toHaveBeenCalledWith(
        sessionUser(),
      );
    });
  });

  it("dispatches kind=cycles to listCyclesForUser", async () => {
    vi.mocked(cyclesCore.listCyclesForUser).mockResolvedValue([]);

    await withMcpClient(async (client) => {
      await client.callTool({
        name: "get_history",
        arguments: { kind: "cycles", limit: 5 },
      });
      expect(cyclesCore.listCyclesForUser).toHaveBeenCalledWith(sessionUser());
    });
  });

  it("kind=cycles: limit keeps the newest cycles in ascending startDate order", async () => {
    const mk = (id: string, startDate: string) => ({
      id,
      phase: "cut" as const,
      startDate,
      endDate: null,
      startWeightKg: null,
      targetRateKgPerWeek: null,
      kcalTargetPerDay: null,
      notes: null,
    });
    vi.mocked(cyclesCore.listCyclesForUser).mockResolvedValue([
      mk("c5", "2026-05-01"),
      mk("c4", "2026-04-01"),
      mk("c3", "2026-03-01"),
      mk("c2", "2026-02-01"),
      mk("c1", "2026-01-01"),
    ]);

    await withMcpClient(async (client) => {
      const result = await client.callTool({
        name: "get_history",
        arguments: { kind: "cycles", limit: 2 },
      });
      const items = (
        result.structuredContent as {
          items: Array<{ id: string; startDate: string }>;
        }
      ).items;
      expect(items).toHaveLength(2);
      expect(items.map((i) => i.id)).toEqual(["c4", "c5"]);
      expect(items[0]?.startDate).toBe("2026-04-01");
      expect(items[1]?.startDate).toBe("2026-05-01");
    });
  });
});
