import { describe, expect, it } from "vitest";
import {
  resolveAuthRedirectTarget,
  withForkCopyIntent,
} from "#/lib/auth-redirect";

describe("withForkCopyIntent", () => {
  it("appends copy=1 to program return paths", () => {
    expect(withForkCopyIntent("/u/tara/hypertrophy")).toBe(
      "/u/tara/hypertrophy?copy=1",
    );
  });

  it("replaces existing copy search param", () => {
    expect(withForkCopyIntent("/u/tara/hypertrophy?copy=0")).toBe(
      "/u/tara/hypertrophy?copy=1",
    );
  });
});

describe("resolveAuthRedirectTarget", () => {
  it("merges legacy sign-up copy flag into redirect", () => {
    expect(resolveAuthRedirectTarget("/u/tara/hypertrophy", true)).toBe(
      "/u/tara/hypertrophy?copy=1",
    );
  });
});
