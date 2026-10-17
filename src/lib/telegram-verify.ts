/**
 * Thin wrapper around tele-better-auth's `POST /telegram/miniapp/validate`
 * endpoint.
 *
 * The package (v1.7.x) exports no standalone verify function, so we exercise
 * its real endpoint through a Better Auth handler. This runs the plugin's
 * actual crypto path (HMAC-SHA256 secret derivation + data-check-string
 * comparison + auth_date freshness) in our runtime instead of reimplementing
 * Telegram's algorithm.
 */

/** Anything that can serve Better Auth requests (the object returned by `betterAuth()`). */
type AuthHandler = { handler: (request: Request) => Response | Promise<Response> };

export interface TelegramInitDataValidation {
	valid: boolean;
	data: unknown;
}

export async function validateTelegramInitData(
	auth: AuthHandler,
	initData: string,
): Promise<TelegramInitDataValidation> {
	const response = await auth.handler(
		new Request("http://localhost/api/auth/telegram/miniapp/validate", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ initData }),
		}),
	);
	return (await response.json()) as TelegramInitDataValidation;
}
