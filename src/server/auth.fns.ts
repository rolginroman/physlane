import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { eq } from "drizzle-orm";
import { useDb } from "#/db";
import { useAuth } from "#/lib/auth";

export type SessionUser = {
	id: string;
	name: string;
	email: string;
	unitSystem: "metric" | "imperial";
	plan: "free" | "pro";
	onGlp1: boolean;
};

export const getSessionUser = createServerFn({ method: "GET" }).handler(async () => {
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
		})
		.from(schema.user)
		.where(eq(schema.user.id, session.user.id))
		.limit(1);
	return (row as SessionUser) ?? null;
});

/** Throws when unauthenticated — call inside guarded handlers. */
export async function requireUser(): Promise<SessionUser> {
	const session = await useAuth().api.getSession({ headers: getRequestHeaders() });
	if (!session?.user) throw new Error("UNAUTHORIZED");
	const schema = await import("#/db/schema");
	const db = useDb();
	const [row] = await db
		.select({
			id: schema.user.id,
			name: schema.user.name,
			email: schema.user.email,
			unitSystem: schema.user.unitSystem,
			plan: schema.user.plan,
			onGlp1: schema.user.onGlp1,
		})
		.from(schema.user)
		.where(eq(schema.user.id, session.user.id))
		.limit(1);
	if (!row) throw new Error("UNAUTHORIZED");
	return row as SessionUser;
}

export const updateSettings = createServerFn({ method: "POST" })
	.validator((d: { unitSystem?: "metric" | "imperial"; onGlp1?: boolean }) => d)
	.handler(async ({ data }) => {
		const me = await requireUser();
		const db = useDb();
		const schema = await import("#/db/schema");
		const patch: Record<string, unknown> = { updatedAt: new Date() };
		if (data.unitSystem) patch.unitSystem = data.unitSystem;
		if (typeof data.onGlp1 === "boolean" && me.plan === "pro") patch.onGlp1 = data.onGlp1;
		await db.update(schema.user).set(patch).where(eq(schema.user.id, me.id));
		return { ok: true };
	});
