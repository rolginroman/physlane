import { BASE_URL } from "./env";
import { fetchJson } from "./harness";

export const PROTOCOL_VERSION = "2026-07-28";

const META = {
  "io.modelcontextprotocol/protocolVersion": PROTOCOL_VERSION,
  "io.modelcontextprotocol/clientCapabilities": {},
};

type JsonRpc = { result?: Record<string, unknown> };

export type ToolResult = {
  isError?: boolean;
  content?: Array<{ type: string; text?: string }>;
  structuredContent?: Record<string, unknown>;
};

export type CallOutcome =
  | { kind: "ok"; status: number; result: ToolResult }
  | { kind: "insufficient_scope"; wwwAuthenticate: string; body: unknown }
  | { kind: "http_error"; status: number; text: string };

export type Tool = { name: string; annotations?: Record<string, unknown> };

export class ModernMcpClient {
  private nextId = 1;
  constructor(private readonly token: string) {}

  private post(method: string, params: object, extra: Record<string, string>) {
    const body = {
      jsonrpc: "2.0",
      id: this.nextId++,
      method,
      params: { ...params, _meta: META },
    };
    return fetchJson<JsonRpc>(`${BASE_URL}/mcp`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "MCP-Protocol-Version": PROTOCOL_VERSION,
        "Mcp-Method": method,
        ...extra,
      },
      body: JSON.stringify(body),
    });
  }

  /** 2026-07-28 handshake is stateless server/discover, not initialize. */
  async initialize(): Promise<Record<string, unknown>> {
    const res = await this.post("server/discover", {}, {});
    if (res.status !== 200 || !res.json?.result) {
      throw new Error(`server/discover failed: HTTP ${res.status} ${res.text}`);
    }
    return res.json.result;
  }

  async listTools(): Promise<Tool[]> {
    const res = await this.post("tools/list", {}, {});
    const tools = res.json?.result?.tools;
    if (res.status !== 200 || !Array.isArray(tools)) {
      throw new Error(`tools/list failed: HTTP ${res.status} ${res.text}`);
    }
    return tools as Tool[];
  }

  async callTool(
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<CallOutcome> {
    const res = await this.post(
      "tools/call",
      { name, arguments: args },
      { "Mcp-Name": name },
    );
    const www = res.headers.get("www-authenticate");
    if (res.status === 403 && www && /insufficient_scope/.test(www)) {
      return {
        kind: "insufficient_scope",
        wwwAuthenticate: www,
        body: res.json,
      };
    }
    if (res.status !== 200 && res.status !== 202) {
      return { kind: "http_error", status: res.status, text: res.text };
    }
    return {
      kind: "ok",
      status: res.status,
      result: (res.json?.result ?? {}) as ToolResult,
    };
  }

  /** callTool that must succeed with a non-error tool result. */
  async callOk(
    name: string,
    args: Record<string, unknown> = {},
  ): Promise<Record<string, unknown>> {
    const out = await this.callTool(name, args);
    if (out.kind !== "ok" || out.result.isError) {
      throw new Error(`${name} failed: ${JSON.stringify(out)}`);
    }
    return out.result.structuredContent ?? {};
  }
}
