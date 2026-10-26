import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/u/$authorSlug/$programRef")({
  staticData: { appChrome: false },
  component: Outlet,
});
