import { describe, expect, it } from "vitest";
import { requireProPlan, type SessionUser } from "../auth.core";

const sessionUser = (plan: SessionUser["plan"]): SessionUser => ({
  id: "u1",
  name: "Test",
  email: "t@example.com",
  unitSystem: "metric",
  plan,
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

describe("requireProPlan", () => {
  it("allows a Pro session user through", () => {
    expect(() => requireProPlan(sessionUser("pro"))).not.toThrow();
  });

  it("throws PRO_REQUIRED for a free plan", () => {
    expect(() => requireProPlan(sessionUser("free"))).toThrow("PRO_REQUIRED");
  });
});
