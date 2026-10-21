import { createMcpHandler, McpServer } from "@modelcontextprotocol/server";
import { register as registerCycles } from "#/server/mcp/tools/cycles";
import { register as registerHistory } from "#/server/mcp/tools/history";
import { register as registerIntake } from "#/server/mcp/tools/intake";
import { register as registerMeasurements } from "#/server/mcp/tools/measurements";
import { register as registerStatus } from "#/server/mcp/tools/status";

export function buildMcpServer(): McpServer {
  const server = new McpServer(
    { name: "physlane", version: "2.0.0" },
    {
      capabilities: {
        tools: {},
      },
    },
  );
  registerStatus(server);
  registerHistory(server);
  registerIntake(server);
  registerMeasurements(server);
  registerCycles(server);
  return server;
}

// "stateless" keeps the default serving of 2025-era (non-envelope) clients
// like pi and Claude Code; "reject" would serve only the 2026-07-28 protocol.
export const mcpHttpHandler = createMcpHandler(() => buildMcpServer(), {
  legacy: "stateless",
});
