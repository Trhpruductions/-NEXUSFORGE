"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Dices, Loader2, Search, ShieldCheck, UserPlus, Users } from "lucide-react";
import {
  completeOnboarding,
  createForge,
  getApiErrorMessage,
  getAvatar,
  getDiscover,
  joinForge,
  saveAvatar,
  searchUsers,
  sendFriendRequest,
  type AvatarConfig,
  type DiscoverForge,
} from "@/lib/api";
import { AvatarRenderer, defaultAvatarConfig } from "@/components/avatar/avatar-renderer";
import { useAuthStore } from "@/store/auth-store";
import { useWorkspaceStore } from "@/store/workspace-store";

const goldBtn = "inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-950 transition hover:bg-amber-300 disabled:opacity-50";
const ghostBtn = "inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200 transition hover:border-amber-400/50 disabled:opacity-50";
const inputClass = "h-10 w-full rounded-lg border border-white/10 bg-[#11151e] px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-400/60";

const steps = ["Avatar", "Community", "Friends", "Done"] as const;

const skinTones = ["#f5d0b0", "#e8b894", "#d9a577", "#c48a5a", "#a66a3f", "#7a4a2b", "#5b3520", "#3f2417"];
const hairColors = ["#22d3ee", "#e6b325", "#f472b6", "#a855f7", "#ef4444", "#10b981", "#f8fafc", "#0f172a"];
const outfitColors = ["#111318", "#1d4ed8", "#7f1d1d", "#334155", "#4c1d95", "#e6b325", "#e2e8f0", "#0f766e"];

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

function randomConfig(): AvatarConfig {
  return {
    body: pick(["slim", "athletic", "broad"] as const),
    skin: pick(skinTones),
    hair: pick(["spiky", "fade", "curls", "long", "bun", "buzz", "mohawk"] as const),
    hairColor: pick(hairColors),
    hairLength: Math.floor(Math.random() * 100),
    eyes: pick(["sharp", "round", "calm", "visor"] as const),
    eyeColor: pick(["#38bdf8", "#22c55e", "#a855f7", "#e6b325", "#ef4444"]),
    face: pick(["focused", "neutral", "smirk", "grin"] as const),
    accessory: pick(["none", "shades", "headset", "mask", "bandana"] as const),
    topColor: pick(outfitColors),
    bottomColor: pick(outfitColors),
    shoeColor: pick(outfitColors),
    accent: pick(["#e6b325", "#22d3ee", "#f472b6", "#a855f7", "#22c55e"]),
    background: pick(["city", "forge", "void", "arena"] as const),
  };
}

