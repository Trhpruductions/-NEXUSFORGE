"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth-store";
import { copyToClipboard, type CopyStatus } from "@/lib/clipboard";
import { listBotCatalog, listDeveloperApiKeys, listDeveloperOAuthClients, listMyBots, createBotApp } from "@/lib/api";
import { ExperienceShell } from "@/components/layout/experience-shell";
import { GuestAuthCallout } from "@/components/auth/guest-auth-callout";

export default function DeveloperPortalPage() {
  const { user, accessToken, csrfToken } = useAuthStore();
  const isSignedIn = Boolean(user && accessToken && csrfToken);
  const queryClient = useQueryClient();

  const [botName, setBotName] = useState("");
  const [botDescription, setBotDescription] = useState("");
  const [botCopyStatuses, setBotCopyStatuses] = useState<Record<string, CopyStatus>>({});

  const myBotsQuery = useQuery({
    queryKey: ["developer-my-bots", accessToken],
    queryFn: () => listMyBots(accessToken!),
    enabled: isSignedIn,
    staleTime: 30_000,
  });

  const apiKeysQuery = useQuery({
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

  const catalogQuery = useQuery({
    queryKey: ["developer-bot-catalog", accessToken],
    queryFn: () => listBotCatalog(accessToken!, undefined),
    enabled: isSignedIn,
    staleTime: 30_000,
  });

  const createBotMutation = useMutation({
    mutationFn: async () =>
      createBotApp(accessToken!, csrfToken!, {
        name: botName,
        description: botDescription,
      }),
    onSuccess: async () => {
      setBotName("");
      setBotDescription("");
      await queryClient.invalidateQueries({ queryKey: ["developer-my-bots", accessToken] });
      await queryClient.invalidateQueries({ queryKey: ["developer-bot-catalog", accessToken] });
    },
  });

  const totalApps = myBotsQuery.data?.bots.length ?? 0;
  const totalApiKeys = apiKeysQuery.data?.keys.length ?? 0;
  const totalOAuthClients = oauthClientsQuery.data?.clients.length ?? 0;
  const totalListings = catalogQuery.data?.bots.length ?? 0;
  const loading = myBotsQuery.isLoading || catalogQuery.isLoading || apiKeysQuery.isLoading || oauthClientsQuery.isLoading;

  const copyInviteCode = async (inviteCode: string, botId: string) => {
    try {
      await copyToClipboard(inviteCode);
      setBotCopyStatuses((previous) => ({ ...previous, [botId]: "copied" }));
      window.setTimeout(() => setBotCopyStatuses((previous) => ({ ...previous, [botId]: "idle" })), 2000);
    } catch {
      setBotCopyStatuses((previous) => ({ ...previous, [botId]: "failed" }));
      window.setTimeout(() => setBotCopyStatuses((previous) => ({ ...previous, [botId]: "idle" })), 2000);
    }
  };

  return (
    <ExperienceShell
      eyebrow="Developer Portal"
      title="Build and manage your NexusForge integrations"
      subtitle="Create bots, manage API tools, and monitor developer activity from one streamlined portal."
      metrics={
        isSignedIn
          ? [
              { label: "Your Applications", value: totalApps.toString(), tone: "amber" },
              { label: "API keys", value: totalApiKeys.toString(), tone: "cyan" },
              { label: "OAuth clients", value: totalOAuthClients.toString(), tone: "emerald" },
              { label: "Marketplace listings", value: totalListings.toString(), tone: "emerald" },
            ]
          : []
      }
      actions={
        isSignedIn
          ? [
              { label: "Create new bot", href: "/developer/applications", tone: "primary" },
              { label: "Marketplace", href: "/developer/bots", tone: "ghost" },
              { label: "Settings", href: "/developer/settings", tone: "ghost" },
              { label: "Webhooks", href: "/developer/webhooks", tone: "ghost" },
            ]
          : [
              { label: "Sign in", href: "/login?redirect=/developer", tone: "ghost" },
              { label: "Create account", href: "/register?redirect=/developer", tone: "primary" },
            ]
      }
      maxWidthClassName="max-w-5xl"
    >
      {!isSignedIn ? (
        <GuestAuthCallout
          title="Developer tools require a NexusForge account."
          description="Sign in to access bot creation, API key management, slash commands, and integration analytics."
          loginHref="/login?redirect=/developer"
          registerHref="/register?redirect=/developer"
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.25fr_0.9fr]">
          <section className="rounded-[28px] border border-slate-900/10 bg-white/85 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <p className="text-[10px] uppercase tracking-[0.28em] text-amber-600">Developer hub</p>
            <h2 className="mt-4 text-2xl font-semibold text-slate-950">Launch your integrations</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Build bots, automate workflows, and keep your integrations secure with centralized controls for every developer asset.
            </p>

            <div className="mt-6 grid gap-4 sm:grid-cols-2">
              {[
                {
                  label: "Create bot",
                  description: "Start a bot integration and generate your first invite code.",
                  href: "/developer/applications",
                },
                {
                  label: "Manage credentials",
                  description: "Rotate secrets, revoke credentials, and keep your auth flows secure.",
                  href: "/developer/settings",
                },
                {
                  label: "Authorize integrations",
                  description: "Build and test OAuth flows with client credentials and auth code exchange.",
                  href: "/developer/oauth",
                },
                {
                  label: "Marketplace preview",
                  description: "See public Discord bot listings and discover publishing options.",
                  href: "/developer/bots",
                },
              ].map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="rounded-[24px] border border-slate-900/10 bg-slate-50 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)] transition hover:border-amber-300 hover:bg-white"
                >
                    <p className="text-sm font-semibold text-slate-950">{item.label}</p>
                    <p className="mt-2 text-sm text-slate-600">{item.description}</p>
                </Link>
              ))}
            </div>

              <div className="mt-10 rounded-[28px] border border-slate-900/10 bg-white/85 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.07)]">
              <div className="flex flex-col gap-3">
                <div>
                    <p className="text-[10px] uppercase tracking-[0.28em] text-amber-600">Create a new bot</p>
                    <h3 className="mt-2 text-xl font-semibold text-slate-950">Start a bot integration</h3>
                </div>

                <div className="grid gap-4">
                    <label className="grid gap-2 text-sm text-slate-600">
                    Bot name
                    <input
                      value={botName}
                      onChange={(event) => setBotName(event.target.value)}
                      placeholder="e.g. NexusForge Helper"
                        className="w-full rounded-[20px] border border-slate-900/10 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-300"
                    />
                  </label>

                    <label className="grid gap-2 text-sm text-slate-600">
                    Description
                    <textarea
                      value={botDescription}
                      onChange={(event) => setBotDescription(event.target.value)}
                      placeholder="A short summary of your bot's purpose"
                      rows={3}
                        className="w-full rounded-[20px] border border-slate-900/10 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-amber-300"
                    />
                  </label>

                  <button
                    type="button"
                    disabled={!botName.trim() || createBotMutation.isPending}
                    onClick={() => void createBotMutation.mutateAsync()}
                    className="inline-flex items-center justify-center rounded-full bg-amber-500 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {createBotMutation.isPending ? "Creating..." : "Create bot"}
                  </button>

                  {createBotMutation.isError ? (
                    <p className="text-sm text-rose-300">Failed to create bot. Try again.</p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-10 rounded-[28px] border border-slate-900/10 bg-white/85 p-6 shadow-[0_18px_45px_rgba(15,23,42,0.07)]">
              <p className="text-[10px] uppercase tracking-[0.28em] text-amber-600">Your applications</p>
              <div className="mt-4 space-y-3">
                {loading ? (
                  <p className="text-sm text-slate-600">Loading your developer assets...</p>
                ) : myBotsQuery.data?.bots.length ? (
                  myBotsQuery.data.bots.map((bot) => (
                    <div key={bot.id} className="rounded-[24px] border border-slate-900/10 bg-slate-50 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">{bot.name}</p>
                          <p className="mt-1 text-xs text-slate-600">{bot.description ?? "No description provided"}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => void copyInviteCode(bot.inviteCode, bot.id)}
                            className="inline-flex h-9 items-center justify-center rounded-full border border-slate-900/10 bg-white px-3 text-xs font-semibold text-slate-900 transition hover:bg-slate-50"
                          >
                            {botCopyStatuses[bot.id] === "copied"
                              ? "Copied"
                              : botCopyStatuses[bot.id] === "failed"
                              ? "Copy failed"
                              : "Copy code"}
                          </button>
                          <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-amber-700">
                            {bot.isPublic ? "Public" : "Private"}
                          </span>
                        </div>
                      </div>
                      <p className="mt-3 text-xs text-slate-500">Invite code: {bot.inviteCode}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-slate-600">You don&apos;t have any bot apps yet. Create one above to get started.</p>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-900/10 bg-white/85 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <p className="text-[10px] uppercase tracking-[0.28em] text-amber-600">Marketplace preview</p>
            <h2 className="mt-4 text-2xl font-semibold text-slate-950">Live integration listings</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">Browse public bot apps and discover how other developers publish their work.</p>

            <div className="mt-6 space-y-3">
              {loading ? (
                <p className="text-sm text-slate-600">Loading marketplace preview...</p>
              ) : catalogQuery.data?.bots.length ? (
                catalogQuery.data.bots.slice(0, 5).map((bot) => (
                  <div key={bot.id} className="rounded-[24px] border border-slate-900/10 bg-slate-50 p-4 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-950">{bot.name}</p>
                        <p className="mt-1 text-slate-600">{bot.description ?? "No description available"}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void copyInviteCode(bot.inviteCode, bot.id)}
                        className="inline-flex h-9 items-center justify-center rounded-full border border-slate-900/10 bg-white px-3 text-xs font-semibold text-slate-900 transition hover:bg-slate-50"
                      >
                        {botCopyStatuses[bot.id] === "copied"
                          ? "Copied"
                          : botCopyStatuses[bot.id] === "failed"
                          ? "Copy failed"
                          : "Copy code"}
                      </button>
                    </div>
                    <p className="mt-3 text-xs text-slate-500">Invite code: {bot.inviteCode}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-600">No marketplace listings are available right now.</p>
              )}
            </div>

            <div className="mt-8 rounded-[24px] border border-slate-900/10 bg-slate-50 p-5">
              <p className="text-sm text-slate-900">Developer resources</p>
              <ul className="mt-3 space-y-2 text-sm text-slate-600">
                <li>• API keys and webhook configuration are available in the Developer settings.</li>
                <li>• Slash command creation and permissions management.</li>
                <li>• Analytics, logs, and bot publishing tools.</li>
              </ul>
            </div>
          </section>
        </div>
      )}
    </ExperienceShell>
  );
}

