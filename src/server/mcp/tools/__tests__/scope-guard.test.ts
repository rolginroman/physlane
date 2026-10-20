import { describe, expect, it } from "vitest";
import {
  insufficientWriteScopeResult,
  READ_SCOPE,
  readScopeGuardResult,
  WRITE_SCOPE,
  writeScopeGuardResult,
} from "#/server/mcp/tools/scope-guard";

describe("readScopeGuardResult", () => {
  it("returns insufficient_scope when neither read nor write is granted", () => {
    const result = readScopeGuardResult(["openid"]);
    expect(result?.isError).toBe(true);
    const text =
      result?.content?.[0]?.type === "text" ? result.content[0].text : "";
    expect(text).toContain("insufficient_scope");
    expect(text).toContain(READ_SCOPE);
    expect(text).toContain(WRITE_SCOPE);
  });

  it("returns null when mcp:read is granted", () => {
    expect(readScopeGuardResult([READ_SCOPE])).toBeNull();
  });

  it("returns null when only mcp:write is granted", () => {
    expect(readScopeGuardResult([WRITE_SCOPE])).toBeNull();
  });
});

describe("writeScopeGuardResult", () => {
  it("returns insufficient_scope when mcp:write is missing", () => {
    const result = writeScopeGuardResult(["mcp:read", "openid"]);
    expect(result?.isError).toBe(true);
    const text =
      result?.content?.[0]?.type === "text" ? result.content[0].text : "";
    expect(text).toContain("insufficient_scope");
    expect(text).toContain(WRITE_SCOPE);
  });

  it("returns null when mcp:write is granted", () => {
    expect(writeScopeGuardResult(["mcp:read", WRITE_SCOPE])).toBeNull();
  });

  it("insufficientWriteScopeResult names mcp:write", () => {
    const result = insufficientWriteScopeResult();
    const text =
      result.content[0]?.type === "text" ? result.content[0].text : "";
    expect(text).toContain(WRITE_SCOPE);
  });
});