export function WelcomeWizard() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user, accessToken, csrfToken, fetchMe } = useAuthStore();
  const setSelectedForgeId = useWorkspaceStore((state) => state.setSelectedForgeId);
  const [step, setStep] = useState(0);
  const [config, setConfig] = useState<AvatarConfig>(defaultAvatarConfig);
  const [forgeName, setForgeName] = useState("");
  const [query, setQuery] = useState("");
  const [term, setTerm] = useState("");
  const [requested, setRequested] = useState<Set<string>>(new Set());
  const [joined, setJoined] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const avatarQuery = useQuery({ queryKey: ["avatar", accessToken], queryFn: () => getAvatar(accessToken!), enabled: Boolean(accessToken) });
  useEffect(() => {
    if (avatarQuery.data) setConfig(avatarQuery.data.config);
  }, [avatarQuery.data]);

  const discoverQuery = useQuery({ queryKey: ["discover", "all", "", accessToken], queryFn: () => getDiscover(accessToken!), enabled: Boolean(accessToken) && step === 1 });
  const usersQuery = useQuery({ queryKey: ["search-users", term, accessToken], queryFn: () => searchUsers(accessToken!, term), enabled: Boolean(accessToken) && step === 2 && term.length >= 2 });

  const saveAvatarMutation = useMutation({
    mutationFn: () => saveAvatar(accessToken!, csrfToken!, config),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["avatar"] });
      setStep(1);
    },
    onError: (error) => setNotice(getApiErrorMessage(error)),
  });
  const joinMutation = useMutation({
    mutationFn: (forge: DiscoverForge) => joinForge(accessToken!, csrfToken!, forge.inviteCode),
    onSuccess: async (result) => {
      setJoined(result.forgeId);
      setSelectedForgeId(result.forgeId);
      await queryClient.invalidateQueries({ queryKey: ["forges"] });
    },
    onError: (error) => setNotice(getApiErrorMessage(error)),
  });
  const createMutation = useMutation({
    mutationFn: () => createForge(accessToken!, csrfToken!, { name: forgeName.trim(), template: "GAMING" }),
    onSuccess: async (result) => {
      setJoined(result.forge.id);
      setSelectedForgeId(result.forge.id);
      await queryClient.invalidateQueries({ queryKey: ["forges"] });
    },
    onError: (error) => setNotice(getApiErrorMessage(error)),
  });
  const requestMutation = useMutation({
    mutationFn: (userId: string) => sendFriendRequest(accessToken!, csrfToken!, userId),
    onSuccess: (_result, userId) => setRequested((current) => new Set(current).add(userId)),
    onError: (error) => setNotice(getApiErrorMessage(error)),
  });
  const finishMutation = useMutation({
    mutationFn: () => completeOnboarding(accessToken!, csrfToken!),
    onSuccess: async () => {
      await fetchMe();
      router.replace("/app");
    },
    onError: (error) => setNotice(getApiErrorMessage(error)),
  });

  const publicForges = useMemo(() => {
    const data = discoverQuery.data;
    if (!data) return [];
    const seen = new Set<string>();
    return [...data.featured, ...data.recommended, ...data.forges].filter((forge) => (seen.has(forge.id) ? false : (seen.add(forge.id), true))).slice(0, 6);
  }, [discoverQuery.data]);

  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#070a10] text-slate-100">
      <Image src="/brand/vexora-gaming-poster-gold.png" alt="" fill priority className="object-cover opacity-20" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(230,179,37,0.18),transparent_38%),linear-gradient(180deg,rgba(7,10,16,0.55),#070a10_70%)]" />
      <main className="relative mx-auto flex min-h-dvh w-full max-w-4xl flex-col px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image src="/brand/vexora-mark-gold-256.png" alt="Vexora Gaming" width={40} height={40} className="h-10 w-10" />
            <span className="nf-heading text-sm font-bold uppercase tracking-[0.28em] text-amber-300">Vexora Gaming</span>
          </div>
          <ol className="flex items-center gap-2">
            {steps.map((label, index) => (
              <li key={label} className="flex items-center gap-2">
                <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${index < step ? "bg-emerald-400 text-slate-950" : index === step ? "bg-amber-400 text-slate-950" : "border border-white/15 text-slate-500"}`}>
                  {index < step ? <Check className="h-3 w-3" /> : index + 1}
                </span>
                <span className={`hidden text-[10px] font-semibold uppercase tracking-[0.16em] sm:inline ${index === step ? "text-white" : "text-slate-500"}`}>{label}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex-1 rounded-2xl border border-amber-500/20 bg-[#0d1119]/95 p-6 shadow-[0_30px_100px_rgba(0,0,0,0.6)] backdrop-blur sm:p-8">
          {notice ? <p className="mb-4 rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">{notice}</p> : null}

          {step === 0 ? (
            <div className="grid gap-6 md:grid-cols-[280px_minmax(0,1fr)]">
              <div className="flex items-center justify-center rounded-2xl border border-white/5 bg-[#11151e] p-4">
                <AvatarRenderer config={config} size={200} />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-amber-300">Step 1</p>
                <h1 className="nf-heading mt-2 text-2xl font-bold text-white">Welcome, {user?.displayName || user?.username}. Build your avatar.</h1>
                <p className="mt-2 text-sm text-slate-400">This is you across every forge, voice room and leaderboard. Randomize until it clicks. You can fine-tune every detail later in the Avatar Studio.</p>
                <div className="mt-4 space-y-3">
                  <div>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Skin</p>
                    <div className="flex flex-wrap gap-2">{skinTones.map((skin) => <button key={skin} type="button" onClick={() => setConfig((current) => ({ ...current, skin }))} style={{ backgroundColor: skin }} className={`h-7 w-7 rounded-full border-2 ${config.skin === skin ? "border-amber-300" : "border-white/10"}`} />)}</div>
                  </div>
                  <div>
                    <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Hair</p>
                    <div className="flex flex-wrap gap-2">{hairColors.map((hairColor) => <button key={hairColor} type="button" onClick={() => setConfig((current) => ({ ...current, hairColor }))} style={{ backgroundColor: hairColor }} className={`h-7 w-7 rounded-full border-2 ${config.hairColor === hairColor ? "border-amber-300" : "border-white/10"}`} />)}</div>
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap gap-2">
                  <button type="button" onClick={() => setConfig(randomConfig())} className={ghostBtn}><Dices className="h-3.5 w-3.5" /> Randomize</button>
                  <button type="button" onClick={() => saveAvatarMutation.mutate()} disabled={saveAvatarMutation.isPending} className={goldBtn}>
                    {saveAvatarMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Looks good
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-amber-300">Step 2</p>
              <h1 className="nf-heading mt-2 text-2xl font-bold text-white">Find your people.</h1>
              <p className="mt-2 text-sm text-slate-400">Join a public forge or start your own. Forges are where the channels, voice rooms and events live.</p>
              {discoverQuery.isLoading ? <p className="mt-4 text-sm text-slate-400"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading communities...</p> : null}
              {publicForges.length ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {publicForges.map((forge) => (
                    <div key={forge.id} className="rounded-xl border border-white/5 bg-[#11151e] p-3">
                      <div className="flex items-center gap-2.5">
                        {forge.icon ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={forge.icon} alt="" className="h-9 w-9 rounded-lg object-cover" />
                        ) : (
                          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-amber-400 to-amber-700 text-[11px] font-bold text-slate-950">{forge.name.slice(0, 2).toUpperCase()}</span>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">{forge.name}</p>
                          <p className="inline-flex items-center gap-1 text-[11px] text-slate-400"><Users className="h-3 w-3" /> {forge.memberCount} members</p>
                        </div>
                      </div>
                      {forge.description ? <p className="mt-2 line-clamp-2 text-xs text-slate-400">{forge.description}</p> : null}
                      <button type="button" disabled={forge.joined || joined === forge.id || joinMutation.isPending} onClick={() => joinMutation.mutate(forge)} className={`${forge.joined || joined === forge.id ? "border border-emerald-400/40 bg-emerald-500/10 text-emerald-200" : "bg-amber-400 text-slate-950 hover:bg-amber-300"} mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-bold uppercase tracking-[0.16em] disabled:cursor-default`}>
                        {forge.joined || joined === forge.id ? <><Check className="h-3.5 w-3.5" /> Joined</> : "Join"}
                      </button>
                    </div>
                  ))}
                </div>
              ) : discoverQuery.data ? (
                <p className="mt-4 rounded-xl border border-white/5 bg-[#11151e] px-3 py-3 text-sm text-slate-500">No public forges yet. Be the first to create one.</p>
              ) : null}
              <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-300">Or start your own forge</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input value={forgeName} onChange={(event) => setForgeName(event.target.value)} maxLength={60} placeholder="Forge name (e.g. Night Owls)" className={`${inputClass} sm:max-w-xs`} />
                  <button type="button" onClick={() => createMutation.mutate()} disabled={forgeName.trim().length < 2 || createMutation.isPending} className={goldBtn}>
                    {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Create
                  </button>
                </div>
              </div>
              <div className="mt-6 flex flex-wrap justify-between gap-2">
                <button type="button" onClick={() => setStep(0)} className={ghostBtn}>Back</button>
                <button type="button" onClick={() => setStep(2)} className={joined ? goldBtn : ghostBtn}>{joined ? "Continue" : "Skip for now"}</button>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-amber-300">Step 3</p>
              <h1 className="nf-heading mt-2 text-2xl font-bold text-white">Add your squad.</h1>
              <p className="mt-2 text-sm text-slate-400">Search by username and send friend requests. Friends can DM you and see when you are online.</p>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  setTerm(query.trim());
                }}
                className="relative mt-4 max-w-md"
              >
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search usernames" className={`${inputClass} pl-9`} />
              </form>
              <div className="mt-4 space-y-2">
                {usersQuery.isLoading ? <p className="text-sm text-slate-400"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Searching...</p> : null}
                {usersQuery.data?.users.filter((entry) => entry.id !== user?.id).map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3 rounded-xl border border-white/5 bg-[#11151e] px-3 py-2">
                    {entry.avatar ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={entry.avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
                    ) : (
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-amber-100">{entry.username.slice(0, 2).toUpperCase()}</span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">{entry.username}</p>
                      <p className="text-[11px] text-slate-500">{entry.status.toLowerCase()}</p>
                    </div>
                    <button type="button" disabled={requested.has(entry.id) || requestMutation.isPending} onClick={() => requestMutation.mutate(entry.id)} className={requested.has(entry.id) ? "inline-flex items-center gap-1 rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-200" : `${goldBtn} px-3 py-2`}>
                      {requested.has(entry.id) ? <><Check className="h-3.5 w-3.5" /> Sent</> : <><UserPlus className="h-3.5 w-3.5" /> Add</>}
                    </button>
                  </div>
                ))}
                {usersQuery.data && !usersQuery.data.users.filter((entry) => entry.id !== user?.id).length ? <p className="text-sm text-slate-500">No one matches that name yet.</p> : null}
              </div>
              <div className="mt-6 flex flex-wrap justify-between gap-2">
                <button type="button" onClick={() => setStep(1)} className={ghostBtn}>Back</button>
                <button type="button" onClick={() => setStep(3)} className={goldBtn}>{requested.size ? "Continue" : "Skip for now"}</button>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="text-center">
              <span className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-amber-400/50 bg-amber-500/10 text-amber-300"><ShieldCheck className="h-8 w-8" /></span>
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-amber-300">You are set</p>
              <h1 className="nf-heading mt-2 text-2xl font-bold text-white">Built for gamers. Connected by community.</h1>
              <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
                One last thing once you are in: verify your email and phone under Settings so nobody can take your account. The banner at the top of the app will walk you through it.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <button type="button" onClick={() => setStep(2)} className={ghostBtn}>Back</button>
                <button type="button" onClick={() => finishMutation.mutate()} disabled={finishMutation.isPending} className={goldBtn}>
                  {finishMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Enter Vexora
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </main>
    </div>
  );
}
