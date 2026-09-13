"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Building2, Crown, Gamepad2, Hash, Link2, Loader2, MessageSquare, Plus, Settings2, Users, Users2, X, Zap, BookOpen } from "lucide-react";
import { createForge, getApiErrorMessage, getUnreadSummary, joinForge, listForges, type Forge } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/auth-store";
import { useWorkspaceStore } from "@/store/workspace-store";

const panel = "rounded-2xl border border-amber-500/15 bg-[#0d1119] p-4";
const inputClass = "h-10 w-full rounded-lg border border-white/10 bg-[#11151e] px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-400/60";
const goldBtn = "inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-950 transition hover:bg-amber-300 disabled:opacity-50";
const ghostBtn = "inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200 transition hover:border-amber-400/50 disabled:opacity-50";

const templates = [
  { id: "GAMING", label: "Gaming", description: "General, announcements and squad voice.", icon: Gamepad2 },
  { id: "ESPORTS", label: "Esports", description: "Team comms, match updates and scrim voice.", icon: Zap },
  { id: "CREATOR", label: "Creator", description: "Creator lounge, drops and a live studio.", icon: Users2 },
  { id: "STUDY", label: "Study", description: "Focus room, resources and study voice.", icon: BookOpen },
  { id: "TRH", label: "Operations", description: "HQ, project board and client voice.", icon: Building2 },
] as const;

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "VX";
}

