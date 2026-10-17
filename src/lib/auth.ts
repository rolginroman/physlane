import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { env } from "cloudflare:workers";
import { useDb } from "#/db";

export function useAuth() {
	return betterAuth({
		database: drizzleAdapter(useDb(), {
			provider: "sqlite",
		}),
		secret: env.AUTH_SECRET ?? "dev-insecure-secret-change-me",
		baseURL: env.APP_URL ?? "http://localhost:3000",
		emailAndPassword: {
			enabled: true,
			minPasswordLength: 8,
			autoSignIn: true,
		},
		session: {
			expiresIn: 60 * 60 * 24 * 7, // 7 days
			updateAge: 60 * 60 * 24, // refresh daily
		},
		plugins: [tanstackStartCookies()],
	});
}
