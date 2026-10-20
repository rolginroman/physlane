/**
 * Integration test for the Telegram Mini App initData verification path.
 *
 * We build a VALID signed initData string ourselves (per Telegram's spec,
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app)
 * and assert that tele-better-auth's /telegram/miniapp/validate endpoint —
 * driven through our thin wrapper — accepts it and rejects tampered inputs.
 *
 * Algorithm:
 *   dataCheckString = all params (sorted by key, 'k=v', joined by '\n'), EXCLUDING hash
 *   secret  = HMAC_SHA256(key="WebAppData", msg=botToken)
 *   hash    = HMAC_SHA256(key=secret,     msg=dataCheckString) as hex
 */
import { createHmac } from "node:crypto";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { describe, expect, it } from "vitest";
import { telegram } from "tele-better-auth";
import { validateTelegramInitData } from "./telegram-verify";

const BOT_TOKEN = "123456:TEST-TOKEN";

/** Sign a params object into a full initData query string (hash included). */
function signInitData(params: Record<string, string>): string {
  const search = new URLSearchParams(params);
  search.delete("hash");
  // Must mirror the plugin's construction: URL-decoded values, sorted keys,
  // 'k=v' joined by newlines — the dataCheckString excludes only `hash`.
  const dataCheckString = Array.from(search.entries())
    .sort(([a], [b]) => (a === b ? 0 : a < b ? -1 : 1))
    .map(([key, value]) => `${key}=${value}`)
    .join("\n");
  const secret = createHmac("sha256", "WebAppData").update(BOT_TOKEN).digest();
  const hash = createHmac("sha256", secret)
    .update(dataCheckString)
    .digest("hex");
  search.set("hash", hash);
  return search.toString();
}

const testUser = { id: 123, first_name: "Test", username: "test" };

function validInitData(authDateSec = Math.floor(Date.now() / 1000)): string {
  return signInitData({
    user: JSON.stringify(testUser),
    auth_date: String(authDateSec),
  });
}

/** Minimal Better Auth instance with the real telegram plugin (no D1 needed —
 * the validate endpoint only runs the HMAC check, never touches the DB). */
const auth = betterAuth({
  database: memoryAdapter({}), // validate never touches the DB; empty store is fine
  secret: "test-secret-not-a-real-credential",
  plugins: [
    telegram({
      botToken: BOT_TOKEN,
      loginWidget: false, // widget requires a bot username; irrelevant here
      miniApp: { enabled: true },
    }),
  ],
});

describe("telegram miniapp initData validation (via tele-better-auth)", () => {
  it("accepts a correctly signed initData string", async () => {
    const result = await validateTelegramInitData(auth, validInitData());
    expect(result.valid).toBe(true);
    const data = result.data as {
      user?: { id?: number; username?: string };
      auth_date?: number;
    };
    expect(data.user?.id).toBe(123);
    expect(data.user?.username).toBe("test");
    expect(typeof data.auth_date).toBe("number");
  });

  it("rejects a wrong hash", async () => {
    const tampered = validInitData().replace(
      /hash=[0-9a-f]+$/,
      "hash=" + "0".repeat(64),
    );
    const result = await validateTelegramInitData(auth, tampered);
    expect(result.valid).toBe(false);
  });

  it("rejects a tampered user payload (hash no longer matches)", async () => {
    const signed = new URLSearchParams(validInitData());
    signed.set(
      "user",
      JSON.stringify({ id: 999, first_name: "Attacker", username: "evil" }),
    );
    const result = await validateTelegramInitData(auth, signed.toString());
    expect(result.valid).toBe(false);
  });

  it("rejects auth_date older than the 24h maxAuthAge window", async () => {
    const stale = Math.floor(Date.now() / 1000) - 25 * 60 * 60; // 25h ago
    const result = await validateTelegramInitData(auth, validInitData(stale));
    expect(result.valid).toBe(false);
  });

  it("rejects initData missing the hash parameter", async () => {
    const unsigned = new URLSearchParams({
      user: JSON.stringify(testUser),
      auth_date: String(Math.floor(Date.now() / 1000)),
    }).toString();
    const result = await validateTelegramInitData(auth, unsigned);
    expect(result.valid).toBe(false);
  });
});
