"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth-store";
import { copyToClipboard, type CopyStatus } from "@/lib/clipboard";
import { listBotCatalog } from "@/lib/api";
import { ExperienceShell } from "@/components/layout/experience-shell";

export default function DeveloperBotsPage() {
  const { user, accessToken } = useAuthStore();
  const isSignedIn = Boolean(user && accessToken);
  const [copyStatuses, setCopyStatuses] = useState<Record<string, CopyStatus>>({});

  const catalogQuery = useQuery({
    queryKey: ["developer-bot-catalog", accessToken],
    queryFn: () => listBotCatalog(accessToken!, undefined),
    enabled: isSignedIn,
    staleTime: 30_000,
  });

  const copyInviteCode = async (inviteCode: string, botId: string) => {
    try {
      await copyToClipboard(inviteCode);
      setCopyStatuses((previous) => ({ ...previous, [botId]: "copied" }));
      window.setTimeout(() => setCopyStatuses((previous) => ({ ...previous, [botId]: "idle" })), 2000);
    } catch {
      setCopyStatuses((previous) => ({ ...previous, [botId]: "failed" }));
      window.setTimeout(() => setCopyStatuses((previous) => ({ ...previous, [botId]: "idle" })), 2000);
    }
  };

  return (
    <ExperienceShell
      eyebrow="Marketplace"
      title="Integration marketplace"
      subtitle="Browse public NexusForge bots and get inspiration for your next integration."
      metrics={isSignedIn ? [{ label: "Bot listings", value: String(catalogQuery.data?.bots.length ?? 0), tone: "emerald" }] : []}
      actions={[]}
      maxWidthClassName="max-w-5xl"
    >
      {!isSignedIn ? (
        <div className="rounded-none border border-slate-700/70 bg-slate-950/95 p-8 text-slate-300">Sign in to view marketplace integrations.</div>
      ) : (
        <div className="grid gap-4">
          {catalogQuery.isLoading ? (
            <p className="text-sm text-slate-400">Loading marketplace apps...</p>
          ) : catalogQuery.data?.bots.length ? (
            <div className="grid gap-4">
              {catalogQuery.data.bots.map((bot) => (
                <div key={bot.id} className="rounded-none border border-slate-700/80 bg-slate-900/80 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.22)]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-white">{bot.name}</p>
                      <p className="mt-1 text-sm text-slate-400">{bot.description ?? "No description available."}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void copyInviteCode(bot.inviteCode, bot.id)}
                        className="inline-flex h-10 items-center justify-center rounded-none border border-slate-700 bg-slate-900 px-4 text-xs font-semibold text-slate-200 transition hover:border-amber-400"
                      >
                        {copyStatuses[bot.id] === "copied"
                          ? "Copied"
                          : copyStatuses[bot.id] === "failed"
                          ? "Copy failed"
                          : "Copy code"}
                      </button>
                      <span className="rounded-none border border-amber-400/20 bg-amber-400/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-amber-200">
                        {bot.isPublic ? "Public" : "Private"}
                      </span>
                    </div>
                  </div>
                  <p className="mt-4 text-xs text-slate-500">Invite code: {bot.inviteCode}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400">No marketplace integrations are available at the moment.</p>
          )}
        </div>
      )}
    </ExperienceShell>
  );
}

