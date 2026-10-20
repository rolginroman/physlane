import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { useDb } from "#/db/client";
import * as schema from "#/db/schema";
import { appError } from "#/lib/app-error";
import { checkEmail } from "#/lib/waitlist";

export type JoinWaitlistResult =
  | { status: "joined" }
  | { status: "already" }
  | { status: "error"; reason: string };

const JoinWaitlistInputSchema = z.object({
  email: z.string(),
  source: z
    .preprocess(
      (v) => (typeof v === "string" ? v.slice(0, 64) : null),
      z.string().max(64).nullable(),
    )
    .optional(),
});

/**
 * Landing email capture. Unauthenticated by design: one row per address,
 * duplicate inserts resolve to a friendly "already on the list".
 */
export const joinWaitlist = createServerFn({ method: "POST" })
  .validator((input) => {
    const parsed = JoinWaitlistInputSchema.safeParse(input);
    if (!parsed.success) throw appError("EMAIL_REQUIRED");
    return {
      email: parsed.data.email,
      source: parsed.data.source ?? null,
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
