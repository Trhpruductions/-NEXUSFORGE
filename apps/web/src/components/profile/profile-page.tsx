"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Award, Clock, Crown, Heart, Loader2, MessageCircle, Radio, Send, Shield, Sparkles, Star, Trash2, UserPlus, UserCheck, Users, X, Code2, Handshake, BadgeCheck } from "lucide-react";
import {
  applyAvatarPreset,
  createPost,
  deletePost,
  followUser,
  getAvatar,
  getProfileSummary,
  getUserAchievements,
  getUserStreams,
  listFriends,
  listPosts,
  togglePostLike,
  unfollowUser,
  type AvatarConfig,
  type Post,
} from "@/lib/api";
import { AvatarRenderer, defaultAvatarConfig } from "@/components/avatar/avatar-renderer";
import { ClipEmbed } from "@/components/media/clip-embed";
import { useAuthStore } from "@/store/auth-store";

type Tab = "posts" | "clips" | "streams" | "achievements" | "friends";

const panel = "rounded-2xl border border-amber-500/15 bg-[#0d1119] p-4";
const sectionTitle = "nf-heading text-[13px] font-bold uppercase tracking-[0.18em] text-white";
const goldBtn = "inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-950 transition hover:bg-amber-300 disabled:opacity-50";
const ghostBtn = "inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3.5 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200 transition hover:border-amber-400/50 disabled:opacity-50";

function emoteClass(key: string) {
  if (key.includes("salute") || key.includes("gg")) return "nf-emote-salute";
  if (key.includes("flex")) return "nf-emote-flex";
  if (key.includes("drop")) return "nf-emote-drop";
  return "nf-emote-bounce";
}

function errorText(error: unknown) {
  if (axios.isAxiosError(error)) return (error.response?.data as { error?: string } | undefined)?.error ?? error.message;
  return error instanceof Error ? error.message : "Something went wrong";
}

function compact(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function timeAgo(iso: string) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "VX";
}

export function ProfilePage() {
  return (
    <Suspense fallback={<p className="text-sm text-slate-400">Loading profile...</p>}>
      <ProfileInner />
    </Suspense>
  );
}

