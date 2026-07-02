"use client";

import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth-store";
import { API_BASE_URL } from "@/lib/config";
import { copyToClipboard, type CopyStatus } from "@/lib/clipboard";
import { getApiErrorMessage, listDeveloperOAuthClients, requestOAuthToken } from "@/lib/api";
import { ExperienceShell } from "@/components/layout/experience-shell";

function prettyUriList(uris: string[]) {
  return uris.length ? uris.join(", ") : "None configured";
}

export default function DeveloperOAuthPage() {
  const { user, accessToken } = useAuthStore();
  const isSignedIn = Boolean(user && accessToken);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [clientSecret, setClientSecret] = useState("");
  const [redirectUri, setRedirectUri] = useState("");
  const [scope, setScope] = useState("");
  const [stateValue, setStateValue] = useState("");
  const [tokenPayload, setTokenPayload] = useState<{ access_token: string; token_type: string; expires_in: number } | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [tokenCopyStatus, setTokenCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [clientIdCopyStatuses, setClientIdCopyStatuses] = useState<Record<string, CopyStatus>>({});
  const [authCode, setAuthCode] = useState("");
  const [codeTokenPayload, setCodeTokenPayload] = useState<{ access_token: string; token_type: string; expires_in: number } | null>(null);
  const [codeTokenError, setCodeTokenError] = useState<string | null>(null);
  const [codeTokenCopyStatus, setCodeTokenCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [authUrlCopyStatus, setAuthUrlCopyStatus] = useState<"idle" | "copied" | "failed">("idle");

  const oauthClientsQuery = useQuery({
    queryKey: ["developer-oauth-clients", accessToken],
    queryFn: () => listDeveloperOAuthClients(accessToken!),
    enabled: isSignedIn,
    staleTime: 30_000,
  });

  const requestTokenMutation = useMutation({
    mutationFn: async () =>
      requestOAuthToken({
        grant_type: "client_credentials",
        client_id: selectedClientId,
        client_secret: clientSecret,
      }),
    onSuccess: (data) => {
      setTokenPayload(data);
      setTokenError(null);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Unable to request token.";
      setTokenPayload(null);
      setTokenError(message);
    },
  });

  const selectedClient = oauthClientsQuery.data?.clients.find((client) => client.clientId === selectedClientId);
  const selectedRedirectUri = redirectUri || selectedClient?.redirectUris?.[0] || "";
  const authorizationUrl = selectedClientId && selectedRedirectUri
    ? `${API_BASE_URL}/api/oauth/authorize?response_type=code&client_id=${encodeURIComponent(
        selectedClientId,
      )}&redirect_uri=${encodeURIComponent(selectedRedirectUri)}${scope.trim() ? `&scope=${encodeURIComponent(scope.trim())}` : ""}${stateValue.trim() ? `&state=${encodeURIComponent(stateValue.trim())}` : ""}`
    : "";

  const requestCodeTokenMutation = useMutation({
    mutationFn: async () =>
      requestOAuthToken({
        grant_type: "authorization_code",
        client_id: selectedClientId,
        client_secret: clientSecret,
        code: authCode,
        redirect_uri: selectedRedirectUri,
      }),
    onSuccess: (data) => {
      setCodeTokenPayload(data);
      setCodeTokenError(null);
    },
    onError: (error) => {
      const message = error instanceof Error ? error.message : "Unable to exchange authorization code.";
      setCodeTokenPayload(null);
      setCodeTokenError(message);
    },
  });

  useEffect(() => {
    if (selectedClient?.redirectUris?.[0]) {
      setRedirectUri(selectedClient.redirectUris[0]);
    } else {
      setRedirectUri("");
    }
  }, [selectedClient]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");
    if (code) {
      setAuthCode(code);
    }
    if (state) {
      setStateValue(state);
    }
  }, []);

  const copyText = async (
    text: string,
    setter: React.Dispatch<React.SetStateAction<"idle" | "copied" | "failed">>,
  ) => {
    try {
      await copyToClipboard(text);
      setter("copied");
      window.setTimeout(() => setter("idle"), 2000);
    } catch {
      setter("failed");
      window.setTimeout(() => setter("idle"), 2000);
    }
  };

  const copyClientIdText = async (text: string, clientId: string) => {
    try {
      await copyToClipboard(text);
      setClientIdCopyStatuses((previous) => ({ ...previous, [clientId]: "copied" }));
      window.setTimeout(() => setClientIdCopyStatuses((previous) => ({ ...previous, [clientId]: "idle" })), 2000);
    } catch {
      setClientIdCopyStatuses((previous) => ({ ...previous, [clientId]: "failed" }));
      window.setTimeout(() => setClientIdCopyStatuses((previous) => ({ ...previous, [clientId]: "idle" })), 2000);
    }
  };

  return (
    <ExperienceShell
      eyebrow="OAuth"
      title="OAuth client development"
      subtitle="Manage OAuth clients and request client credentials tokens for your integrations."
      metrics={isSignedIn ? [{ label: "OAuth clients", value: String(oauthClientsQuery.data?.clients.length ?? 0), tone: "cyan" }] : []}
      actions={[]}
      maxWidthClassName="max-w-5xl"
    >
      {!isSignedIn ? (
        <div className="rounded-[28px] border border-slate-900/10 bg-white/85 p-8 text-slate-600 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
          <p>Please sign in to manage OAuth clients and request tokens.</p>
          <a
            href="/login?redirect=/developer/oauth"
            className="mt-4 inline-flex rounded-full bg-sky-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-sky-400"
          >
            Sign in
          </a>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.95fr]">
          <section className="rounded-[28px] border border-slate-900/10 bg-white/85 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <p className="text-[10px] uppercase tracking-[0.28em] text-sky-600">OAuth client workflow</p>
            <h2 className="mt-4 text-2xl font-semibold text-slate-950">Request a client credentials token</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Select an OAuth client, paste your client secret, and request a Bearer token for server-to-server authentication.
            </p>

            <div className="mt-6 grid gap-4">
              <label className="grid gap-2 text-sm text-slate-600">
                OAuth client
                <select
                  value={selectedClientId}
                  onChange={(event) => setSelectedClientId(event.target.value)}
                  className="w-full rounded-[20px] border border-slate-900/10 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-300"
                >
                  <option value="">Select a client</option>
                  {oauthClientsQuery.data?.clients.map((client) => (
                    <option key={client.id} value={client.clientId}>
                      {client.name} — {client.clientId}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2 text-sm text-slate-600">
                Client secret
                <input
                  value={clientSecret}
                  onChange={(event) => setClientSecret(event.target.value)}
                  type="password"
                  placeholder="Enter client secret"
                  className="w-full rounded-[20px] border border-slate-900/10 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-300"
                />
              </label>

              <button
                type="button"
                disabled={!selectedClientId || !clientSecret.trim() || requestTokenMutation.isPending}
                onClick={() => void requestTokenMutation.mutateAsync()}
                className="inline-flex h-12 items-center justify-center rounded-full bg-sky-500 px-5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {requestTokenMutation.isPending ? "Requesting token..." : "Request token"}
              </button>

              {tokenPayload ? (
                <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-emerald-900">Token response</p>
                      <p className="mt-2 break-all text-slate-900">{tokenPayload.access_token}</p>
                      <p className="mt-2 text-xs text-slate-500">Expires in {tokenPayload.expires_in} seconds.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void copyText(tokenPayload.access_token, setTokenCopyStatus)}
                      className="inline-flex h-10 items-center justify-center rounded-full border border-slate-900/10 bg-white px-4 text-xs font-semibold text-slate-900 transition hover:bg-slate-50"
                    >
                      {tokenCopyStatus === "copied" ? "Copied" : tokenCopyStatus === "failed" ? "Copy failed" : "Copy token"}
                    </button>
                  </div>
                </div>
              ) : null}

              {tokenError ? (
                <p className="text-sm text-rose-300">{tokenError}</p>
              ) : null}

              <div className="rounded-[24px] border border-slate-900/10 bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-semibold text-slate-950">Exchange an authorization code</p>
                <p className="mt-2 text-xs text-slate-500">After completing the authorization redirect, paste the code below to exchange it for a Bearer token.</p>
                <div className="mt-4 grid gap-4">
                  <label className="grid gap-2 text-sm text-slate-600">
                    Authorization code
                    <input
                      value={authCode}
                      onChange={(event) => setAuthCode(event.target.value)}
                      placeholder="Enter authorization code"
                      className="w-full rounded-[20px] border border-slate-900/10 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-300"
                    />
                  </label>
                  <button
                    type="button"
                    disabled={!selectedClientId || !clientSecret.trim() || !authCode.trim() || !selectedRedirectUri || requestCodeTokenMutation.isPending}
                    onClick={() => void requestCodeTokenMutation.mutateAsync()}
                    className="inline-flex h-12 items-center justify-center rounded-full bg-sky-500 px-5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {requestCodeTokenMutation.isPending ? "Exchanging code..." : "Exchange authorization code"}
                  </button>

                  {codeTokenPayload ? (
                    <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-emerald-900">Authorization code token</p>
                          <p className="mt-2 break-all text-slate-900">{codeTokenPayload.access_token}</p>
                          <p className="mt-2 text-xs text-slate-500">Expires in {codeTokenPayload.expires_in} seconds.</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => void copyText(codeTokenPayload.access_token, setCodeTokenCopyStatus)}
                          className="inline-flex h-10 items-center justify-center rounded-full border border-slate-900/10 bg-white px-4 text-xs font-semibold text-slate-900 transition hover:bg-slate-50"
                        >
                          {codeTokenCopyStatus === "copied" ? "Copied" : codeTokenCopyStatus === "failed" ? "Copy failed" : "Copy token"}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {codeTokenError ? (
                    <p className="text-sm text-rose-300">{codeTokenError}</p>
                  ) : null}
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-900/10 bg-white/85 p-4 text-sm text-slate-600">
                <p className="font-semibold text-slate-950">cURL request example</p>
                <pre className="mt-3 overflow-x-auto text-xs text-slate-200">
                  {`curl -X POST /api/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=client_credentials&client_id=${selectedClientId || "YOUR_CLIENT_ID"}&client_secret=YOUR_CLIENT_SECRET"`}
                </pre>
                <p className="mt-3 text-xs text-slate-500">
                  Use this request from a secure server environment. The client secret is never stored by NexusForge after creation.
                </p>
              </div>

              <div className="rounded-[24px] border border-slate-900/10 bg-white/85 p-4 text-sm text-slate-600">
                <p className="font-semibold text-slate-950">Authorization URL builder</p>
                <div className="mt-4 grid gap-4">
                  <label className="grid gap-2 text-sm text-slate-600">
                    Redirect URI
                    <select
                      value={redirectUri}
                      onChange={(event) => setRedirectUri(event.target.value)}
                      className="w-full rounded-[20px] border border-slate-900/10 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-300"
                    >
                      <option value="">Select a redirect URI</option>
                      {selectedClient?.redirectUris.map((uri) => (
                        <option key={uri} value={uri}>
                          {uri}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-2 text-sm text-slate-600">
                    Scope
                    <input
                      value={scope}
                      onChange={(event) => setScope(event.target.value)}
                      placeholder="openid profile email"
                      className="w-full rounded-[20px] border border-slate-900/10 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-300"
                    />
                  </label>
                  <label className="grid gap-2 text-sm text-slate-600">
                    State
                    <input
                      value={stateValue}
                      onChange={(event) => setStateValue(event.target.value)}
                      placeholder="opaque state value"
                      className="w-full rounded-[20px] border border-slate-900/10 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-sky-300"
                    />
                    <span className="text-xs text-slate-500">Optional state parameter for CSRF protection.</span>
                  </label>
                  <div className="rounded-[24px] border border-slate-900/10 bg-slate-50 p-3 text-xs text-slate-600">
                    <p className="text-slate-500">Sample authorization URL</p>
                    <div className="mt-2 flex flex-col gap-3">
                      <pre className="max-h-40 w-full overflow-x-auto whitespace-pre-wrap break-all text-[11px] leading-5 text-slate-700">{authorizationUrl || "Select a client and redirect URI to generate a URL."}</pre>
                      {authorizationUrl ? (
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={() => void copyText(authorizationUrl, setAuthUrlCopyStatus)}
                            className="inline-flex h-10 items-center justify-center rounded-full border border-slate-900/10 bg-white px-4 text-xs font-semibold text-slate-900 transition hover:bg-slate-50"
                          >
                            {authUrlCopyStatus === "copied" ? "Copied" : authUrlCopyStatus === "failed" ? "Copy failed" : "Copy URL"}
                          </button>
                          <a
                            href={authorizationUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-10 items-center justify-center rounded-full border border-slate-900/10 bg-white px-4 text-xs font-semibold text-slate-900 transition hover:bg-slate-50"
                          >
                            Open authorization URL
                          </a>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-900/10 bg-white/85 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <p className="text-[10px] uppercase tracking-[0.28em] text-amber-600">Registered clients</p>
            <h2 className="mt-4 text-2xl font-semibold text-slate-950">OAuth client list</h2>
            <div className="mt-6 space-y-3">
              {oauthClientsQuery.isLoading ? (
                <p className="text-sm text-slate-600">Loading OAuth clients...</p>
              ) : oauthClientsQuery.isError ? (
                <p className="text-sm text-rose-600">Unable to load OAuth clients: {getApiErrorMessage(oauthClientsQuery.error)}</p>
              ) : oauthClientsQuery.data?.clients.length ? (
                oauthClientsQuery.data.clients.map((client) => (
                  <div key={client.id} className="rounded-[24px] border border-slate-900/10 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-950">{client.name}</p>
                        <p className="mt-1 text-xs text-slate-600">Client ID: {client.clientId}</p>
                        <p className="mt-2 text-xs text-slate-500">Redirect URIs: {prettyUriList(client.redirectUris)}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void copyClientIdText(client.clientId, client.clientId)}
                          className="inline-flex h-10 items-center justify-center rounded-full border border-slate-900/10 bg-white px-4 text-xs font-semibold text-slate-900 transition hover:bg-slate-50"
                        >
                          {clientIdCopyStatuses[client.clientId] === "copied"
                            ? "Copied ID"
                            : clientIdCopyStatuses[client.clientId] === "failed"
                            ? "Copy failed"
                            : "Copy ID"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setSelectedClientId(client.clientId)}
                          className="inline-flex h-10 items-center justify-center rounded-full border border-slate-900/10 bg-white px-4 text-xs font-semibold text-slate-900 transition hover:bg-slate-50"
                        >
                          Select
                        </button>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-slate-500">Last updated {new Date(client.updatedAt).toLocaleString()}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-600">No OAuth clients registered yet. Create one in Developer settings.</p>
              )}
            </div>
          </section>
        </div>
      )}
    </ExperienceShell>
  );
}
