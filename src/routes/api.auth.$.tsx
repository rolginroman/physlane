import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "#/lib/auth";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => authResponse(request),
      POST: async ({ request }: { request: Request }) => authResponse(request),
    },
  },
});

async function authResponse(request: Request) {
  return useAuth().handler(request);
}
