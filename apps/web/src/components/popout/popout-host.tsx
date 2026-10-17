"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownLeft, MonitorUp } from "lucide-react";
import { getForge } from "@/lib/api";
import { popoutWindowName } from "@/lib/popout/popout-support";
import { useAuthStore } from "@/store/auth-store";
import { usePopoutStore, type PopoutState } from "@/store/popout-store";
import { useVoiceStore } from "@/store/voice-store";
import { PopoutWindow } from "@/components/popout/popout-window";
import { VoiceRoomPanel } from "@/components/chat/voice-room-panel";
import { MemberList } from "@/components/chat/member-list";

/** The popout's own small header: what it is, and a way back into the main window. */
function PopoutFrame({ title, onReturn, children }: { title: string; onReturn: () => void; children: ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[#070a10] text-slate-100">
      <div className="flex h-10 shrink-0 items-center justify-between gap-2 border-b border-white/[0.06] bg-[#0b0e17] px-3">
        <p className="truncate text-xs font-semibold uppercase tracking-[0.14em] text-slate-300">{title}</p>
        <button
          type="button"
          onClick={onReturn}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-slate-200 transition hover:border-amber-400/60 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
        >
          <ArrowDownLeft className="h-3.5 w-3.5" /> Back to main window
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-3">{children}</div>
    </div>
  );
}

function useForgeMembers(forgeId: string | null | undefined) {
  const accessToken = useAuthStore((state) => state.accessToken);
  // Same query as the shell and chat page, so this reads the cached server and updates with it.
  return useQuery({
    queryKey: ["forge", forgeId, accessToken],
    queryFn: () => getForge(accessToken!, forgeId!),
    enabled: Boolean(accessToken && forgeId),
  });
}

/** A shared screen on its own: the stream already received by this page, shown big in a second window. */
function ShareViewer({ shareKey, name, onEnded }: { shareKey: string; name: string; onEnded: () => void }) {
  const stream = useVoiceStore((state) => (shareKey === "self" ? state.localScreen : state.remote.find((entry) => entry.userId === shareKey)?.video ?? null));
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.srcObject = stream;
    if (stream) void video.play().catch(() => undefined);
  }, [stream]);
  // The share stopped: say so briefly, then close the window.
  useEffect(() => {
    if (stream) return;
    const timer = window.setTimeout(onEnded, 4000);
    return () => window.clearTimeout(timer);
  }, [stream, onEnded]);
  return (
    <div className="relative flex h-full min-h-[200px] items-center justify-center overflow-hidden rounded-xl border border-amber-500/30 bg-black">
      {stream ? (
        <video ref={ref} autoPlay playsInline muted className="h-full w-full object-contain" />
      ) : (
        <p className="px-4 text-center text-sm text-slate-300">{shareKey === "self" ? "You stopped sharing." : `${name} stopped sharing.`} This window closes in a moment.</p>
      )}
      {stream ? (
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-lg bg-black/70 px-2.5 py-1 text-xs font-semibold text-white">
          <MonitorUp className="h-3.5 w-3.5 text-amber-300" /> {shareKey === "self" ? "Your screen" : `${name}'s screen`}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Renders whatever is popped out. It lives in the app shell, so popouts stay open while you move between pages, and
 * they all close with the main window.
 */
export function PopoutHost() {
  const voice = usePopoutStore((state) => state.voice);
  const share = usePopoutStore((state) => state.share);
  const members = usePopoutStore((state) => state.members);
  const close = usePopoutStore((state) => state.close);
  const focusRequest = usePopoutStore((state) => state.focusRequest);
  const session = useVoiceStore((state) => state.session);
  const selfId = useAuthStore((state) => state.user?.id);
  const voiceForge = useForgeMembers(voice ? session?.forgeId : null);
  const memberForge = useForgeMembers(members?.forgeId);

  // Leaving the call (or switching to another channel) ends the voice popout and the share viewer.
  useEffect(() => {
    if (voice && (!session || session.channelId !== voice.channelId)) close("voice");
    if (share && !session) close("share");
  }, [voice, share, session, close]);

  const focusFor = (kind: keyof PopoutState) => (focusRequest?.kind === kind ? focusRequest.at : undefined);
  const closed = (kind: keyof PopoutState) => () => close(kind);

  return (
    <>
      {voice && session ? (
        <PopoutWindow name={popoutWindowName("voice")} title={`${session.channelName} · Voice · Nexus Forge Gaming`} width={1120} height={740} onClosed={closed("voice")} focusSignal={focusFor("voice")}>
          <PopoutFrame title={`${session.channelName} · voice`} onReturn={closed("voice")}>
            <div className="flex h-full min-h-0 flex-col rounded-2xl border border-amber-500/20 bg-[#0d1119] p-3 text-slate-100">
              <VoiceRoomPanel members={voiceForge.data?.forge.members ?? []} inPopout />
            </div>
          </PopoutFrame>
        </PopoutWindow>
      ) : null}
      {share ? (
        <PopoutWindow name={popoutWindowName("share")} title={`${share.key === "self" ? "Your screen" : `${share.name}'s screen`} · Nexus Forge Gaming`} width={1280} height={760} onClosed={closed("share")} focusSignal={focusFor("share")}>
          <PopoutFrame title={share.key === "self" ? "Your screen" : `${share.name}'s screen`} onReturn={closed("share")}>
            <ShareViewer shareKey={share.key} name={share.name} onEnded={closed("share")} />
          </PopoutFrame>
        </PopoutWindow>
      ) : null}
      {members && memberForge.data?.forge && selfId ? (
        <PopoutWindow name={popoutWindowName("members")} title={`Members · ${memberForge.data.forge.name} · Nexus Forge Gaming`} width={340} height={720} onClosed={closed("members")} focusSignal={focusFor("members")}>
          <PopoutFrame title={`${memberForge.data.forge.name} · members`} onReturn={closed("members")}>
            <MemberList members={memberForge.data.forge.members} roles={memberForge.data.forge.roles} ownerId={memberForge.data.forge.ownerId} selfId={selfId} />
          </PopoutFrame>
        </PopoutWindow>
      ) : null}
    </>
  );
}
