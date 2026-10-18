"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Check, Loader2, MessageSquare, Radio, Sparkles, UserPlus, UserRound, X } from "lucide-react";
import { UserNote } from "@/components/social/user-note";
import { UserSafetyActions } from "@/components/social/user-safety-actions";
import { createDmThread, followUser, getApiErrorMessage, getProfileSummary, sendFriendRequest, unfollowUser, updateFriendStatus } from "@/lib/api";
import { AvatarRenderer, defaultAvatarConfig } from "@/components/avatar/avatar-renderer";
import { useAuthStore } from "@/store/auth-store";
import { CoverArt } from "@/components/ui/cover-art";
import { ProfileBadgeStrip } from "@/components/profile/profile-badge-strip";
import { badgesFromKeys } from "@/lib/brand-badges";

const presence: Record<string, { label: string; dot: string }> = {
  ONLINE: { label: "Online", dot: "bg-emerald-400" },
  IDLE: { label: "Idle", dot: "bg-yellow-300" },
  DND: { label: "Do not disturb", dot: "bg-rose-400" },
  OFFLINE: { label: "Offline", dot: "bg-slate-600" },
};

const EDGE = 8;
const GAP = 4;

/**
 * Mini profile popover used from chat authors and the member list. Render it inside the trigger's `relative`
 * wrapper: it anchors to that wrapper but is drawn over the whole window, so a narrow or scrolling panel (the
 * member list, the message list) can't cut it off. Opens below the trigger, or above it when there's no room
 * below. Closes on outside click, Escape, or when the trigger scrolls out of view.
 */
export function UserCard({ userId, onClose, align = "left" }: { userId: string; onClose: () => void; align?: "left" | "right" }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { accessToken, csrfToken } = useAuthStore();
  const ref = useRef<HTMLDivElement | null>(null);
  // Covers the trigger's wrapper: where the card anchors, and which window it belongs to.
  const anchorRef = useRef<HTMLSpanElement | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  // The member list can be popped out into its own window: the card goes into that window's page, not the main one.
  useLayoutEffect(() => {
    setHost(anchorRef.current?.ownerDocument.body ?? null);
  }, []);

  const place = useCallback(() => {
    const anchorEl = anchorRef.current;
    const card = ref.current;
    const view = anchorEl?.ownerDocument.defaultView;
    if (!anchorEl || !card || !view) return;
    const anchor = anchorEl.getBoundingClientRect();
    const viewWidth = anchorEl.ownerDocument.documentElement.clientWidth || view.innerWidth;
    const viewHeight = view.innerHeight;
    if (anchor.bottom < 0 || anchor.top > viewHeight) {
      onClose();
      return;
    }
    const width = card.offsetWidth;
    const height = card.offsetHeight;
    const left = Math.max(EDGE, Math.min(align === "right" ? anchor.right - width : anchor.left, viewWidth - width - EDGE));
    let top = anchor.bottom + GAP;
    if (top + height > viewHeight - EDGE) {
      const above = anchor.top - GAP - height;
      top = above >= EDGE ? above : Math.max(EDGE, viewHeight - height - EDGE);
    }
    setPosition((current) => (current && current.top === top && current.left === left ? current : { top, left }));
  }, [align, onClose]);

  // Re-measure after every render (the card grows once the profile loads), and follow the trigger on scroll/resize.
  useLayoutEffect(() => {
    place();
  });
  useEffect(() => {
    const view = anchorRef.current?.ownerDocument.defaultView;
    if (!view) return;
    let frame = 0;
    const onMove = () => {
      view.cancelAnimationFrame(frame);
      frame = view.requestAnimationFrame(place);
    };
    view.addEventListener("scroll", onMove, true);
    view.addEventListener("resize", onMove);
    return () => {
      view.cancelAnimationFrame(frame);
      view.removeEventListener("scroll", onMove, true);
      view.removeEventListener("resize", onMove);
    };
  }, [place]);

  useEffect(() => {
    const onDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (ref.current?.contains(target)) return;
      // A press on the trigger itself is left to its own click, which toggles the card closed.
      if (anchorRef.current?.parentElement?.contains(target)) return;
      onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    // The document the card is shown in: clicks and keys in a popout window never reach the main window's document.
    const doc = anchorRef.current?.ownerDocument ?? document;
    doc.addEventListener("mousedown", onDown);
    doc.addEventListener("keydown", onKey);
    return () => {
      doc.removeEventListener("mousedown", onDown);
      doc.removeEventListener("keydown", onKey);
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

  const card = (
    <div
      ref={ref}
      className="fixed z-50 max-h-[calc(100dvh-16px)] w-72 overflow-y-auto overflow-x-hidden rounded-2xl border border-amber-500/25 bg-[#0d1119] shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
      // Measured off-screen first, then shown in place (all before the first paint).
      style={position ? { top: position.top, left: position.left } : { top: 0, left: 0, visibility: "hidden" }}
    >
      <div className="relative h-16 bg-[radial-gradient(circle_at_30%_40%,rgba(46,164,255,0.35),transparent_60%),linear-gradient(160deg,#141a26,#0b0e15)]">
        {person?.banner ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={person.banner} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : person ? (
          <CoverArt seed={person.id} variant="rings" className="absolute inset-0 h-full w-full" />
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
            <ProfileBadgeStrip badges={badgesFromKeys(person.badges)} containerClassName="mt-2" imageWidth={36} imageHeight={36} />
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
            {profile && !profile.isSelf ? <UserNote userId={userId} /> : null}
            {profile && !profile.isSelf && person ? <UserSafetyActions userId={userId} username={person.username} blockedByMe={Boolean(profile.blockedByMe)} /> : null}
            <Link href={profile?.isSelf ? "/app/profile" : `/app/profile?user=${userId}`} onClick={onClose} className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-200 hover:border-amber-400/50">
              <UserRound className="h-3.5 w-3.5" /> View profile
            </Link>
          </>
        )}
      </div>
    </div>
  );

  return (
    <>
      <span ref={anchorRef} aria-hidden="true" className="pointer-events-none absolute inset-0" />
      {host ? createPortal(card, host) : null}
    </>
  );
}
