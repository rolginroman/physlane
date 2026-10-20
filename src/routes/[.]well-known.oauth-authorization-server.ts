import { oauthProviderAuthServerMetadata } from "@better-auth/oauth-provider";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "#/lib/auth";
import { withWellKnownCors } from "#/server/mcp/well-known";

export const Route = createFileRoute("/.well-known/oauth-authorization-server")(
  {
    server: {
      handlers: {
        GET: async ({ request }: { request: Request }) => {
          const handler = oauthProviderAuthServerMetadata(useAuth());
          return withWellKnownCors(await handler(request));
        },
      },
    },
  },
);