function ProfileInner() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { accessToken, csrfToken, user: self } = useAuthStore();
  const requested = searchParams?.get("user");
  const targetId = requested && requested !== self?.id ? requested : "me";
  const [tab, setTab] = useState<Tab>("posts");
  const [draft, setDraft] = useState("");
  const [draftKind, setDraftKind] = useState<"POST" | "CLIP">("POST");
  const [mediaUrl, setMediaUrl] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const summaryQuery = useQuery({
    queryKey: ["profile-summary", targetId, accessToken],
    queryFn: () => getProfileSummary(accessToken!, targetId),
    enabled: Boolean(accessToken),
  });
  const profile = summaryQuery.data;
  const userId = profile?.user.id;

  const postsQuery = useQuery({
    queryKey: ["posts", userId, tab === "clips" ? "CLIP" : "POST", accessToken],
    queryFn: () => listPosts(accessToken!, { authorId: userId, kind: tab === "clips" ? "CLIP" : "POST" }),
    enabled: Boolean(accessToken && userId && (tab === "posts" || tab === "clips")),
  });
  const streamsQuery = useQuery({
    queryKey: ["streams", userId, accessToken],
    queryFn: () => getUserStreams(accessToken!, userId!),
    enabled: Boolean(accessToken && userId && tab === "streams"),
  });
  const achievementsQuery = useQuery({
    queryKey: ["achievements", userId, accessToken],
    queryFn: () => getUserAchievements(accessToken!, userId!),
    enabled: Boolean(accessToken && userId),
  });
  const achievements = achievementsQuery.data?.achievements ?? [];
  const unlockedAchievements = achievements.filter((entry) => entry.unlocked);
  const friendsQuery = useQuery({
    queryKey: ["friends", accessToken],
    queryFn: () => listFriends(accessToken!),
    enabled: Boolean(accessToken && tab === "friends" && profile?.isSelf),
  });
  const avatarQuery = useQuery({
    queryKey: ["avatar", accessToken],
    queryFn: () => getAvatar(accessToken!),
    enabled: Boolean(accessToken && profile?.isSelf),
  });

  const invalidateProfile = () => queryClient.invalidateQueries({ queryKey: ["profile-summary", targetId, accessToken] });

  const followMutation = useMutation({
    mutationFn: () => (profile?.isFollowing ? unfollowUser(accessToken!, csrfToken!, userId!) : followUser(accessToken!, csrfToken!, userId!)),
    onSuccess: invalidateProfile,
    onError: (error) => setNotice(errorText(error)),
  });
  const postMutation = useMutation({
    mutationFn: () => createPost(accessToken!, csrfToken!, { kind: draftKind, content: draft.trim(), mediaUrl: mediaUrl.trim() || undefined, tags: (draft.match(/#[a-z0-9_]+/gi) ?? []).map((tag) => tag.slice(1)) }),
    onSuccess: async () => {
      setDraft("");
      setMediaUrl("");
      await queryClient.invalidateQueries({ queryKey: ["posts"] });
      await invalidateProfile();
    },
    onError: (error) => setNotice(errorText(error)),
  });
  const likeMutation = useMutation({
    mutationFn: (postId: string) => togglePostLike(accessToken!, csrfToken!, postId),
    onSuccess: (result, postId) => {
      queryClient.setQueriesData<{ posts: Post[] }>({ queryKey: ["posts"] }, (current) =>
        current ? { posts: current.posts.map((post) => (post.id === postId ? { ...post, liked: result.liked, _count: { likes: result.likes } } : post)) } : current,
      );
    },
  });
  const deleteMutation = useMutation({
    mutationFn: (postId: string) => deletePost(accessToken!, csrfToken!, postId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["posts"] }),
    onError: (error) => setNotice(errorText(error)),
  });
  const applyPresetMutation = useMutation({
    mutationFn: (presetId: string) => applyAvatarPreset(accessToken!, csrfToken!, presetId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["avatar"] });
      await invalidateProfile();
    },
    onError: (error) => setNotice(errorText(error)),
  });

  const badges = useMemo(() => {
    if (!profile) return [];
    const list: Array<{ label: string; icon: typeof Crown; tone: string }> = [];
    if (profile.user.ageVerificationLevel === "VERIFIED") list.push({ label: "Verified 18+", icon: BadgeCheck, tone: "text-emerald-300 border-emerald-400/40 bg-emerald-500/10" });
    if (profile.user.isStaff) list.push({ label: "Staff", icon: Shield, tone: "text-sky-300 border-sky-400/40 bg-sky-500/10" });
    if (profile.user.isPartner) list.push({ label: "Partner", icon: Handshake, tone: "text-fuchsia-300 border-fuchsia-400/40 bg-fuchsia-500/10" });
    if (profile.user.isCreator) list.push({ label: "Creator", icon: Sparkles, tone: "text-amber-200 border-amber-400/40 bg-amber-500/10" });
    if (profile.user.isRep) list.push({ label: "Rep", icon: Star, tone: "text-emerald-300 border-emerald-400/40 bg-emerald-500/10" });
    if (profile.user.premium) list.push({ label: profile.user.premiumTier === "NONE" ? "Premium" : profile.user.premiumTier, icon: Crown, tone: "text-amber-300 border-amber-400/40 bg-amber-500/10" });
    const created = new Date(profile.user.createdAt);
    if (created.getTime() < new Date("2026-09-01").getTime()) list.push({ label: "Founder", icon: Code2, tone: "text-amber-200 border-amber-400/40 bg-amber-500/10" });
    return list;
  }, [profile]);

  const avatarConfig: AvatarConfig = (profile?.isSelf ? avatarQuery.data?.config : profile?.user.avatarConfig) ?? defaultAvatarConfig;
  const [emotePlaying, setEmotePlaying] = useState(false);
  const friends = (friendsQuery.data?.friends ?? []).filter((entry) => entry.status === "ACCEPTED");

  if (summaryQuery.isLoading || !profile) {
    return <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading profile...</p>;
  }

  const person = profile.user;
  const displayName = person.displayName || person.username;
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: "posts", label: "Posts" },
    { id: "clips", label: "Clips" },
    { id: "streams", label: "Streams" },
    { id: "achievements", label: "Achievements" },
    ...(profile.isSelf ? [{ id: "friends" as Tab, label: "Friends" }] : []),
  ];

  return (
    <div className="space-y-4">
      {notice ? (
        <div className="flex items-center justify-between rounded-xl border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
          {notice}
          <button type="button" onClick={() => setNotice(null)} title="Dismiss"><X className="h-3.5 w-3.5" /></button>
        </div>
      ) : null}

      {/* Banner + identity */}
      <section className="overflow-hidden rounded-2xl border border-amber-500/20 bg-[#0d1119]">
        <div className="relative h-40 sm:h-52">
          {person.banner ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={person.banner} alt="" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(230,179,37,0.35),transparent_45%),linear-gradient(160deg,#141a26,#070a10)]" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d1119] via-transparent to-transparent" />
          {person.creatorStatus === "LIVE" ? (
            <span className="absolute left-4 top-4 inline-flex items-center gap-1 rounded bg-rose-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] text-white"><Radio className="h-3 w-3" /> Live</span>
          ) : null}
        </div>
        <div className="relative px-5 pb-5">
          <div className="-mt-12 flex flex-wrap items-end gap-4">
            <div
              className={`relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl border-4 border-[#0d1119] bg-[#11151e] shadow-[0_0_30px_rgba(230,179,37,0.3)] ${person.profileEmote ? "cursor-pointer" : ""} ${emotePlaying && person.profileEmote ? emoteClass(person.profileEmote.key) : ""}`}
              title={person.profileEmote ? `Play ${person.profileEmote.name}` : undefined}
              onClick={() => {
                if (!person.profileEmote) return;
                setEmotePlaying(false);
                window.setTimeout(() => setEmotePlaying(true), 20);
                window.setTimeout(() => setEmotePlaying(false), 2200);
              }}
            >
              {person.avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={person.avatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-end justify-center overflow-hidden">
                  <AvatarRenderer config={avatarConfig} size={120} showBackground={false} className="-mb-16 -mt-2" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="nf-heading text-2xl font-bold text-white">{displayName}</h1>
                {person.clanTag ? <span className="rounded border border-amber-400/40 px-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-amber-200">{person.clanTag}</span> : null}
              </div>
              <p className="text-sm text-slate-400">@{person.username}</p>
              {badges.length || person.profileEmote ? (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {badges.map((badge) => (
                    <span key={badge.label} className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] ${badge.tone}`}>
                      <badge.icon className="h-3 w-3" /> {badge.label}
                    </span>
                  ))}
                  {person.profileEmote ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-amber-200" title="Click the avatar to play">
                      <Sparkles className="h-3 w-3" /> {person.profileEmote.name}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2 pb-1">
              {profile.isSelf ? (
                <>
                  <Link href="/app/avatar" className={goldBtn}>Manage avatar</Link>
                  <Link href="/app/settings" className={ghostBtn}>Edit profile</Link>
                </>
              ) : (
                <>
                  <button type="button" className={profile.isFollowing ? ghostBtn : goldBtn} disabled={followMutation.isPending} onClick={() => followMutation.mutate()}>
                    {profile.isFollowing ? <UserCheck className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />}
                    {profile.isFollowing ? "Following" : "Follow"}
                  </button>
                  <Link href={`/app/chat?dm=${person.id}`} className={ghostBtn}>Message</Link>
                </>
              )}
            </div>
          </div>
          {person.bio ? <p className="mt-3 max-w-2xl text-sm text-slate-300">{person.bio}</p> : null}
          {profile.followsYou && !profile.isSelf ? <p className="mt-1 text-[11px] uppercase tracking-[0.16em] text-amber-300">Follows you</p> : null}
          <div className="mt-4 grid max-w-md grid-cols-3 gap-2">
            {[
              { label: "Followers", value: person._count.followers },
              { label: "Following", value: person._count.following },
              { label: "Points", value: person.points },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl border border-white/5 bg-[#11151e] px-3 py-2 text-center">
                <p className="nf-heading text-lg font-bold text-white">{compact(stat.value)}</p>
                <p className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          {/* Tabs */}
          <div className="flex gap-1 overflow-x-auto rounded-xl border border-white/5 bg-[#0d1119] p-1">
            {tabs.map((entry) => (
              <button key={entry.id} type="button" onClick={() => setTab(entry.id)} className={`shrink-0 rounded-lg px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${tab === entry.id ? "bg-amber-400 text-slate-950" : "text-slate-400 hover:text-white"}`}>
                {entry.label}
              </button>
            ))}
          </div>

          {(tab === "posts" || tab === "clips") && profile.isSelf ? (
            <div className={panel}>
              <div className="mb-2 flex items-center gap-2">
                {(["POST", "CLIP"] as const).map((kind) => (
                  <button key={kind} type="button" onClick={() => setDraftKind(kind)} className={`rounded-md px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${draftKind === kind ? "bg-amber-500/20 text-amber-100" : "text-slate-500 hover:text-slate-200"}`}>
                    {kind === "POST" ? "Post" : "Clip"}
                  </button>
                ))}
              </div>
              <textarea value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={2000} placeholder={draftKind === "CLIP" ? "Describe your clip and paste the link below" : "Share an update with the community. Use #tags."} className="min-h-[72px] w-full rounded-lg border border-white/10 bg-[#11151e] px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-400/60" />
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input value={mediaUrl} onChange={(event) => setMediaUrl(event.target.value)} placeholder={draftKind === "CLIP" ? "Clip URL (YouTube, Twitch, Kick...)" : "Image URL (optional)"} className="h-9 min-w-[220px] flex-1 rounded-lg border border-white/10 bg-[#11151e] px-3 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-amber-400/60" />
                <button type="button" className={goldBtn} disabled={!draft.trim() || postMutation.isPending || (draftKind === "CLIP" && !mediaUrl.trim())} onClick={() => postMutation.mutate()}>
                  {postMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />} Share
                </button>
              </div>
            </div>
          ) : null}

          {tab === "posts" || tab === "clips" ? (
            <div className="space-y-3">
              {postsQuery.isLoading ? (
                <p className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</p>
              ) : postsQuery.data?.posts.length ? (
                postsQuery.data.posts.map((post) => (
                  <article key={post.id} className={panel}>
                    <div className="flex items-start gap-3">
                      {post.author.avatar ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={post.author.avatar} alt="" className="h-10 w-10 rounded-full border border-amber-500/30 object-cover" />
                      ) : (
                        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-amber-500/30 bg-slate-800 text-xs font-bold text-amber-100">{initials(post.author.username)}</span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-slate-400">
                          <span className="text-sm font-semibold text-white">{post.author.displayName || post.author.username}</span>
                          <span>@{post.author.username}</span>
                          <span>· {timeAgo(post.createdAt)}</span>
                          {post.kind === "CLIP" ? <span className="rounded border border-white/10 px-1.5 text-[9px] uppercase tracking-[0.12em] text-amber-200">Clip</span> : null}
                        </p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-slate-200">{post.content}</p>
                        {post.mediaUrl ? (
                          post.kind === "CLIP" ? (
                            <ClipEmbed url={post.mediaUrl} className="mt-2 max-w-2xl" />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={post.mediaUrl} alt="" className="mt-2 max-h-80 rounded-xl border border-white/10 object-cover" />
                          )
                        ) : null}
                        {post.tags.length ? <p className="mt-2 text-xs text-amber-300">{post.tags.map((tag) => `#${tag}`).join(" ")}</p> : null}
                        <div className="mt-3 flex items-center gap-4 text-xs text-slate-400">
                          <button type="button" onClick={() => likeMutation.mutate(post.id)} className={`inline-flex items-center gap-1 transition hover:text-rose-300 ${post.liked ? "text-rose-400" : ""}`}>
                            <Heart className={`h-3.5 w-3.5 ${post.liked ? "fill-current" : ""}`} /> {post._count.likes}
                          </button>
                          <span className="inline-flex items-center gap-1"><MessageCircle className="h-3.5 w-3.5" /> 0</span>
                          {post.authorId === self?.id ? (
                            <button type="button" onClick={() => deleteMutation.mutate(post.id)} className="ml-auto inline-flex items-center gap-1 text-slate-500 hover:text-rose-300"><Trash2 className="h-3.5 w-3.5" /> Delete</button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <p className={`${panel} text-sm text-slate-500`}>{tab === "clips" ? "No clips shared yet." : "No posts yet."}</p>
              )}
            </div>
          ) : null}

          {tab === "streams" ? (
            <div className={panel}>
              {person.creatorStatus === "LIVE" ? (
                <div className="space-y-2">
                  <p className="inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-rose-400"><Radio className="h-3 w-3" /> Live now on {person.livePlatform ?? "stream"}</p>
                  <h3 className="text-lg font-semibold text-white">{person.liveStreamTitle ?? `${displayName} is live`}</h3>
                  <p className="text-sm text-slate-400">{person.liveGameCategory} · {compact(person.liveViewerCount)} watching</p>
                  {person.liveStreamUrl ? <a href={person.liveStreamUrl} target="_blank" rel="noopener noreferrer" className={goldBtn}>Watch stream</a> : null}
                </div>
              ) : (
                <div className="space-y-2 text-sm text-slate-400">
                  <p>{profile.isSelf ? "You are not live." : `${displayName} is not live right now.`}</p>
                  {person.socialLinks && Object.values(person.socialLinks).some(Boolean) ? (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {Object.entries(person.socialLinks).filter(([, value]) => value).map(([key, value]) => (
                        <span key={key} className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-slate-200"><span className="uppercase text-slate-500">{key}</span> {value}</span>
                      ))}
                    </div>
                  ) : profile.isSelf ? (
                    <Link href="/app/settings" className="text-amber-300 hover:text-amber-200">Link your Twitch, Kick or YouTube in Settings.</Link>
                  ) : null}
                </div>
              )}

              <div className="mt-4 border-t border-white/5 pt-4">
                <h3 className={`${sectionTitle} mb-3`}>Past streams</h3>
                {streamsQuery.isLoading ? (
                  <p className="text-sm text-slate-400">Loading...</p>
                ) : streamsQuery.data?.streams.filter((stream) => stream.endedAt).length ? (
                  <ul className="space-y-2">
                    {streamsQuery.data.streams.filter((stream) => stream.endedAt).map((stream) => {
                      const minutes = Math.max(1, Math.round((new Date(stream.endedAt!).getTime() - new Date(stream.startedAt).getTime()) / 60_000));
                      const duration = minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : `${minutes}m`;
                      return (
                        <li key={stream.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-white/5 bg-[#11151e] px-3 py-2.5">
                          <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300"><Radio className="h-4 w-4" /></span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-white">{stream.title || "Untitled stream"}</p>
                            <p className="text-[11px] text-slate-400">{stream.platform}{stream.game ? ` · ${stream.game}` : ""} · {new Date(stream.startedAt).toLocaleDateString()} {new Date(stream.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>
                          </div>
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-300"><Clock className="h-3 w-3 text-slate-500" /> {duration}</span>
                          {stream.peakViewers > 0 ? <span className="text-[11px] text-slate-400">{compact(stream.peakViewers)} peak</span> : null}
                          {stream.url ? <a href={stream.url} target="_blank" rel="noopener noreferrer" className="text-[11px] uppercase tracking-[0.14em] text-amber-300 hover:text-amber-200">VOD</a> : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm text-slate-500">{profile.isSelf ? "Your finished streams will be listed here." : "No past streams yet."}</p>
                )}
              </div>
            </div>
          ) : null}

          {tab === "achievements" ? (
            <div className={panel}>
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs text-slate-400">
                  <span className="font-semibold text-white">{unlockedAchievements.length}</span> of {achievements.length} unlocked
                </p>
                <span className="flex gap-1">
                  {achievements.slice(0, 12).map((entry) => <span key={entry.key} className={`h-1.5 w-3 rounded-full ${entry.unlocked ? "bg-amber-400" : "bg-slate-700"}`} />)}
                </span>
              </div>
              {achievementsQuery.isLoading ? (
                <p className="text-sm text-slate-400">Loading...</p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[...achievements].sort((a, b) => Number(b.unlocked) - Number(a.unlocked)).map((entry) => (
                    <div key={entry.key} className={`flex items-center gap-3 rounded-xl border p-3 ${entry.unlocked ? "border-amber-400/40 bg-[#11151e] shadow-[0_0_18px_rgba(230,179,37,0.12)]" : "border-white/5 bg-[#11151e] opacity-60"}`}>
                      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border text-xl ${entry.unlocked ? "border-amber-400/50 bg-amber-500/10" : "border-white/10 bg-slate-900 grayscale"}`}>{entry.icon || <Award className="h-5 w-5 text-amber-300" />}</span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-white">{entry.name}</p>
                        <p className="truncate text-[11px] text-slate-400">{entry.description}</p>
                        <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">{entry.unlocked && entry.unlockedAt ? `Unlocked ${new Date(entry.unlockedAt).toLocaleDateString()}` : "Locked"}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {tab === "friends" ? (
            <div className={panel}>
              {friends.length ? (
                <ul className="grid gap-2 sm:grid-cols-2">
                  {friends.map((entry) => {
                    const other = entry.senderId === self?.id ? entry.receiver : entry.sender;
                    return (
                      <li key={entry.id}>
                        <Link href={`/app/profile?user=${other.id}`} className="flex items-center gap-3 rounded-xl border border-white/5 bg-[#11151e] p-2.5 transition hover:border-amber-400/40">
                          {other.avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={other.avatar} alt="" className="h-9 w-9 rounded-full object-cover" />
                          ) : (
                            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-amber-100">{initials(other.username)}</span>
                          )}
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-white">{other.username}</span>
                            <span className="block text-[11px] text-slate-500">{other.status === "OFFLINE" ? "Offline" : other.game || other.status.toLowerCase()}</span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-slate-500">No friends yet. Find players from the Friends page.</p>
              )}
            </div>
          ) : null}
        </div>

        <aside className="space-y-4">
          {profile.isSelf ? (
            <div className={panel}>
              <div className="mb-3 flex items-center justify-between">
                <h3 className={sectionTitle}>Avatar Presets</h3>
                <Link href="/app/avatar" className="text-[11px] uppercase tracking-[0.16em] text-amber-300 hover:text-amber-200">Studio</Link>
              </div>
              {avatarQuery.data?.presets.length ? (
                <div className="grid grid-cols-2 gap-2">
                  {avatarQuery.data.presets.slice(0, 4).map((preset) => (
                    <button key={preset.id} type="button" onClick={() => applyPresetMutation.mutate(preset.id)} className="overflow-hidden rounded-xl border border-white/5 bg-[#11151e] text-left transition hover:border-amber-400/50" title="Apply preset">
                      <div className="flex h-24 items-end justify-center overflow-hidden">
                        <AvatarRenderer config={preset.config} size={90} />
                      </div>
                      <p className="truncate px-2 py-1.5 text-[11px] font-semibold text-white">{preset.name}</p>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">Save looks in the Avatar Studio and switch between them here.</p>
              )}
            </div>
          ) : null}

          <div className={panel}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className={sectionTitle}>Achievements</h3>
              <button type="button" onClick={() => setTab("achievements")} className="text-[11px] uppercase tracking-[0.16em] text-amber-300 hover:text-amber-200">View all</button>
            </div>
            {unlockedAchievements.length ? (
              <div className="grid grid-cols-4 gap-2">
                {unlockedAchievements.slice(0, 8).map((entry) => (
                  <div key={entry.key} className="flex flex-col items-center gap-1 rounded-lg border border-amber-400/30 bg-[#11151e] px-1 py-2 text-center" title={entry.description}>
                    <span className="text-xl">{entry.icon}</span>
                    <span className="w-full truncate text-[9px] font-semibold uppercase tracking-[0.1em] text-slate-300">{entry.name}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500">{achievementsQuery.isLoading ? "Loading..." : "Nothing unlocked yet. Post, chat, make friends and go live to earn medals."}</p>
            )}
          </div>

          <div className={panel}>
            <h3 className={`${sectionTitle} mb-3`}>Overview</h3>
            <dl className="space-y-2 text-xs">
              {[
                ["Member since", new Date(person.createdAt).toLocaleDateString([], { month: "short", year: "numeric" })],
                ["Forges", String(person._count.memberships)],
                ["Achievements", `${unlockedAchievements.length}/${achievements.length || "…"}`],
                ["Posts", String(person._count.posts)],
                ["Status", person.status.toLowerCase()],
              ].map(([label, value]) => (
                <div key={label} className="flex items-center justify-between border-b border-white/5 pb-2 last:border-0">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className="text-slate-200">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {profile.isSelf ? (
            <div className={panel}>
              <h3 className={`${sectionTitle} mb-2`}>Friends</h3>
              <Link href="/app/friends" className="inline-flex items-center gap-2 text-sm text-amber-300 hover:text-amber-200"><Users className="h-4 w-4" /> Manage friends and requests</Link>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
