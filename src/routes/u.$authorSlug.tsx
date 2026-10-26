import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/u/$authorSlug")({
  staticData: { appChrome: false },
  component: Outlet,
});
