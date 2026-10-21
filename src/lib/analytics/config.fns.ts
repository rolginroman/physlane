import { createServerFn } from "@tanstack/react-start";
import { env } from "cloudflare:workers";

function publicVar(value: string | undefined): string | null {
  if (!value || value.trim() === "") return null;
  return value;
}

export const getAnalyticsConfig = createServerFn({ method: "GET" }).handler(
  async () => {
    return {
      key: publicVar(env.POSTHOG_KEY),
      host: publicVar(env.POSTHOG_HOST),
    };
  },
);
