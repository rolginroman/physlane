import { createAuthClient } from "better-auth/react";
import { telegramClient } from "tele-better-auth/client";

export const authClient = createAuthClient({
	/** Filled by the vite plugin from APP_URL var; default same-origin works everywhere. */
	baseURL: typeof window !== "undefined" ? window.location.origin : undefined,
	fetchOptions: {
		credentials: "include",
	},
	plugins: [telegramClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
