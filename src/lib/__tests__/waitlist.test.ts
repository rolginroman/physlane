import { describe, expect, it } from "vitest";
import { checkEmail } from "../waitlist";

describe("checkEmail", () => {
  it("accepts a normal address and normalizes case + surrounding spaces", () => {
    expect(checkEmail("  Roman@Example.COM ")).toEqual({
      ok: true,
      email: "roman@example.com",
    });
  });

  it("rejects empty and whitespace-only input", () => {
    expect(checkEmail("")).toEqual({
      ok: false,
      reason: expect.stringContaining("Enter"),
    });
    expect(checkEmail("   ")).toEqual({
      ok: false,
      reason: expect.stringContaining("Enter"),
    });
  });

  it("rejects missing local part, domain, or TLD", () => {
    expect(checkEmail("@example.com").ok).toBe(false);
    expect(checkEmail("roman@").ok).toBe(false);
    expect(checkEmail("roman@example.").ok).toBe(false);
    expect(checkEmail("romanexample.com").ok).toBe(false);
  });

  it("rejects whitespace inside the address", () => {
    expect(checkEmail("ro man@example.com").ok).toBe(false);
  });

  it("rejects one-character TLDs", () => {
    expect(checkEmail("roman@example.c").ok).toBe(false);
  });

  it("rejects absurd lengths", () => {
    expect(checkEmail(`${"a".repeat(250)}@example.com`).ok).toBe(false);
  });

  it("accepts plus addressing and common formats", () => {
    expect(checkEmail("r+test@example.co.uk").ok).toBe(true);
    expect(checkEmail("o'brien@example.fi").ok).toBe(true);
  });
});
