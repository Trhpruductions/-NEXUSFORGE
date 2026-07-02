"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth-store";
import { copyToClipboard, type CopyStatus } from "@/lib/clipboard";
import {
  listDeveloperApiKeys,
  createDeveloperApiKey,
  updateDeveloperApiKey,
  revokeDeveloperApiKey,
  listDeveloperOAuthClients,
  createDeveloperOAuthClient,
  updateDeveloperOAuthClient,
  rotateDeveloperOAuthClientSecret,
  revokeDeveloperOAuthClient,
  type DeveloperOAuthClient,
} from "@/lib/api";
import { ExperienceShell } from "@/components/layout/experience-shell";

export default function DeveloperSettingsPage() {
  const { user, accessToken, csrfToken } = useAuthStore();
  const isSignedIn = Boolean(user && accessToken && csrfToken);
  const queryClient = useQueryClient();
  const [keyName, setKeyName] = useState("");
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [apiSecretCopyStatus, setApiSecretCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [clientName, setClientName] = useState("");
  const [clientRedirectUris, setClientRedirectUris] = useState("");
  const [createdOauthSecret, setCreatedOauthSecret] = useState<string | null>(null);
  const [oauthSecretCopyStatus, setOauthSecretCopyStatus] = useState<CopyStatus>("idle");
  const [copyClientIdStatuses, setCopyClientIdStatuses] = useState<Record<string, CopyStatus>>({});
  const [rotatedOauthSecret, setRotatedOauthSecret] = useState<string | null>(null);
  const [rotatedSecretCopyStatus, setRotatedSecretCopyStatus] = useState<"idle" | "copied" | "failed">("idle");
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [editingClients, setEditingClients] = useState<Record<string, { name: string; redirectUris: string }>>({});

  const keysQuery = useQuery({
    queryKey: ["developer-api-keys", accessToken],
    queryFn: () => listDeveloperApiKeys(accessToken!),
    enabled: isSignedIn,
    staleTime: 30_000,
  });

  const oauthClientsQuery = useQuery({
    queryKey: ["developer-oauth-clients", accessToken],
    queryFn: () => listDeveloperOAuthClients(accessToken!),
    enabled: isSignedIn,
    staleTime: 30_000,
  });

  const createKeyMutation = useMutation({
    mutationFn: async () => createDeveloperApiKey(accessToken!, csrfToken!, { name: keyName }),
    onSuccess: async (data) => {
      setKeyName("");
      setCreatedSecret(data.secret);
      await queryClient.invalidateQueries({ queryKey: ["developer-api-keys", accessToken] });
    },
  });

  const createOAuthClientMutation = useMutation({
    mutationFn: async () =>
      createDeveloperOAuthClient(accessToken!, csrfToken!, {
        name: clientName,
        redirectUris: clientRedirectUris
          .split(",")
          .map((uri) => uri.trim())
          .filter(Boolean),
      }),
    onSuccess: async (data) => {
      setClientName("");
      setClientRedirectUris("");
      setCreatedOauthSecret(data.secret);
      await queryClient.invalidateQueries({ queryKey: ["developer-oauth-clients", accessToken] });
    },
  });

  const updateKeyMutation = useMutation({
    mutationFn: async (payload: { keyId: string; enabled: boolean }) =>
      updateDeveloperApiKey(accessToken!, csrfToken!, payload.keyId, { enabled: payload.enabled }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["developer-api-keys", accessToken] });
    },
  });

  const revokeKeyMutation = useMutation({
    mutationFn: async (keyId: string) => revokeDeveloperApiKey(accessToken!, csrfToken!, keyId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["developer-api-keys", accessToken] });
    },
  });

  const updateOAuthClientMutation = useMutation({
    mutationFn: async (payload: { clientId: string; name?: string; redirectUris?: string[]; enabled?: boolean }) =>
      updateDeveloperOAuthClient(accessToken!, csrfToken!, payload.clientId, {
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.redirectUris !== undefined ? { redirectUris: payload.redirectUris } : {}),
        ...(payload.enabled !== undefined ? { enabled: payload.enabled } : {}),
      }),
    onSuccess: async () => {
      setEditingClientId(null);
      await queryClient.invalidateQueries({ queryKey: ["developer-oauth-clients", accessToken] });
    },
  });

  const rotateOAuthClientSecretMutation = useMutation({
    mutationFn: async (clientId: string) => rotateDeveloperOAuthClientSecret(accessToken!, csrfToken!, clientId),
    onSuccess: async (data) => {
      setRotatedOauthSecret(data.secret);
      await queryClient.invalidateQueries({ queryKey: ["developer-oauth-clients", accessToken] });
    },
  });

  const beginEditingClient = (client: DeveloperOAuthClient) => {
    setEditingClientId(client.clientId);
    setEditingClients((previous) => ({
      ...previous,
      [client.clientId]: {
        name: client.name,
        redirectUris: client.redirectUris.join(", "),
      },
    }));
  };

  const cancelEditingClient = () => setEditingClientId(null);

  const updateEditingClientField = (clientId: string, field: keyof typeof editingClients[string], value: string) => {
    setEditingClients((previous) => ({
      ...previous,
      [clientId]: {
        ...previous[clientId],
        [field]: value,
      },
    }));
  };

  const copyText = async (text: string, setter: (value: CopyStatus) => void) => {
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
      setCopyClientIdStatuses((previous) => ({ ...previous, [clientId]: "copied" }));
      window.setTimeout(
        () => setCopyClientIdStatuses((previous) => ({ ...previous, [clientId]: "idle" })),
        2000,
      );
    } catch {
      setCopyClientIdStatuses((previous) => ({ ...previous, [clientId]: "failed" }));
      window.setTimeout(
        () => setCopyClientIdStatuses((previous) => ({ ...previous, [clientId]: "idle" })),
        2000,
      );
    }
  };

  const downloadClientConfig = (client: DeveloperOAuthClient) => {
    const config = {
      client_id: client.clientId,
      redirect_uris: client.redirectUris,
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${client.clientId}-oauth-config.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  const revokeOAuthClientMutation = useMutation({
    mutationFn: async (clientId: string) => revokeDeveloperOAuthClient(accessToken!, csrfToken!, clientId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["developer-oauth-clients", accessToken] });
    },
  });

  return (
    <ExperienceShell
      eyebrow="Settings"
      title="Developer settings"
      subtitle="Manage API keys, webhook secrets, and integration security from one place."
      metrics={isSignedIn ? [{ label: "API keys", value: String(keysQuery.data?.keys.length ?? 0), tone: "amber" }] : []}
      actions={[]}
      maxWidthClassName="max-w-5xl"
    >
      {!isSignedIn ? (
        <div className="rounded-none border border-slate-700/70 bg-slate-950/95 p-8 text-slate-300">Please sign in to manage your developer credentials.</div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
          <div className="space-y-6">
            <section className="rounded-none border border-slate-700/70 bg-slate-950/95 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.32)]">
              <p className="text-[10px] uppercase tracking-[0.28em] text-amber-300">API key management</p>
              <h2 className="mt-4 text-2xl font-semibold text-white">Create a new API key</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">Generate a key for your integrations and keep your secret safe. You will only see the secret once.</p>

              <div className="mt-6 grid gap-4">
                <label className="grid gap-2 text-sm text-slate-300">
                  Key name
                  <input
                    value={keyName}
                    onChange={(event) => setKeyName(event.target.value)}
                    placeholder="My integration key"
                    className="w-full rounded-none border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none focus:border-amber-400"
                  />
                </label>
                <button
                  type="button"
                  disabled={!keyName.trim() || createKeyMutation.isPending}
                  onClick={() => void createKeyMutation.mutateAsync()}
                  className="inline-flex h-12 items-center justify-center rounded-none bg-amber-500 px-5 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {createKeyMutation.isPending ? "Creating key..." : "Generate API key"}
                </button>
                {createdSecret ? (
                  <div className="rounded-none border border-emerald-500/20 bg-emerald-400/5 p-4 text-sm text-emerald-200">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-emerald-100">API key secret</p>
                        <p className="mt-2 break-all text-slate-100">{createdSecret}</p>
                        <p className="mt-2 text-xs text-slate-400">Save this secret now. It will not be shown again.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void copyText(createdSecret, setApiSecretCopyStatus)}
                        className="inline-flex h-10 items-center justify-center rounded-none border border-slate-700 bg-slate-900 px-4 text-xs font-semibold text-slate-200 transition hover:border-amber-400"
                      >
                        {apiSecretCopyStatus === "copied"
                          ? "Copied"
                          : apiSecretCopyStatus === "failed"
                          ? "Copy failed"
                          : "Copy secret"}
                      </button>
                    </div>
                  </div>
                ) : null}
                {createKeyMutation.isError ? (
                  <p className="text-sm text-rose-300">Failed to create the key. Please try again.</p>
                ) : null}
              </div>
            </section>

            <section className="rounded-none border border-slate-700/70 bg-slate-950/95 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.32)]">
              <p className="text-[10px] uppercase tracking-[0.28em] text-amber-300">OAuth client management</p>
              <h2 className="mt-4 text-2xl font-semibold text-white">Create a new OAuth client</h2>
              <p className="mt-3 text-sm leading-7 text-slate-300">Register a client for OAuth redirect flows and keep your credentials secure. The secret is revealed only once.</p>

              <div className="mt-6 grid gap-4">
                <label className="grid gap-2 text-sm text-slate-300">
                  Client name
                  <input
                    value={clientName}
                    onChange={(event) => setClientName(event.target.value)}
                    placeholder="Forge integration client"
                    className="w-full rounded-none border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none focus:border-amber-400"
                  />
                </label>
                <label className="grid gap-2 text-sm text-slate-300">
                  Redirect URIs
                  <input
                    value={clientRedirectUris}
                    onChange={(event) => setClientRedirectUris(event.target.value)}
                    placeholder="https://example.com/oauth/callback, https://app.example.com/oauth/callback"
                    className="w-full rounded-none border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none focus:border-amber-400"
                  />
                  <span className="text-xs text-slate-500">Comma-separated redirect URIs for your OAuth client.</span>
                </label>
                <button
                  type="button"
                  disabled={!clientName.trim() || createOAuthClientMutation.isPending}
                  onClick={() => void createOAuthClientMutation.mutateAsync()}
                  className="inline-flex h-12 items-center justify-center rounded-none bg-amber-500 px-5 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {createOAuthClientMutation.isPending ? "Registering client..." : "Register OAuth client"}
                </button>
                {createdOauthSecret ? (
                  <div className="rounded-none border border-emerald-500/20 bg-emerald-400/5 p-4 text-sm text-emerald-200">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-emerald-100">Client secret</p>
                        <p className="mt-2 break-all text-slate-100">{createdOauthSecret}</p>
                        <p className="mt-2 text-xs text-slate-400">Save this secret now. It will not be shown again.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void copyText(createdOauthSecret, setOauthSecretCopyStatus)}
                        className="inline-flex h-10 items-center justify-center rounded-none border border-slate-700 bg-slate-900 px-4 text-xs font-semibold text-slate-200 transition hover:border-amber-400"
                      >
                        {oauthSecretCopyStatus === "copied"
                          ? "Copied"
                          : oauthSecretCopyStatus === "failed"
                          ? "Copy failed"
                          : "Copy secret"}
                      </button>
                    </div>
                  </div>
                ) : null}
                {createOAuthClientMutation.isError ? (
                  <p className="text-sm text-rose-300">Failed to register the OAuth client. Please try again.</p>
                ) : null}
              </div>
            </section>
          </div>

          <section className="rounded-none border border-slate-700/70 bg-slate-950/95 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.32)]">
            <p className="text-[10px] uppercase tracking-[0.28em] text-amber-300">Your API keys</p>
            <h2 className="mt-4 text-2xl font-semibold text-white">Active credentials</h2>
            <div className="mt-6 space-y-3">
              {keysQuery.isLoading ? (
                <p className="text-sm text-slate-400">Loading your API keys...</p>
              ) : keysQuery.data?.keys.length ? (
                keysQuery.data.keys.map((key) => (
                  <div key={key.id} className="rounded-none border border-slate-700/80 bg-slate-900/80 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-slate-100">{key.name}</p>
                        <p className="mt-1 text-xs text-slate-400">Created {new Date(key.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`rounded-none px-3 py-1 text-xs uppercase tracking-[0.24em] ${key.enabled ? "bg-emerald-400/10 text-emerald-200 border border-emerald-400/20" : "bg-slate-800 text-slate-300 border border-slate-700/70"}`}>
                          {key.enabled ? "Enabled" : "Disabled"}
                        </span>
                        <button
                          type="button"
                          onClick={() => void updateKeyMutation.mutateAsync({ keyId: key.id, enabled: !key.enabled })}
                          className="inline-flex h-10 items-center justify-center rounded-none border border-slate-700 bg-slate-900 px-4 text-xs font-semibold text-slate-200 transition hover:border-amber-400"
                        >
                          {key.enabled ? "Disable" : "Enable"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm("Revoke this API key? This action cannot be undone.")) {
                              void revokeKeyMutation.mutateAsync(key.id);
                            }
                          }}
                          className="inline-flex h-10 items-center justify-center rounded-none border border-rose-500 bg-rose-500/10 px-4 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20"
                        >
                          Revoke
                        </button>
                      </div>
                    </div>
                    {key.lastUsedAt ? <p className="mt-3 text-xs text-slate-500">Last used {new Date(key.lastUsedAt).toLocaleString()}</p> : null}
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400">No API keys created yet. Generate one to get started.</p>
              )}
            </div>
          </section>

          <section className="rounded-none border border-slate-700/70 bg-slate-950/95 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.32)]">
            <p className="text-[10px] uppercase tracking-[0.28em] text-sky-300">OAuth clients</p>
            <h2 className="mt-4 text-2xl font-semibold text-white">Registered OAuth clients</h2>
            <div className="mt-6 space-y-3">
              {oauthClientsQuery.isLoading ? (
                <p className="text-sm text-slate-400">Loading your OAuth clients...</p>
              ) : oauthClientsQuery.data?.clients.length ? (
                oauthClientsQuery.data.clients.map((client) => {
                  const isEditing = editingClientId === client.clientId;
                  const editingState = editingClients[client.clientId] ?? {
                    name: client.name,
                    redirectUris: client.redirectUris.join(", "),
                  };

                  return (
                    <div key={client.id} className="rounded-none border border-slate-700/80 bg-slate-900/80 p-4">
                      {isEditing ? (
                        <div className="space-y-4">
                          <label className="grid gap-2 text-sm text-slate-300">
                            Client name
                            <input
                              value={editingState.name}
                              onChange={(event) => updateEditingClientField(client.clientId, "name", event.target.value)}
                              className="w-full rounded-none border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none focus:border-sky-400"
                            />
                          </label>
                          <label className="grid gap-2 text-sm text-slate-300">
                            Redirect URIs
                            <input
                              value={editingState.redirectUris}
                              onChange={(event) => updateEditingClientField(client.clientId, "redirectUris", event.target.value)}
                              className="w-full rounded-none border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none focus:border-sky-400"
                            />
                            <span className="text-xs text-slate-500">Comma-separated redirect URIs for this client.</span>
                          </label>
                          <div className="flex flex-wrap items-center gap-3">
                            <button
                              type="button"
                              disabled={updateOAuthClientMutation.isPending}
                              onClick={() =>
                                void updateOAuthClientMutation.mutateAsync({
                                  clientId: client.clientId,
                                  name: editingState.name,
                                  redirectUris: editingState.redirectUris
                                    .split(",")
                                    .map((uri) => uri.trim())
                                    .filter(Boolean),
                                })
                              }
                              className="inline-flex h-11 items-center justify-center rounded-none bg-sky-500 px-5 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {updateOAuthClientMutation.isPending ? "Saving..." : "Save changes"}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditingClient}
                              className="inline-flex h-11 items-center justify-center rounded-none border border-slate-700 bg-slate-900 px-5 text-sm font-semibold text-slate-200 transition hover:border-amber-400"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-start justify-between gap-4">
                            <div>
                              <p className="font-semibold text-slate-100">{client.name}</p>
                              <p className="mt-1 text-xs text-slate-400">Client ID: {client.clientId}</p>
                              <p className="mt-2 text-xs text-slate-500">Redirect URIs: {client.redirectUris.length ? client.redirectUris.join(", ") : "None configured"}</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={`rounded-none px-3 py-1 text-xs uppercase tracking-[0.24em] ${client.enabled ? "bg-emerald-400/10 text-emerald-200 border border-emerald-400/20" : "bg-slate-800 text-slate-300 border border-slate-700/70"}`}>
                                {client.enabled ? "Enabled" : "Disabled"}
                              </span>
                              <button
                                type="button"
                                onClick={() => void updateOAuthClientMutation.mutateAsync({ clientId: client.clientId, enabled: !client.enabled })}
                                className="inline-flex h-10 items-center justify-center rounded-none border border-slate-700 bg-slate-900 px-4 text-xs font-semibold text-slate-200 transition hover:border-sky-400"
                              >
                                {client.enabled ? "Disable" : "Enable"}
                              </button>
                              <button
                                type="button"
                                onClick={() => void copyClientIdText(client.clientId, client.clientId)}
                                className="inline-flex h-10 items-center justify-center rounded-none border border-slate-700 bg-slate-900 px-4 text-xs font-semibold text-slate-200 transition hover:border-amber-400"
                              >
                                {copyClientIdStatuses[client.clientId] === "copied"
                                  ? "Copied ID"
                                  : copyClientIdStatuses[client.clientId] === "failed"
                                  ? "Copy failed"
                                  : "Copy ID"}
                              </button>
                              <button
                                type="button"
                                onClick={() => beginEditingClient(client)}
                                className="inline-flex h-10 items-center justify-center rounded-none border border-slate-700 bg-slate-900 px-4 text-xs font-semibold text-slate-200 transition hover:border-amber-400"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm("Revoke this OAuth client? Its client secret will no longer work.")) {
                                    void revokeOAuthClientMutation.mutateAsync(client.clientId);
                                  }
                                }}
                                className="inline-flex h-10 items-center justify-center rounded-none border border-rose-500 bg-rose-500/10 px-4 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20"
                              >
                                Revoke
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (window.confirm("Rotate this OAuth client secret? The current secret will be invalidated immediately.")) {
                                    void rotateOAuthClientSecretMutation.mutateAsync(client.clientId);
                                  }
                                }}
                                className="inline-flex h-10 items-center justify-center rounded-none border border-emerald-500 bg-emerald-500/10 px-4 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/20"
                              >
                                Rotate secret
                              </button>
                              <button
                                type="button"
                                onClick={() => downloadClientConfig(client)}
                                className="inline-flex h-10 items-center justify-center rounded-none border border-slate-700 bg-slate-900 px-4 text-xs font-semibold text-slate-200 transition hover:border-slate-400"
                              >
                                Download config
                              </button>
                            </div>
                          </div>
                        </>
                      )}
                      <p className="mt-3 text-xs text-slate-500">Last updated {new Date(client.updatedAt).toLocaleString()}</p>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-slate-400">No OAuth clients registered yet. Create one above to begin redirect flows.</p>
              )}
            </div>
          </section>

          {rotatedOauthSecret ? (
            <section className="rounded-none border border-emerald-500/20 bg-emerald-400/5 p-6 text-slate-100 shadow-[0_30px_90px_rgba(0,0,0,0.32)]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-emerald-100">New client secret</p>
                  <p className="mt-3 break-all text-slate-100">{rotatedOauthSecret}</p>
                  <p className="mt-2 text-xs text-slate-300">Save this secret now. It will not be shown again.</p>
                </div>
                <button
                  type="button"
                  onClick={() => void copyText(rotatedOauthSecret, setRotatedSecretCopyStatus)}
                  className="inline-flex h-10 items-center justify-center rounded-none border border-slate-700 bg-slate-900 px-4 text-xs font-semibold text-slate-200 transition hover:border-amber-400"
                >
                  {rotatedSecretCopyStatus === "copied"
                    ? "Copied"
                    : rotatedSecretCopyStatus === "failed"
                    ? "Copy failed"
                    : "Copy secret"}
                </button>
              </div>
            </section>
          ) : null}
        </div>
      )}
    </ExperienceShell>
  );
}

