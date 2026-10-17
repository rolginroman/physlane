import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
	/** Filled by the vite plugin from APP_URL var; default same-origin works everywhere. */
	baseURL: typeof window !== "undefined" ? window.location.origin : undefined,
});

export const { signIn, signUp, signOut, useSession } = authClient;
