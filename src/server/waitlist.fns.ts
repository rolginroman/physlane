import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { useDb, schema } from "#/db";
import { checkEmail } from "#/lib/waitlist";

export type JoinWaitlistResult =
  | { status: "joined" }
  | { status: "already" }
  | { status: "error"; reason: string };

/**
 * Landing email capture. Unauthenticated by design: one row per address,
 * duplicate inserts resolve to a friendly "already on the list".
 */
export const joinWaitlist = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (
      typeof input !== "object" ||
      input === null ||
      typeof (input as { email?: unknown }).email !== "string"
    ) {
      throw new Error("Email is required.");
    }
    const source = (input as { source?: unknown }).source;
    return {
      email: (input as { email: string }).email,
      source: typeof source === "string" ? source.slice(0, 64) : null,
    };
  })
  .handler(async ({ data }): Promise<JoinWaitlistResult> => {
    const check = checkEmail(data.email);
    if (!check.ok) return { status: "error", reason: check.reason };

    const db = useDb();
    const existing = await db
      .select({ id: schema.waitlist.id })
      .from(schema.waitlist)
      .where(eq(schema.waitlist.email, check.email))
      .limit(1);
    if (existing.length > 0) return { status: "already" };

    try {
      await db.insert(schema.waitlist).values({
        id: crypto.randomUUID(),
        email: check.email,
        source: data.source,
      });
      return { status: "joined" };
    } catch {
      // Lost a race with a concurrent submit: the unique index still guards
      // us, so a row existing now means "already subscribed".
      const after = await db
        .select({ id: schema.waitlist.id })
        .from(schema.waitlist)
        .where(eq(schema.waitlist.email, check.email))
        .limit(1);
      if (after.length > 0) return { status: "already" };
      return {
        status: "error",
        reason: "Could not save that right now. Try again in a minute.",
      };
    }
  });
