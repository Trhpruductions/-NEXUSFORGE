"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Check, Loader2, MessageSquare, Radio, Sparkles, UserPlus, UserRound, X } from "lucide-react";
import { createDmThread, followUser, getApiErrorMessage, getProfileSummary, sendFriendRequest, unfollowUser, updateFriendStatus } from "@/lib/api";
import { AvatarRenderer, defaultAvatarConfig } from "@/components/avatar/avatar-renderer";
import { useAuthStore } from "@/store/auth-store";

const presence: Record<string, { label: string; dot: string }> = {
  ONLINE: { label: "Online", dot: "bg-emerald-400" },
  IDLE: { label: "Idle", dot: "bg-yellow-300" },
  DND: { label: "Do not disturb", dot: "bg-rose-400" },
  OFFLINE: { label: "Offline", dot: "bg-slate-600" },
};

/**
 * Mini profile popover used from chat authors and the member list.
 * Anchored to the trigger; closes on outside click or Escape.
 */
export function UserCard({ userId, onClose, align = "left" }: { userId: string; onClose: () => void; align?: "left" | "right" }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { accessToken, csrfToken } = useAuthStore();
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const query = useQuery({
    queryKey: ["profile-summary", userId, accessToken],
    queryFn: () => getProfileSummary(accessToken!, userId),
    enabled: Boolean(accessToken),
  });
  const profile = query.data;
  const person = profile?.user;
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["profile-summary", userId] });

  const friendMutation = useMutation({
    mutationFn: async () => {
      if (profile?.friendship?.status === "PENDING" && profile.friendship.incoming) return updateFriendStatus(accessToken!, csrfToken!, profile.friendship.id, "ACCEPTED");
      return sendFriendRequest(accessToken!, csrfToken!, userId);
    },
    onSuccess: async () => {
      await refresh();
      await queryClient.invalidateQueries({ queryKey: ["friends"] });
    },
  });
  const followMutation = useMutation({
    mutationFn: () => (profile?.isFollowing ? unfollowUser(accessToken!, csrfToken!, userId) : followUser(accessToken!, csrfToken!, userId)),
    onSuccess: refresh,
  });
  const messageMutation = useMutation({
    mutationFn: () => createDmThread(accessToken!, csrfToken!, userId),
    onSuccess: (result) => {
      onClose();
      router.push(`/app/chat?dm=${result.thread.id}`);
    },
  });

  const error = friendMutation.error ?? followMutation.error ?? messageMutation.error;
  const status = presence[person?.status ?? "OFFLINE"] ?? presence.OFFLINE;
  const friendLabel = !profile?.friendship
    ? "Add friend"
    : profile.friendship.status === "ACCEPTED"
      ? "Friends"
      : profile.friendship.status === "PENDING"
        ? profile.friendship.incoming
          ? "Accept request"
          : "Request sent"
        : "Blocked";
  const friendDisabled = profile?.friendship?.status === "ACCEPTED" || (profile?.friendship?.status === "PENDING" && !profile.friendship.incoming) || profile?.friendship?.status === "BLOCKED";

  return (
    <div ref={ref} className={`absolute z-40 mt-1 w-72 overflow-hidden rounded-2xl border border-amber-500/25 bg-[#0d1119] shadow-[0_20px_50px_rgba(0,0,0,0.6)] ${align === "right" ? "right-0" : "left-0"}`}>
      <div className="relative h-16 bg-[radial-gradient(circle_at_30%_40%,rgba(230,179,37,0.35),transparent_60%),linear-gradient(160deg,#141a26,#0b0e15)]">
        {person?.banner ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={person.banner} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : null}
        <button type="button" onClick={onClose} className="absolute right-2 top-2 rounded-md bg-black/40 p-1 text-slate-300 hover:text-white" title="Close"><X className="h-3.5 w-3.5" /></button>
      </div>
      <div className="relative px-4 pb-4">
        <div className="-mt-8 flex items-end gap-3">
          <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-4 border-[#0d1119] bg-[#11151e]">
            {person?.avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={person.avatar} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-end justify-center overflow-hidden"><AvatarRenderer config={person?.avatarConfig ?? defaultAvatarConfig} size={80} showBackground={false} className="-mb-12 -mt-1" /></span>
            )}
            <span className={`absolute bottom-1 right-1 h-3 w-3 rounded-full border-2 border-[#0d1119] ${status.dot}`} />
          </span>
        </div>
        {query.isLoading || !person ? (
          <p className="mt-3 text-sm text-slate-400"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading...</p>
        ) : (
          <>
            <p className="mt-2 truncate text-base font-bold text-white">{person.displayName || person.username}</p>
            <p className="truncate text-xs text-slate-400">@{person.username}{person.clanTag ? ` · [${person.clanTag}]` : ""} · {status.label}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {person.creatorStatus === "LIVE" ? <span className="inline-flex items-center gap-1 rounded-full bg-rose-500 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em] text-white"><Radio className="h-3 w-3" /> Live</span> : null}
              {person.ageVerificationLevel === "VERIFIED" ? <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/40 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-emerald-200"><BadgeCheck className="h-3 w-3" /> Verified 18+</span> : null}
              {person.isCreator ? <span className="inline-flex items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-amber-200"><Sparkles className="h-3 w-3" /> Creator</span> : null}
              {profile?.followsYou ? <span className="rounded-full border border-white/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-300">Follows you</span> : null}
            </div>
            {person.bio ? <p className="mt-2 line-clamp-2 text-xs text-slate-300">{person.bio}</p> : null}
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[
                ["Followers", person._count.followers],
                ["Points", person.points],
                ["Medals", person._count.medals],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-white/5 bg-[#11151e] py-1.5">
                  <p className="text-sm font-bold text-white">{Number(value).toLocaleString()}</p>
                  <p className="text-[9px] uppercase tracking-[0.14em] text-slate-500">{label}</p>
                </div>
              ))}
            </div>
            {error ? <p className="mt-2 text-[11px] text-rose-300">{getApiErrorMessage(error)}</p> : null}
            {!profile?.isSelf ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {profile?.friendship?.status === "ACCEPTED" ? (
                  <button type="button" onClick={() => messageMutation.mutate()} disabled={messageMutation.isPending} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-400 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-950 hover:bg-amber-300 disabled:opacity-50">
                    {messageMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />} Message
                  </button>
                ) : (
                  <button type="button" onClick={() => friendMutation.mutate()} disabled={friendDisabled || friendMutation.isPending} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-400 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-950 hover:bg-amber-300 disabled:opacity-50">
                    {friendMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : friendDisabled ? <Check className="h-3.5 w-3.5" /> : <UserPlus className="h-3.5 w-3.5" />} {friendLabel}
                  </button>
                )}
                <button type="button" onClick={() => followMutation.mutate()} disabled={followMutation.isPending} className={`inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] ${profile?.isFollowing ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200" : "border-white/10 text-slate-200 hover:border-amber-400/50"}`}>
                  {profile?.isFollowing ? <><Check className="h-3.5 w-3.5" /> Following</> : "Follow"}
                </button>
              </div>
            ) : null}
            <Link href={profile?.isSelf ? "/app/profile" : `/app/profile?user=${userId}`} onClick={onClose} className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-200 hover:border-amber-400/50">
              <UserRound className="h-3.5 w-3.5" /> View profile
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
