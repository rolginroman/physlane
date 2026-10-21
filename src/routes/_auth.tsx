import {
  createFileRoute,
  Outlet,
  redirect,
  useRouter,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { setUserUid } from "#/lib/analytics/client";
import { getViewer } from "#/lib/auth-guard.fns";
import { backButton } from "#/lib/telegram-web";
import { useTelegramChrome, useTelegramMode } from "#/lib/telegram-mode";

export const Route = createFileRoute("/_auth")({
  beforeLoad: async () => {
    const me = await getViewer();
    if (!me) throw redirect({ to: "/sign-in" });
    return { uid: me.id };
  },
  component: AuthLayout,
});

function AuthLayout() {
  const { uid } = Route.useRouteContext();
  const router = useRouter();
  const tgMode = useTelegramMode();
  useTelegramChrome();

  // Opaque uid super-property for client events after sign-in.
  useEffect(() => {
    if (uid) setUserUid(uid);
  }, [uid]);

  // Telegram BackButton = back navigation on app sub-pages; it stays hidden on
  // the landing (this layout only mounts for signed-in app pages).
  useEffect(() => {
    if (!tgMode) return;
    return backButton(true, () => router.history.back());
  }, [tgMode, router]);

  return (
    <main
      className="mx-auto w-full max-w-5xl px-4 pb-16"
      style={
        tgMode
          ? { paddingBottom: "calc(var(--tg-safe-bottom, 0px) + 4rem)" }
          : undefined
      }
    >
      <Outlet />
    </main>
  );
}
