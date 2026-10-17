import { createServerFn } from "@tanstack/react-start";
import {
	applySettings,
	loadSessionUser,
	requireUser,
	type SessionUser,
	type SettingsPatch,
} from "#/server/auth.core";

export type { SessionUser, SettingsPatch };
export { requireUser };

export const getSessionUser = createServerFn({ method: "GET" }).handler(async () => {
	return loadSessionUser();
});

export const updateSettings = createServerFn({ method: "POST" })
	.validator((d: SettingsPatch) => d)
	.handler(async ({ data }) => {
		const me = await requireUser();
		return applySettings(me, data);
	});
