import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "#/lib/auth";
import { withWellKnownCors } from "#/server/mcp/well-known";

export const Route = createFileRoute("/.well-known/oauth-protected-resource")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const response = await useAuth().handler(request);
        return withWellKnownCors(response);
      },
    },
  },
});
