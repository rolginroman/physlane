import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getSharedCardByToken, rotateShareToken } from "./share.core";
import { requireUser } from "./auth.fns";

const GetSharedCardInputSchema = z.object({
  token: z.string(),
});

export type { SharedCard, SharedCycle } from "./share.core";

/**
 * Share-card server fns (G2.6). `getSharedCard` is deliberately public —
 * possession of the token IS the grant; `rotateShareToken` is the owner-only
 * way to create/revoke a link.
 */

export const getSharedCard = createServerFn({ method: "GET" })
  .validator((d) => GetSharedCardInputSchema.parse(d))
  .handler(async ({ data }) => {
    return getSharedCardByToken(data.token);
  });

export const rotateShareLink = createServerFn({ method: "POST" }).handler(
  async () => {
    const me = await requireUser();
    const token = await rotateShareToken(me.id);
    return { token };
  },
);
