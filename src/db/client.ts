import { drizzle } from "drizzle-orm/d1";
import { env } from "cloudflare:workers";
import * as schema from "./schema";

/** Drizzle instance bound to the request's D1 binding (server-only module). */
export function useDb() {
  return drizzle(env.DB, { schema });
}
