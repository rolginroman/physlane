import { describe, expect, it } from "vitest";
import {
  programActionErrorMessage,
  programErrorMessage,
} from "../program-error-message";

describe("programActionErrorMessage", () => {
  it("lets codes that carry their own fix override the action copy", () => {
    expect(programActionErrorMessage("report", "REPORT_RATE_LIMITED")).toBe(
      programErrorMessage("REPORT_RATE_LIMITED"),
    );
    expect(programActionErrorMessage("report", "REPORT_RATE_LIMITED")).not.toBe(
      programActionErrorMessage("report"),
    );
  });

  it("falls back to the action copy for unknown or generic codes", () => {
    expect(programActionErrorMessage("fork", "PROGRAM_NOT_FOUND")).toBe(
      programActionErrorMessage("fork"),
    );
    expect(programActionErrorMessage("fork", "boom")).toBe(
      programActionErrorMessage("fork"),
    );
  });

  it("gives copy and report different fallbacks", () => {
    expect(programActionErrorMessage("fork")).not.toBe(
      programActionErrorMessage("report"),
    );
  });
});