export function CommunityPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { accessToken, csrfToken, user } = useAuthStore();
  const setSelectedForgeId = useWorkspaceStore((state) => state.setSelectedForgeId);
  const selectedForgeId = useWorkspaceStore((state) => state.selectedForgeId);
  const [createOpen, setCreateOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  const forgesQuery = useQuery({ queryKey: ["forges", accessToken], queryFn: () => listForges(accessToken!), enabled: Boolean(accessToken) });
  const unreadQuery = useQuery({ queryKey: ["unread-summary", accessToken], queryFn: () => getUnreadSummary(accessToken!), enabled: Boolean(accessToken) });
  const unreadByForge = new Map((unreadQuery.data?.forges ?? []).map((entry) => [entry.forgeId, entry] as const));

  const joinMutation = useMutation({
    mutationFn: () => joinForge(accessToken!, csrfToken!, inviteCode.trim().split("/").pop() ?? inviteCode.trim()),
    onSuccess: async (result) => {
      setInviteCode("");
      await queryClient.invalidateQueries({ queryKey: ["forges"] });
      setSelectedForgeId(result.forgeId);
      setNotice({ tone: "ok", text: "Joined. Opening the forge." });
      router.push("/app");
    },
    onError: (error) => setNotice({ tone: "error", text: getApiErrorMessage(error) }),
  });

  const open = (forge: Forge, path = "/app") => {
    setSelectedForgeId(forge.id);
    router.push(path === "/app" ? path : `${path}?forge=${forge.id}`);
  };

  const forges = forgesQuery.data?.forges ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="nf-heading text-xl font-bold text-white">Community</h1>
          <p className="text-xs text-slate-400">Your forges, in one place. Create a new one or join with an invite.</p>
        </div>
        <button type="button" onClick={() => setCreateOpen(true)} className={goldBtn}><Plus className="h-3.5 w-3.5" /> New forge</button>
      </div>

      {notice ? (
        <div className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs ${notice.tone === "ok" ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100" : "border-rose-400/30 bg-rose-500/10 text-rose-100"}`}>
          {notice.text}
          <button type="button" onClick={() => setNotice(null)} title="Dismiss"><X className="h-3.5 w-3.5" /></button>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          {forgesQuery.isLoading ? (
            <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading forges...</p>
          ) : forges.length ? (
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
              {forges.map((forge) => {
                const unread = unreadByForge.get(forge.id);
                const isOwner = forge.ownerId === user?.id;
                const active = forge.id === selectedForgeId;
                return (
                  <div key={forge.id} className={cn("overflow-hidden rounded-2xl border bg-[#0d1119] transition hover:border-amber-400/50", active ? "border-amber-400/50 shadow-[0_0_24px_rgba(230,179,37,0.15)]" : "border-amber-500/15")}>
                    <div className="relative h-24">
                      {forge.banner ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={forge.banner} alt="" className="absolute inset-0 h-full w-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_40%,rgba(230,179,37,0.3),transparent_55%),linear-gradient(160deg,#141a26,#0b0e15)]" />
                      )}
                      {active ? <span className="absolute left-3 top-3 rounded bg-amber-400 px-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-slate-950">Current</span> : null}
                      {unread?.unread ? <span className="absolute right-3 top-3 rounded-full bg-amber-500/90 px-2 text-[10px] font-bold text-slate-950">{unread.unread} new</span> : null}
                    </div>
                    <div className="p-4">
                      <div className="-mt-10 mb-3 flex items-end gap-3">
                        {forge.icon ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={forge.icon} alt="" className="h-14 w-14 rounded-xl border-4 border-[#0d1119] object-cover" />
                        ) : (
                          <span className="flex h-14 w-14 items-center justify-center rounded-xl border-4 border-[#0d1119] bg-gradient-to-br from-amber-400 to-amber-700 text-sm font-bold text-slate-950">{initials(forge.name)}</span>
                        )}
                        <div className="min-w-0 pb-1">
                          <p className="truncate text-sm font-semibold text-white">{forge.name}</p>
                          <p className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.14em] text-slate-500">{isOwner ? <><Crown className="h-3 w-3 text-amber-300" /> Owner</> : "Member"} · <Link2 className="h-3 w-3" /> {forge.inviteCode}</p>
                        </div>
                      </div>
                      {forge.description ? <p className="mb-3 line-clamp-2 text-xs text-slate-400">{forge.description}</p> : null}
                      <div className="flex flex-wrap gap-1.5">
                        <button type="button" onClick={() => open(forge)} className={goldBtn}>Open <ArrowRight className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => open(forge, "/app/chat")} className={ghostBtn} title="Chat"><MessageSquare className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => open(forge, "/app/forge-ops")} className={ghostBtn} title="Forge ops"><Settings2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className={`${panel} flex flex-col items-center py-10 text-center`}>
              <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl border border-amber-500/40 bg-amber-500/10 text-amber-300"><Users className="h-7 w-7" /></span>
              <p className="text-sm text-slate-300">You have not joined a forge yet.</p>
              <p className="text-xs text-slate-500">Create your own or paste an invite code on the right.</p>
              <button type="button" onClick={() => setCreateOpen(true)} className={`${goldBtn} mt-4`}><Plus className="h-3.5 w-3.5" /> Create the first one</button>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <div className={panel}>
            <h2 className="nf-heading mb-2 text-[13px] font-bold uppercase tracking-[0.18em] text-white">Join with invite</h2>
            <p className="mb-3 text-xs text-slate-400">Paste an invite code or link from a friend.</p>
            <div className="flex gap-2">
              <input value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} placeholder="invite-code" className={inputClass} onKeyDown={(event) => { if (event.key === "Enter" && inviteCode.trim()) joinMutation.mutate(); }} />
              <button type="button" className={goldBtn} disabled={!inviteCode.trim() || joinMutation.isPending} onClick={() => joinMutation.mutate()}>{joinMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Join"}</button>
            </div>
          </div>
          <div className={panel}>
            <h2 className="nf-heading mb-2 text-[13px] font-bold uppercase tracking-[0.18em] text-white">Find communities</h2>
            <p className="text-sm text-slate-400">Browse featured and recommended forges by category.</p>
            <Link href="/app/discover" className={`${ghostBtn} mt-3`}>Open Discover</Link>
          </div>
          <div className={panel}>
            <h2 className="nf-heading mb-2 text-[13px] font-bold uppercase tracking-[0.18em] text-white">Totals</h2>
            <dl className="space-y-2 text-xs">
              {[["Forges", forges.length], ["Owned", forges.filter((forge) => forge.ownerId === user?.id).length], ["Unread", (unreadQuery.data?.forges ?? []).reduce((sum, entry) => sum + entry.unread, 0)]].map(([label, value]) => (
                <div key={label as string} className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="text-slate-200">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </aside>
      </div>

      {createOpen ? <CreateForgeDialog onClose={() => setCreateOpen(false)} /> : null}
    </div>
  );
}

function CreateForgeDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { accessToken, csrfToken } = useAuthStore();
  const setSelectedForgeId = useWorkspaceStore((state) => state.setSelectedForgeId);
  const [template, setTemplate] = useState<(typeof templates)[number]["id"]>("GAMING");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [invite, setInvite] = useState("");
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => createForge(accessToken!, csrfToken!, { name: name.trim(), description: description.trim() || undefined, inviteCode: invite.trim() || undefined, template }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["forges"] });
      setSelectedForgeId(result.forge.id);
      onClose();
      router.push("/app");
    },
    onError: (err) => setError(getApiErrorMessage(err)),
  });

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl rounded-2xl border border-amber-500/25 bg-[#0d1119] p-5 shadow-[0_30px_80px_rgba(0,0,0,0.7)]">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="nf-heading text-base font-bold text-white">Create a forge</h2>
            <p className="text-xs text-slate-400">Pick a template. Channels and roles are set up for you.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-400 hover:text-white" title="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="mb-4 grid gap-2 sm:grid-cols-5">
          {templates.map((entry) => (
            <button key={entry.id} type="button" onClick={() => setTemplate(entry.id)} className={cn("rounded-xl border p-3 text-left transition", template === entry.id ? "border-amber-400 bg-amber-500/10" : "border-white/10 bg-[#11151e] hover:border-white/25")}>
              <entry.icon className={cn("mb-2 h-5 w-5", template === entry.id ? "text-amber-300" : "text-slate-400")} />
              <p className="text-xs font-semibold text-white">{entry.label}</p>
              <p className="mt-0.5 text-[10px] leading-snug text-slate-500">{entry.description}</p>
            </button>
          ))}
        </div>
        <div className="space-y-3">
          <input className={inputClass} placeholder="Forge name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} autoFocus />
          <input className={inputClass} placeholder="What is this forge about? (optional)" value={description} onChange={(event) => setDescription(event.target.value)} maxLength={300} />
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">/invite/</span>
            <input className={inputClass} placeholder="custom-invite (optional)" value={invite} onChange={(event) => setInvite(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} maxLength={32} />
          </div>
          {error ? <p className="text-xs text-rose-300">{error}</p> : null}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className={ghostBtn}>Cancel</button>
            <button type="button" onClick={() => mutation.mutate()} disabled={name.trim().length < 2 || mutation.isPending} className={goldBtn}>
              {mutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Hash className="h-3.5 w-3.5" />} Create forge
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
