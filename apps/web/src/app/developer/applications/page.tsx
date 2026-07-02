"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth-store";
import { copyToClipboard, type CopyStatus } from "@/lib/clipboard";
import { listMyBots, createBotApp, updateBotApp, deleteBotApp, type BotApp } from "@/lib/api";
import { ExperienceShell } from "@/components/layout/experience-shell";

export default function DeveloperApplicationsPage() {
  const { user, accessToken, csrfToken } = useAuthStore();
  const isSignedIn = Boolean(user && accessToken && csrfToken);
  const queryClient = useQueryClient();
  const [botName, setBotName] = useState("");
  const [botDescription, setBotDescription] = useState("");
  const [editingBotId, setEditingBotId] = useState<string | null>(null);
  const [editingBots, setEditingBots] = useState<Record<string, { name: string; description: string; isPublic: boolean }>>({});
  const [inviteCopyStatuses, setInviteCopyStatuses] = useState<Record<string, CopyStatus>>({});

  const myBotsQuery = useQuery({
    queryKey: ["developer-my-bots", accessToken],
    queryFn: () => listMyBots(accessToken!),
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
    },
  });

  const updateBotMutation = useMutation({
    mutationFn: async (payload: { botId: string; data: { name?: string; description?: string; isPublic?: boolean } }) =>
      updateBotApp(accessToken!, csrfToken!, payload.botId, payload.data),
    onSuccess: async () => {
      setEditingBotId(null);
      await queryClient.invalidateQueries({ queryKey: ["developer-my-bots", accessToken] });
    },
  });

  const deleteBotMutation = useMutation({
    mutationFn: async (botId: string) => deleteBotApp(accessToken!, csrfToken!, botId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["developer-my-bots", accessToken] });
    },
  });

  const beginEditingBot = (bot: BotApp) => {
    setEditingBotId(bot.id);
    setEditingBots((previous) => ({
      ...previous,
      [bot.id]: {
        name: bot.name,
        description: bot.description ?? "",
        isPublic: Boolean(bot.isPublic),
      },
    }));
  };

  const cancelEditing = () => {
    setEditingBotId(null);
  };

  const copyText = async (text: string, key: string) => {
    try {
      await copyToClipboard(text);
      setInviteCopyStatuses((previous) => ({ ...previous, [key]: "copied" }));
      window.setTimeout(() => setInviteCopyStatuses((previous) => ({ ...previous, [key]: "idle" })), 2000);
    } catch {
      setInviteCopyStatuses((previous) => ({ ...previous, [key]: "failed" }));
      window.setTimeout(() => setInviteCopyStatuses((previous) => ({ ...previous, [key]: "idle" })), 2000);
    }
  };

  const updateEditingField = (botId: string, field: keyof typeof editingBots[string], value: string | boolean) => {
    setEditingBots((previous) => ({
      ...previous,
      [botId]: {
        ...previous[botId],
        [field]: value,
      },
    }));
  };

  return (
    <ExperienceShell
      eyebrow="Applications"
      title="Your bot applications"
      subtitle="Manage your NexusForge bots and create new app integrations from this section."
      metrics={isSignedIn ? [{ label: "Your bots", value: String(myBotsQuery.data?.bots.length ?? 0), tone: "amber" }] : []}
      actions={[]}
      maxWidthClassName="max-w-5xl"
    >
      {!isSignedIn ? (
        <div className="rounded-[28px] border border-slate-900/10 bg-white/85 p-8 text-slate-600 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">Please sign in to manage your applications.</div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
          <section className="rounded-[28px] border border-slate-900/10 bg-white/85 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <p className="text-[10px] uppercase tracking-[0.28em] text-amber-600">Create new app</p>
            <h2 className="mt-4 text-2xl font-semibold text-slate-950">New bot application</h2>
            <div className="mt-6 grid gap-4">
              <label className="grid gap-2 text-sm text-slate-600">
                Bot name
                <input
                  value={botName}
                  onChange={(event) => setBotName(event.target.value)}
                  placeholder="NexusForge Assistant"
                  className="w-full rounded-[20px] border border-slate-900/10 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-amber-300"
                />
              </label>
              <label className="grid gap-2 text-sm text-slate-600">
                Description
                <textarea
                  value={botDescription}
                  onChange={(event) => setBotDescription(event.target.value)}
                  rows={3}
                  placeholder="A short description of the bot"
                  className="w-full rounded-[20px] border border-slate-900/10 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-amber-300"
                />
              </label>
              <button
                type="button"
                disabled={!botName.trim() || createBotMutation.isPending}
                onClick={() => void createBotMutation.mutateAsync()}
                className="inline-flex h-12 items-center justify-center rounded-full bg-amber-500 px-5 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {createBotMutation.isPending ? "Creating..." : "Create application"}
              </button>
              {createBotMutation.isError ? (
                <p className="text-sm text-rose-300">Failed to create the bot. Please try again.</p>
              ) : null}
            </div>
          </section>

          <section className="rounded-[28px] border border-slate-900/10 bg-white/85 p-6 shadow-[0_24px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl">
            <p className="text-[10px] uppercase tracking-[0.28em] text-amber-600">Your applications</p>
            <h2 className="mt-4 text-2xl font-semibold text-slate-950">Existing bot apps</h2>
            <div className="mt-6 space-y-3">
              {myBotsQuery.isLoading ? (
                <p className="text-sm text-slate-600">Loading your apps...</p>
              ) : myBotsQuery.data?.bots.length ? (
                myBotsQuery.data.bots.map((bot) => {
                  const isEditing = editingBotId === bot.id;
                  const editingState = editingBots[bot.id] ?? {
                    name: bot.name,
                    description: bot.description ?? "",
                    isPublic: Boolean(bot.isPublic),
                  };

                  return (
                    <div key={bot.id} className="rounded-[24px] border border-slate-900/10 bg-slate-50 p-4">
                      {isEditing ? (
                        <div className="space-y-4">
                          <label className="grid gap-2 text-sm text-slate-600">
                            Bot name
                            <input
                              value={editingState.name}
                              onChange={(event) => updateEditingField(bot.id, "name", event.target.value)}
                              className="w-full rounded-[20px] border border-slate-900/10 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-amber-300"
                            />
                          </label>
                          <label className="grid gap-2 text-sm text-slate-600">
                            Description
                            <textarea
                              value={editingState.description}
                              onChange={(event) => updateEditingField(bot.id, "description", event.target.value)}
                              rows={3}
                              className="w-full rounded-[20px] border border-slate-900/10 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-amber-300"
                            />
                          </label>
                          <div className="flex flex-wrap items-center gap-3">
                            <label className="inline-flex items-center gap-2 text-sm text-slate-600">
                              <input
                                type="checkbox"
                                checked={editingState.isPublic}
                                onChange={(event) => updateEditingField(bot.id, "isPublic", event.target.checked)}
                                className="h-4 w-4 rounded border-slate-300 bg-white text-amber-500 focus:ring-amber-300"
                              />
                              Public listing
                            </label>
                            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs uppercase tracking-[0.24em] text-amber-700">
                              {editingState.isPublic ? "Public" : "Private"}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-3">
                            <button
                              type="button"
                              disabled={updateBotMutation.isPending}
                              onClick={() =>
                                void updateBotMutation.mutateAsync({
                                  botId: bot.id,
                                  data: {
                                    name: editingState.name,
                                    description: editingState.description,
                                    isPublic: editingState.isPublic,
                                  },
                                })
                              }
                              className="inline-flex h-11 items-center justify-center rounded-full bg-amber-500 px-5 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {updateBotMutation.isPending ? "Saving..." : "Save changes"}
                            </button>
                            <button
                              type="button"
                              onClick={cancelEditing}
                              className="inline-flex h-11 items-center justify-center rounded-full border border-slate-900/10 bg-white px-5 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                            >
                              Cancel
                            </button>
                          </div>
                          {updateBotMutation.isError ? (
                            <p className="text-sm text-rose-300">Failed to update bot. Try again.</p>
                          ) : null}
                        </div>
                      ) : (
                        <>
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="font-semibold text-slate-950">{bot.name}</p>
                              <p className="mt-1 text-sm text-slate-600">{bot.description ?? "No description provided."}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => beginEditingBot(bot)}
                              className="inline-flex h-10 items-center justify-center rounded-full border border-slate-900/10 bg-white px-4 text-sm font-semibold text-slate-900 transition hover:bg-slate-50"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (window.confirm("Delete this bot application? This action cannot be undone.")) {
                                  void deleteBotMutation.mutateAsync(bot.id);
                                }
                              }}
                              className="inline-flex h-10 items-center justify-center rounded-full border border-rose-200 bg-rose-50 px-4 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
                            >
                              Delete
                            </button>
                          </div>
                          <div className="mt-3 grid gap-3 text-xs text-slate-500 sm:grid-cols-[1fr_auto] sm:items-center">
                            <div className="flex flex-wrap items-center gap-2">
                              <span>Invite code: {bot.inviteCode}</span>
                              <button
                                type="button"
                                onClick={() => void copyText(bot.inviteCode, bot.id)}
                                className="inline-flex h-8 items-center justify-center rounded-full border border-slate-900/10 bg-white px-3 text-[11px] font-semibold text-slate-900 transition hover:bg-slate-50"
                              >
                                {inviteCopyStatuses[bot.id] === "copied"
                                  ? "Copied"
                                  : inviteCopyStatuses[bot.id] === "failed"
                                  ? "Copy failed"
                                  : "Copy"}
                              </button>
                            </div>
                            <span className="inline-flex items-center justify-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-amber-700">
                              {bot.isPublic ? "Public" : "Private"}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-slate-600">You haven&apos;t created any bot applications yet.</p>
              )}
            </div>
          </section>
        </div>
      )}
    </ExperienceShell>
  );
}

