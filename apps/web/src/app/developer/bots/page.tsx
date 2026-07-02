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
        <div className="rounded-[28px] border border-slate-900/10 bg-white/85 p-8 text-slate-600 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">Sign in to view marketplace integrations.</div>
      ) : (
        <div className="grid gap-4">
          {catalogQuery.isLoading ? (
            <p className="text-sm text-slate-600">Loading marketplace apps...</p>
          ) : catalogQuery.data?.bots.length ? (
            <div className="grid gap-4">
              {catalogQuery.data.bots.map((bot) => (
                <div key={bot.id} className="rounded-[24px] border border-slate-900/10 bg-white/85 p-5 shadow-[0_12px_30px_rgba(15,23,42,0.06)]">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-lg font-semibold text-slate-950">{bot.name}</p>
                      <p className="mt-1 text-sm text-slate-600">{bot.description ?? "No description available."}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void copyInviteCode(bot.inviteCode, bot.id)}
                        className="inline-flex h-10 items-center justify-center rounded-full border border-slate-900/10 bg-white px-4 text-xs font-semibold text-slate-900 transition hover:bg-slate-50"
                      >
                        {copyStatuses[bot.id] === "copied"
                          ? "Copied"
                          : copyStatuses[bot.id] === "failed"
                          ? "Copy failed"
                          : "Copy code"}
                      </button>
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs uppercase tracking-[0.24em] text-amber-700">
                        {bot.isPublic ? "Public" : "Private"}
                      </span>
                    </div>
                  </div>
                  <p className="mt-4 text-xs text-slate-500">Invite code: {bot.inviteCode}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-600">No marketplace integrations are available at the moment.</p>
          )}
        </div>
      )}
    </ExperienceShell>
  );
}

