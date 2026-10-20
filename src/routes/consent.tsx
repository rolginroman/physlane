import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useSession } from "#/lib/auth-client";
import { fetchOAuthPublicClient, postOAuthConsent } from "./-oauth-flow-client";
import { oauthScopeLabels } from "./-oauth-scope-labels";
import { hasOAuthContinuation } from "./-oauth-signed-query";

export const Route = createFileRoute("/consent")({
  head: () => ({
    meta: [
      { title: "Authorize app · physlane" },
      { name: "robots", content: "noindex, follow" },
    ],
    links: [
      { rel: "canonical", href: "https://physlane.unpackit.top/consent" },
    ],
  }),
  component: ConsentPage,
});

function ConsentPage() {
  const { data: session, isPending: sessionPending } = useSession();
  const search = typeof window !== "undefined" ? window.location.search : "";
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const clientId = params.get("client_id") ?? "";
  const scopeList = useMemo(
    () => (params.get("scope") ?? "").split(/\s+/).filter(Boolean),
    [params],
  );
  const scopeLabels = useMemo(() => oauthScopeLabels(scopeList), [scopeList]);

  const [clientName, setClientName] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pending, setPending] = useState<"allow" | "deny" | null>(null);

  const invalidRequest =
    !hasOAuthContinuation(search) || !clientId || scopeList.length === 0;

  useEffect(() => {
    if (sessionPending) return;
    if (!session) {
      window.location.replace(`/sign-in${search}`);
    }
  }, [session, sessionPending, search]);

  useEffect(() => {
    if (!session || invalidRequest || !clientId) return;
    let cancelled = false;
    void (async () => {
      const client = await fetchOAuthPublicClient(clientId);
      if (cancelled) return;
      if (!client) {
        setLoadError("This application could not be found.");
        return;
      }
      setClientName(client.client_name?.trim() || client.client_id);
    })();
    return () => {
      cancelled = true;
    };
  }, [clientId, invalidRequest, session]);

  async function handleConsent(accept: boolean) {
    setActionError(null);
    setPending(accept ? "allow" : "deny");
    const result = await postOAuthConsent(accept);
    setPending(null);
    if ("error" in result) {
      setActionError(result.error);
      return;
    }
    window.location.href = result.redirectUrl;
  }

  if (sessionPending || (!session && !invalidRequest)) {
    return (
      <main className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center px-4 py-10">
        <div className="card w-full max-w-sm p-6" role="status">
          <h1 className="m-0 text-lg font-semibold tracking-tight">Loading…</h1>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-[calc(100dvh-3.5rem)] items-center justify-center px-4 py-10">
      <div className="card w-full max-w-sm p-6">
        <h1 className="m-0 text-lg font-semibold tracking-tight">
          Authorize access
        </h1>
        <p className="mt-1 mb-6 text-sm text-dim">
          {invalidRequest
            ? "This authorization link is invalid or has expired."
            : clientName
              ? `${clientName} wants to access your physlane account.`
              : "An application wants to access your physlane account."}
        </p>

        {(loadError || actionError) && (
          <p
            role="alert"
            className="mb-4 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
          >
            {loadError ?? actionError}
          </p>
        )}

        {!invalidRequest && (
          <>
            <p className="label mb-2">It will be able to</p>
            <ul className="mb-6 list-disc space-y-2 pl-5 text-sm text-text">
              {scopeLabels.map((label) => (
                <li key={label}>{label}</li>
              ))}
            </ul>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                disabled={pending !== null || Boolean(loadError)}
                className="btn-primary w-full"
                onClick={() => void handleConsent(true)}
              >
                {pending === "allow" ? "Authorizing…" : "Allow"}
              </button>
              <button
                type="button"
                disabled={pending !== null}
                className="w-full min-h-[2.75rem] rounded-lg border border-[var(--color-border)] bg-transparent text-sm font-semibold text-text hover:bg-[var(--color-surface-muted)] disabled:opacity-60"
                onClick={() => void handleConsent(false)}
              >
                {pending === "deny" ? "Declining…" : "Deny"}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
