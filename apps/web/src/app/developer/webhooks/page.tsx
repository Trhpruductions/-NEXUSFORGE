"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth-store";
import { copyToClipboard, type CopyStatus } from "@/lib/clipboard";
import {
  listDeveloperWebhooks,
  createDeveloperWebhook,
  updateDeveloperWebhook,
  deleteDeveloperWebhook,
  testDeveloperWebhook,
} from "@/lib/api";
import { ExperienceShell } from "@/components/layout/experience-shell";

export default function DeveloperWebhooksPage() {
  const { user, accessToken, csrfToken } = useAuthStore();
  const isSignedIn = Boolean(user && accessToken && csrfToken);
  const queryClient = useQueryClient();
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [events, setEvents] = useState("");
  const [createdSecret, setCreatedSecret] = useState<string | null>(null);
  const [createdSecretCopyStatus, setCreatedSecretCopyStatus] = useState<CopyStatus>("idle");
  const [testResults, setTestResults] = useState<Record<string, string>>({});

  const webhooksQuery = useQuery({
    queryKey: ["developer-webhooks", accessToken],
    queryFn: () => listDeveloperWebhooks(accessToken!),
    enabled: isSignedIn,
    staleTime: 30_000,
  });

  const createWebhookMutation = useMutation({
    mutationFn: async () =>
      createDeveloperWebhook(accessToken!, csrfToken!, {
        url,
        description,
        events: events.split(",").map((event) => event.trim()).filter(Boolean),
      }),
    onSuccess: async (data) => {
      setUrl("");
      setDescription("");
      setEvents("");
      setCreatedSecret(data.secret);
      await queryClient.invalidateQueries({ queryKey: ["developer-webhooks", accessToken] });
    },
  });

  const toggleWebhookMutation = useMutation({
    mutationFn: async (payload: { webhookId: string; enabled: boolean }) =>
      updateDeveloperWebhook(accessToken!, csrfToken!, payload.webhookId, { enabled: payload.enabled }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["developer-webhooks", accessToken] });
    },
  });

  const deleteWebhookMutation = useMutation({
    mutationFn: async (webhookId: string) => deleteDeveloperWebhook(accessToken!, csrfToken!, webhookId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["developer-webhooks", accessToken] });
    },
  });

  const testWebhookMutation = useMutation({
    mutationFn: async (webhookId: string) => testDeveloperWebhook(accessToken!, csrfToken!, webhookId),
    onSuccess: async (data, webhookId) => {
      setTestResults((previous) => ({
        ...previous,
        [webhookId]: `Status ${data.status}: ${data.response || "Success"}`,
      }));
    },
    onError: (error, webhookId) => {
      const message = error instanceof Error ? error.message : "Webhook test failed";
      setTestResults((previous) => ({ ...previous, [webhookId]: message }));
    },
  });

  return (
    <ExperienceShell
      eyebrow="Webhooks"
      title="Webhook management"
      subtitle="Configure event delivery endpoints and secure your integration webhooks."
      metrics={isSignedIn ? [{ label: "Webhooks", value: String(webhooksQuery.data?.webhooks.length ?? 0), tone: "amber" }] : []}
      actions={[]}
      maxWidthClassName="max-w-5xl"
    >
      {!isSignedIn ? (
        <div className="rounded-none border border-slate-700/70 bg-slate-950/95 p-8 text-slate-300">Please sign in to configure webhooks.</div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
          <section className="rounded-none border border-slate-700/70 bg-slate-950/95 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.32)]">
            <p className="text-[10px] uppercase tracking-[0.28em] text-amber-300">Register endpoint</p>
            <h2 className="mt-4 text-2xl font-semibold text-white">Create a webhook</h2>
            <p className="mt-3 text-sm leading-7 text-slate-300">Enter your endpoint URL and choose the events you want delivered.</p>

            <div className="mt-6 grid gap-4">
              <label className="grid gap-2 text-sm text-slate-300">
                Endpoint URL
                <input
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://example.com/webhooks/nexusforge"
                  className="w-full rounded-none border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none focus:border-amber-400"
                />
              </label>
              <label className="grid gap-2 text-sm text-slate-300">
                Description
                <input
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Bot command audit webhook"
                  className="w-full rounded-none border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none focus:border-amber-400"
                />
              </label>
              <label className="grid gap-2 text-sm text-slate-300">
                Events
                <input
                  value={events}
                  onChange={(event) => setEvents(event.target.value)}
                  placeholder="bot.command.executed, forge.joined"
                  className="w-full rounded-none border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-slate-100 outline-none focus:border-amber-400"
                />
                <span className="text-xs text-slate-500">Comma-separated event names. Leave blank to receive all events.</span>
              </label>
              <button
                type="button"
                disabled={!url.trim() || createWebhookMutation.isPending}
                onClick={() => void createWebhookMutation.mutateAsync()}
                className="inline-flex h-12 items-center justify-center rounded-none bg-amber-500 px-5 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {createWebhookMutation.isPending ? "Creating webhook..." : "Register webhook"}
              </button>
              {createdSecret ? (
                <div className="rounded-none border border-emerald-500/20 bg-emerald-400/5 p-4 text-sm text-emerald-200">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-emerald-100">Webhook secret</p>
                      <p className="mt-2 break-all text-slate-100">{createdSecret}</p>
                      <p className="mt-2 text-xs text-slate-400">Copy this secret now. It will not be shown again.</p>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await copyToClipboard(createdSecret);
                          setCreatedSecretCopyStatus("copied");
                          window.setTimeout(() => setCreatedSecretCopyStatus("idle"), 2000);
                        } catch {
                          setCreatedSecretCopyStatus("failed");
                          window.setTimeout(() => setCreatedSecretCopyStatus("idle"), 2000);
                        }
                      }}
                      className="inline-flex h-10 items-center justify-center rounded-none border border-slate-700 bg-slate-900 px-4 text-xs font-semibold text-slate-200 transition hover:border-amber-400"
                    >
                      {createdSecretCopyStatus === "copied"
                        ? "Copied"
                        : createdSecretCopyStatus === "failed"
                        ? "Copy failed"
                        : "Copy secret"}
                    </button>
                  </div>
                </div>
              ) : null}
              {createWebhookMutation.isError ? (
                <p className="text-sm text-rose-300">Failed to create webhook. Please try again.</p>
              ) : null}
            </div>
          </section>

          <section className="rounded-none border border-slate-700/70 bg-slate-950/95 p-6 shadow-[0_30px_90px_rgba(0,0,0,0.32)]">
            <p className="text-[10px] uppercase tracking-[0.28em] text-amber-300">Registered webhooks</p>
            <h2 className="mt-4 text-2xl font-semibold text-white">Your webhook endpoints</h2>
            <div className="mt-6 space-y-3">
              {webhooksQuery.isLoading ? (
                <p className="text-sm text-slate-400">Loading your webhooks...</p>
              ) : webhooksQuery.data?.webhooks.length ? (
                webhooksQuery.data.webhooks.map((webhook) => (
                  <div key={webhook.id} className="rounded-none border border-slate-700/80 bg-slate-900/80 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="font-semibold text-slate-100">{webhook.url}</p>
                        <p className="mt-1 text-sm text-slate-400">{webhook.description ?? "No description provided."}</p>
                        <p className="mt-2 text-xs text-slate-500">Events: {webhook.events.length ? webhook.events.join(", ") : "All events"}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`rounded-none px-3 py-1 text-xs uppercase tracking-[0.24em] ${webhook.enabled ? "bg-emerald-400/10 text-emerald-200 border border-emerald-400/20" : "bg-slate-800 text-slate-300 border border-slate-700/70"}`}>
                          {webhook.enabled ? "Enabled" : "Disabled"}
                        </span>
                        <button
                          type="button"
                          onClick={() => void toggleWebhookMutation.mutateAsync({ webhookId: webhook.id, enabled: !webhook.enabled })}
                          className="inline-flex h-10 items-center justify-center rounded-none border border-slate-700 bg-slate-900 px-4 text-xs font-semibold text-slate-200 transition hover:border-amber-400"
                        >
                          {webhook.enabled ? "Disable" : "Enable"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void testWebhookMutation.mutateAsync(webhook.id)}
                          className="inline-flex h-10 items-center justify-center rounded-none border border-sky-500 bg-sky-500/10 px-4 text-xs font-semibold text-sky-200 transition hover:bg-sky-500/20"
                        >
                          Test
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (window.confirm("Delete this webhook subscription? This action cannot be undone.")) {
                              void deleteWebhookMutation.mutateAsync(webhook.id);
                            }
                          }}
                          className="inline-flex h-10 items-center justify-center rounded-none border border-rose-500 bg-rose-500/10 px-4 text-xs font-semibold text-rose-200 transition hover:bg-rose-500/20"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                    <p className="mt-3 text-xs text-slate-500">Last updated {new Date(webhook.updatedAt).toLocaleString()}</p>
                    {testResults[webhook.id] ? (
                      <p className="mt-2 text-xs text-slate-300">Test result: {testResults[webhook.id]}</p>
                    ) : null}
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-400">No webhooks registered yet. Add one above to begin event delivery.</p>
              )}
            </div>
          </section>
        </div>
      )}
    </ExperienceShell>
  );
}

