import { eq } from "drizzle-orm";
import { useDb } from "#/db";
import { useAuth } from "#/lib/auth";
import { getRequestHeaders } from "@tanstack/react-start/server";

/**
 * Plain (non-RPC) auth logic shared by server functions.
 *
 * NEVER call one `createServerFn` from inside another server fn's handler:
 * in the built worker that compiles to an RPC round-trip whose inner fn id is
 * absent from the client-graph manifest ("Server function info not found").
 * Compose these plain functions instead.
 */

export type SessionUser = {
	id: string;
	name: string;
	email: string;
	unitSystem: "metric" | "imperial";
	plan: "free" | "pro";
	onGlp1: boolean;
	heightCm: number | null;
	sex: "male" | "female" | null;
};

export async function loadSessionUser(): Promise<SessionUser | null> {
	const session = await useAuth().api.getSession({
		headers: getRequestHeaders(),
	});
	if (!session?.user) return null;

	const db = useDb();
	const schema = await import("#/db/schema");
	const [row] = await db
		.select({
			id: schema.user.id,
			name: schema.user.name,
			email: schema.user.email,
			unitSystem: schema.user.unitSystem,
			plan: schema.user.plan,
			onGlp1: schema.user.onGlp1,
			heightCm: schema.user.heightCm,
			sex: schema.user.sex,
		})
		.from(schema.user)
		.where(eq(schema.user.id, session.user.id))
		.limit(1);
	return (row as SessionUser) ?? null;
}

/** Throws when unauthenticated — call inside guarded handlers. */
export async function requireUser(): Promise<SessionUser> {
	const me = await loadSessionUser();
	if (!me) throw new Error("UNAUTHORIZED");
	return me;
}

export type SettingsPatch = {
	unitSystem?: "metric" | "imperial";
	onGlp1?: boolean;
	/** null clears the stored height */
	heightCm?: number | null;
	/** null clears the stored sex */
	sex?: "male" | "female" | null;
};

export async function applySettings(
	me: SessionUser,
	data: SettingsPatch,
): Promise<{ ok: true }> {
	const db = useDb();
	const schema = await import("#/db/schema");
	const patch: Record<string, unknown> = { updatedAt: new Date() };
	if (data.unitSystem) patch.unitSystem = data.unitSystem;
	if (typeof data.onGlp1 === "boolean" && me.plan === "pro") patch.onGlp1 = data.onGlp1;
	if (data.heightCm !== undefined) {
		patch.heightCm =
			typeof data.heightCm === "number" && Number.isFinite(data.heightCm)
				? data.heightCm
				: null;
	}
	if (data.sex !== undefined) {
		patch.sex = data.sex === "male" || data.sex === "female" ? data.sex : null;
	}
	await db.update(schema.user).set(patch).where(eq(schema.user.id, me.id));
	return { ok: true };
}
