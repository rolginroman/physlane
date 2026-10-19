import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { telegram } from "tele-better-auth";
import { env } from "cloudflare:workers";
import { useDb } from "#/db";

export function useAuth() {
	// Telegram auth is env-optional: without a bot token the plugin is skipped
	// entirely (it throws at init if enabled without one) so local dev without
	// Telegram credentials keeps working — same optional-env pattern as useStripe.
	const botToken = env.TELEGRAM_BOT_TOKEN;
	const botUsername = env.TELEGRAM_BOT_USERNAME;

	return betterAuth({
		database: drizzleAdapter(useDb(), {
			provider: "sqlite",
		}),
		secret: env.AUTH_SECRET ?? "dev-insecure-secret-change-me",
		// Dev: follow the request's loopback host on any port, so the http origin is
		// trusted and cookies are non-Secure (APP_URL is the prod https URL).
		baseURL: import.meta.env.DEV
			? { allowedHosts: ["localhost:*", "127.0.0.1:*"], protocol: "http" }
			: (env.APP_URL ?? "http://localhost:3000"),
		emailAndPassword: {
			enabled: true,
			minPasswordLength: 8,
			autoSignIn: true,
		},
		session: {
			expiresIn: 60 * 60 * 24 * 7, // 7 days
			updateAge: 60 * 60 * 24, // refresh daily
		},
		plugins: [
			tanstackStartCookies(),
			...(botToken
				? [
						telegram({
							botToken,
							botUsername,
							// Widget routes need a bot username; only enable when provided.
							loginWidget: Boolean(botUsername),
							miniApp: {
								enabled: true,
								allowAutoSignin: true,
								// initData verification is always on (validateInitData
								// is deprecated in tele-better-auth 1.7 — `false` throws).
								mapMiniAppDataToUser: (user) => ({
									name: [user.first_name, user.last_name].filter(Boolean).join(" "),
									image: user.photo_url,
									// email intentionally left to the plugin default
									// (unverified <telegramId>@telegram.invalid placeholder)
								}),
							},
						}),
					]
				: []),
		],
	});
}
