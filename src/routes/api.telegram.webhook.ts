import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { timingSafeEqual } from "#/lib/remind";

/**
 * Telegram bot webhook (G2.5 companion). Telegram POSTs bot updates here;
 * authenticity is guaranteed by the `X-Telegram-Bot-Api-Secret-Token` header
 * set via setWebhook (not by source IP — Workers see Telegram's ranges only
 * incidentally). Wrong secret -> 401; anything else always 200 so Telegram
 * never retry-storms us.
 *
 * Handles /start and /help: replies with a short plain message pointing at
 * the menu button. Everything else is ignored (no echo bot).
 */
export const Route = createFileRoute("/api/telegram/webhook")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => handleWebhook(request),
    },
  },
});

async function handleWebhook(request: Request): Promise<Response> {
  const secret = env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret) return Response.json({ ok: true, skipped: "unconfigured" });
  const got = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!timingSafeEqual(got, secret))
    return new Response("unauthorized", { status: 401 });

  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) return Response.json({ ok: true });

  let update: { message?: { chat?: { id?: number }; text?: string } };
  try {
    update = (await request.json()) as typeof update;
  } catch {
    return Response.json({ ok: true });
  }

  const chatId = update.message?.chat?.id;
  const text = (update.message?.text ?? "").trim().toLowerCase();
  if (
    !chatId ||
    (text !== "/start" && text !== "/help" && !text.startsWith("/start "))
  ) {
    return Response.json({ ok: true });
  }

  const reply =
    "physlane here. Reminders arrive in this chat. Open the app from the menu button (the four squares left of the message field). Your account is the same on web and here.";
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: reply }),
    });
  } catch {
    // Send failures must not produce a non-200: Telegram would retry forever.
  }
  return Response.json({ ok: true });
}
