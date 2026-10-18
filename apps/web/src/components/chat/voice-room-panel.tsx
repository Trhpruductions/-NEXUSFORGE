"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  ExternalLink,
  Hand,
  Headphones,
  HeadphoneOff,
  LayoutGrid,
  Loader2,
  Maximize2,
  Mic,
  MicOff,
  MonitorUp,
  MonitorX,
  PhoneOff,
  Radio,
  Settings2,
  Video,
  VideoOff,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
} from "lucide-react";
import { getSocket } from "@/lib/socket";
import { useAuthStore } from "@/store/auth-store";
import { useVoiceStore } from "@/store/voice-store";
import { SoundboardButton } from "@/components/chat/soundboard-button";
import { useMediaStore } from "@/lib/media/media-store";
import { useMediaDevices } from "@/components/voice/use-media-devices";
import { DevicePicker, voiceLabel } from "@/components/voice/device-picker";
import { desktopAppVersion, isDesktopApp, outputSelectionSupported } from "@/lib/media/media-devices";
import { DESKTOP_SCREEN_SHARE_VERSION, desktopTooOldForScreenShare, realDevices } from "@/lib/media/media-prefs";
import { popoutsSupported } from "@/lib/popout/popout-support";
import { fitGrid } from "@/lib/layout/fit-grid";
import { usePopoutStore } from "@/store/popout-store";
import { useLayoutPrefs } from "@/store/layout-store";

type MemberLike = { userId: string; user: { id: string; username: string; displayName?: string | null; avatar?: string | null } };

type Participant = {
  userId: string;
  name: string;
  avatar?: string | null;
  self: boolean;
  /** The real peer connection state for others; for you, whether the call is up. */
  state: RTCPeerConnectionState | "self-connecting" | "self-connected";
  muted: boolean;
  deafened: boolean;
  camera: MediaStream | null;
  sharing: boolean;
};

type Share = { key: string; userId: string; name: string; stream: MediaStream; self: boolean };

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "NF";
}

/** Plays a MediaStream in a video element; re-attaches when the stream changes. */
function StreamVideo({ stream, className, mirror = false }: { stream: MediaStream; className: string; mirror?: boolean }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    video.srcObject = stream;
    // Shared screens and cameras carry no audio here, so muted playback is always allowed to start.
    void video.play().catch(() => undefined);
  }, [stream]);
  return <video ref={ref} autoPlay playsInline muted className={className} style={mirror ? { transform: "scaleX(-1)" } : undefined} />;
}

/** One person: camera or avatar, name, speaking ring from their real audio level, mute/deafen/sharing and connection state. */
function ParticipantTile({
  participant,
  level,
  volume,
  onVolume,
  compact,
  action,
}: {
  participant: Participant;
  level: number;
  volume: number;
  onVolume?: (volume: number) => void;
  compact?: boolean;
  action?: ReactNode;
}) {
  const [volumeOpen, setVolumeOpen] = useState(false);
  const speaking = level > 8 && !participant.muted;
  const connecting = participant.state === "new" || participant.state === "connecting" || participant.state === "self-connecting";
  const reconnecting = participant.state === "disconnected";
  const failed = participant.state === "failed" || participant.state === "closed";
  const label = `${participant.name}${participant.self ? " (you)" : ""}`;
  const status = [participant.deafened ? "deafened" : participant.muted ? "muted" : speaking ? "speaking" : null, participant.sharing ? "sharing their screen" : null, connecting ? "connecting" : reconnecting ? "reconnecting" : failed ? "can't connect" : null]
    .filter(Boolean)
    .join(", ");
  return (
    <div
      role="group"
      aria-label={status ? `${label}: ${status}` : label}
      className={`relative overflow-hidden rounded-xl border bg-slate-900/80 transition ${compact ? "h-24 w-40 shrink-0" : "aspect-video w-full"} ${speaking ? "border-emerald-400 shadow-[0_0_0_1px_rgba(52,211,153,0.6),0_0_22px_rgba(52,211,153,0.25)]" : "border-white/10"}`}
    >
      {participant.camera ? (
        <StreamVideo stream={participant.camera} mirror={participant.self} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          {participant.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={participant.avatar} alt="" className={`${compact ? "h-10 w-10" : "h-16 w-16 sm:h-20 sm:w-20"} rounded-full border-2 object-cover ${speaking ? "border-emerald-400" : "border-amber-500/40"}`} />
          ) : (
            <span className={`flex items-center justify-center rounded-full border-2 bg-slate-800 font-bold text-amber-100 ${compact ? "h-10 w-10 text-xs" : "h-16 w-16 text-lg sm:h-20 sm:w-20"} ${speaking ? "border-emerald-400" : "border-amber-500/40"}`}>
              {initials(participant.name)}
            </span>
          )}
        </div>
      )}

      {participant.sharing ? (
        <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-md bg-amber-500/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-slate-950" title="Sharing their screen">
          <MonitorUp className="h-3 w-3" aria-hidden="true" />
          {compact ? null : "Sharing"}
        </span>
      ) : null}
      {connecting || reconnecting || failed ? (
        <span className={`absolute right-2 top-2 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${failed ? "bg-rose-500/90 text-white" : "bg-black/70 text-amber-200"}`}>
          {failed ? <WifiOff className="h-3 w-3" aria-hidden="true" /> : <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
          {failed ? "Can't connect" : reconnecting ? "Reconnecting" : "Connecting"}
        </span>
      ) : null}

      <div className="absolute inset-x-2 bottom-2 flex items-center justify-between gap-2">
        <span className="inline-flex min-w-0 items-center gap-1.5 rounded-lg bg-black/65 px-2 py-1 text-xs font-semibold text-white backdrop-blur">
          {participant.deafened ? (
            <HeadphoneOff className="h-3.5 w-3.5 shrink-0 text-rose-300" aria-hidden="true" />
          ) : participant.muted ? (
            <MicOff className="h-3.5 w-3.5 shrink-0 text-rose-300" aria-hidden="true" />
          ) : (
            <Mic className={`h-3.5 w-3.5 shrink-0 ${speaking ? "text-emerald-300" : "text-slate-300"}`} aria-hidden="true" />
          )}
          <span className="truncate">{label}</span>
          {onVolume && volume < 1 ? <span className="shrink-0 text-[10px] font-normal text-slate-300">{Math.round(volume * 100)}%</span> : null}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {action}
          {onVolume ? (
            <button
              type="button"
              onClick={() => setVolumeOpen((open) => !open)}
              aria-expanded={volumeOpen}
              aria-label={`Volume for ${participant.name}`}
              title={`Volume for ${participant.name}`}
              className="rounded-md border border-white/10 bg-black/60 p-1 text-slate-200 hover:border-amber-400/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
            >
              {volume === 0 ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            </button>
          ) : null}
        </span>
      </div>
      {volumeOpen && onVolume ? (
        <div className="absolute inset-x-2 bottom-11 rounded-lg border border-white/10 bg-slate-950/95 p-2 text-[11px] text-slate-200 shadow-lg">
          <label className="flex items-center gap-2">
            <span className="shrink-0">Volume</span>
            <input type="range" min={0} max={100} step={5} value={Math.round(volume * 100)} onChange={(event) => onVolume(Number(event.target.value) / 100)} className="w-full accent-amber-400" aria-label={`Volume for ${participant.name}`} />
            <span className="w-9 shrink-0 text-right">{Math.round(volume * 100)}%</span>
          </label>
          <p className="mt-1 text-[10px] text-slate-500">Only changes what you hear.</p>
        </div>
      ) : null}
      <span className="absolute inset-x-0 bottom-0 h-0.5 bg-transparent" aria-hidden="true">
        <span className="block h-full bg-emerald-400 transition-[width] duration-100" style={{ width: `${speaking ? Math.min(100, level) : 0}%` }} />
      </span>
    </div>
  );
}

/** What this app is and whether it can share a screen: the first thing to check when sharing fails. */
function screenShareReadiness(desktopVersion: string | null): { app: string; share: string; ok: boolean } {
  const app = desktopVersion ? `Nexus Forge Desktop ${desktopVersion}` : isDesktopApp() ? "Nexus Forge Desktop (version unknown)" : "Web browser";
  if (desktopTooOldForScreenShare(desktopVersion)) return { app, share: `needs Desktop ${DESKTOP_SCREEN_SHARE_VERSION} or newer`, ok: false };
  const available = typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getDisplayMedia === "function";
  return { app, share: available ? "ready" : "not available here", ok: available };
}

/** Microphone, speakers and camera for this call, with what to do when a device is missing or blocked. */
function CallDevices({ desktopVersion }: { desktopVersion: string | null }) {
  const prefs = useMediaStore((state) => state.prefs);
  const update = useMediaStore((state) => state.update);
  const screenShare = useMediaStore((state) => state.screenShare);
  const { devices, microphone, camera } = useMediaDevices();
  const mics = realDevices(devices, "audioinput").length;
  const cameras = realDevices(devices, "videoinput").length;
  const canPickOutput = outputSelectionSupported();
  const readiness = screenShareReadiness(desktopVersion);
  const note = (text: string) => <p className="mt-1 text-[11px] text-amber-200">{text}</p>;
  return (
    <div className="space-y-2 rounded-xl border border-white/[0.06] bg-black/20 p-3">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div>
        <DevicePicker id="call-mic" label="Microphone" kind="audioinput" devices={devices} value={prefs.micDeviceId} onChange={(micDeviceId) => update({ micDeviceId })} />
        {microphone === "denied" ? note("Microphone access is blocked. Allow it in Windows Settings > Privacy > Microphone (or the browser's site settings), then rejoin.") : mics === 0 ? note("No microphone found. Plug one in and it appears here.") : null}
      </div>
      <div>
        {canPickOutput ? (
          <DevicePicker id="call-speaker" label="Speakers" kind="audiooutput" devices={devices} value={prefs.speakerDeviceId} onChange={(speakerDeviceId) => update({ speakerDeviceId })} />
        ) : (
          <>
            <span className={voiceLabel}>Speakers</span>
            <p className="text-xs text-slate-400">This browser plays through your system&apos;s default speakers. Change them in your sound settings.</p>
          </>
        )}
      </div>
      <div>
        <DevicePicker id="call-camera" label="Camera" kind="videoinput" devices={devices} value={prefs.cameraDeviceId} onChange={(cameraDeviceId) => update({ cameraDeviceId })} />
        {camera === "denied" ? note("Camera access is blocked. Allow it in Windows Settings > Privacy > Camera (or the browser's site settings).") : cameras === 0 ? note("No camera found.") : null}
      </div>
      <label className="block text-xs text-slate-300">
        <span className={voiceLabel}>Everyone&apos;s volume: {prefs.outputVolume}%</span>
        <input type="range" min={0} max={100} step={5} value={prefs.outputVolume} onChange={(event) => update({ outputVolume: Number(event.target.value) })} className="mt-3 w-full accent-amber-400" aria-label="Everyone's volume" />
      </label>
    </div>
      <p className="border-t border-white/[0.06] pt-2 text-[11px] text-slate-400">
        <span className="text-slate-500">Running in:</span> {readiness.app} · <span className="text-slate-500">Screen sharing:</span>{" "}
        <span className={readiness.ok ? "text-emerald-300" : "text-amber-200"}>{readiness.share}</span>
        {screenShare.detail ? <> · <span className="text-slate-500">Last share error:</span> {screenShare.detail}</> : null}
      </p>
    </div>
  );
}

function ControlButton({
  label,
  onClick,
  icon,
  pressed,
  tone = "default",
  disabled,
  title,
}: {
  label: string;
  onClick: () => void;
  icon: ReactNode;
  pressed?: boolean;
  tone?: "default" | "danger" | "accent" | "sky";
  disabled?: boolean;
  title?: string;
}) {
  const active =
    tone === "danger" ? "border-rose-400/60 bg-rose-500/15 text-rose-100" : tone === "sky" ? "border-sky-400/60 bg-sky-500/15 text-sky-100" : "border-amber-400/60 bg-amber-500/15 text-amber-100";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title ?? label}
      aria-label={label}
      aria-pressed={pressed}
      className={`inline-flex h-10 items-center gap-1.5 rounded-lg border px-3 text-[11px] font-semibold uppercase tracking-[0.12em] transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 disabled:cursor-not-allowed disabled:opacity-45 ${pressed ? active : "border-white/10 text-slate-200 hover:border-amber-400/50 hover:bg-white/[0.04]"}`}
    >
      {icon}
      {/* Narrow rooms (sidebars open, small windows, popouts) show icons only, so the bar stays on one line. */}
      <span className="hidden @3xl/controls:inline">{label}</span>
    </button>
  );
}

/** The shared screen in the big area, with who is sharing, full screen, and a switcher when more than one person shares. */
function FocusedShare({
  share,
  shares,
  onSelect,
  onShowGrid,
  onPopout,
  poppedOut,
}: {
  share: Share;
  shares: Share[];
  onSelect: (key: string) => void;
  onShowGrid: () => void;
  /** Watch this share in its own window (when popouts are available). */
  onPopout?: () => void;
  /** This share is open in its own window right now. */
  poppedOut?: { onFocus: () => void; onReturn: () => void };
}) {
  const frame = useRef<HTMLDivElement | null>(null);
  const overlayButton =
    "inline-flex items-center gap-1 rounded-lg border border-white/15 bg-black/70 px-2 py-1 text-[11px] font-semibold text-white hover:border-amber-400/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400";
  return (
    <div className="flex h-full min-h-0 flex-col gap-2">
      <div ref={frame} className="relative min-h-0 flex-1 overflow-hidden rounded-xl border border-amber-500/30 bg-black">
        {poppedOut ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
            <ExternalLink className="h-6 w-6 text-amber-300" aria-hidden="true" />
            <p className="text-sm text-slate-200">{share.self ? "Your screen" : `${share.name}'s screen`} is open in its own window.</p>
            <div className="flex gap-2">
              <button type="button" onClick={poppedOut.onFocus} className={overlayButton}>Show that window</button>
              <button type="button" onClick={poppedOut.onReturn} className={overlayButton}>Watch it here again</button>
            </div>
          </div>
        ) : (
          <StreamVideo stream={share.stream} className="h-full w-full object-contain" />
        )}
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-lg bg-black/70 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
          <span className="h-2 w-2 rounded-full bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.8)]" aria-hidden="true" />
          {share.self ? "You are sharing your screen" : `${share.name}'s screen`}
        </span>
        <span className="absolute right-3 top-3 flex gap-1.5">
          {onPopout && !poppedOut ? (
            <button type="button" onClick={onPopout} className={overlayButton} aria-label="Watch the shared screen in its own window">
              <ExternalLink className="h-3.5 w-3.5" /> Pop out
            </button>
          ) : null}
          {poppedOut ? null : (
            <button type="button" onClick={() => void frame.current?.requestFullscreen?.().catch(() => undefined)} className={overlayButton} aria-label="Watch the shared screen full screen">
              <Maximize2 className="h-3.5 w-3.5" /> Full screen
            </button>
          )}
          <button type="button" onClick={onShowGrid} className={overlayButton}>
            <LayoutGrid className="h-3.5 w-3.5" /> Show everyone
          </button>
        </span>
      </div>
      {shares.length > 1 ? (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Shared screens">
          {shares.map((entry) => (
            <button
              key={entry.key}
              type="button"
              role="tab"
              aria-selected={entry.key === share.key}
              onClick={() => onSelect(entry.key)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs ${entry.key === share.key ? "border-amber-400/60 bg-amber-500/15 text-white" : "border-white/10 text-slate-300 hover:border-white/25"}`}
            >
              <MonitorUp className="h-3.5 w-3.5" /> {entry.self ? "Your screen" : `${entry.name}'s screen`}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Grid columns and width by how many people are in the call, so a tile never stretches across the whole window.
 * Columns follow the room's own width (container queries), not the window's: sidebars and popouts change it.
 */
function gridFor(count: number) {
  if (count <= 1) return "max-w-3xl grid-cols-1";
  if (count <= 4) return "max-w-6xl grid-cols-1 @2xl:grid-cols-2";
  if (count <= 9) return "max-w-7xl grid-cols-2 @4xl:grid-cols-3";
  return "grid-cols-2 @3xl:grid-cols-3 @6xl:grid-cols-4";
}

/**
 * Visible voice room. All state comes from the voice store; the engine runs in the app shell. inPopout: drawn in its
 * own window by PopoutHost (the same call, not a second one).
 */
export function VoiceRoomPanel({ members = [], inPopout = false }: { members?: MemberLike[]; inPopout?: boolean }) {
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const { session, flags, connection, remote, levels, localScreen, localCamera, error, toggle, leave, pushToTalk, stage, peerVolumes, setPeerVolume } = useVoiceStore();
  const micNotice = useMediaStore((state) => state.micNotice);
  const screenShare = useMediaStore((state) => state.screenShare);
  // null = automatic: the big screen view when someone else is sharing, everyone's tiles otherwise.
  const [viewChoice, setView] = useState<"focus" | "grid" | null>(null);
  const [focusedShare, setFocusedShare] = useState<string | null>(null);
  const [showDevices, setShowDevices] = useState(false);
  // Read on the client only: the desktop app tells its version in the user agent.
  const [desktopVersion, setDesktopVersion] = useState<string | null>(null);
  const [canPopout, setCanPopout] = useState(false);
  useEffect(() => {
    setDesktopVersion(desktopAppVersion());
    setCanPopout(popoutsSupported());
  }, []);
  const shareBlocked = desktopTooOldForScreenShare(desktopVersion);
  const layoutPrefs = useLayoutPrefs();
  const openPopout = usePopoutStore((state) => state.open);
  const closePopout = usePopoutStore((state) => state.close);
  const focusPopout = usePopoutStore((state) => state.focus);
  const sharePopout = usePopoutStore((state) => state.share);

  const nameOf = (userId: string) => {
    const member = members.find((entry) => entry.userId === userId || entry.user.id === userId);
    return member?.user.displayName || member?.user.username || "Member";
  };
  const avatarOf = (userId: string) => members.find((entry) => entry.userId === userId || entry.user.id === userId)?.user.avatar ?? null;

  const selfId = user?.id ?? "self";
  const participants = useMemo<Participant[]>(() => {
    const self: Participant = {
      userId: selfId,
      name: user?.displayName || user?.username || "You",
      avatar: user?.avatar ?? null,
      self: true,
      state: connection === "connected" ? "self-connected" : "self-connecting",
      // Deafen cuts the mic too; with push-to-talk the mic is off until the key is held.
      muted: flags.muted || flags.deafened || (pushToTalk.enabled && !pushToTalk.talking),
      deafened: flags.deafened,
      camera: localCamera,
      sharing: Boolean(localScreen),
    };
    return [
      self,
      ...remote.map((entry) => ({
        userId: entry.userId,
        name: entry.name || nameOf(entry.userId),
        avatar: avatarOf(entry.userId),
        self: false,
        state: entry.state ?? (entry.connected ? "connected" : "connecting"),
        muted: Boolean(entry.muted),
        deafened: Boolean(entry.deafened),
        camera: entry.camera ?? null,
        sharing: Boolean(entry.video),
      })),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remote, connection, user, members, flags.muted, flags.deafened, pushToTalk, localCamera, localScreen]);

  // Stage channels: speakers are on stage; everyone else listens. Only speakers are seen.
  const stageMode = Boolean(session?.stage);
  const speakerIds = new Set(stage?.speakers ?? []);
  const raisedIds = new Set(stage?.raised ?? []);
  const moderatorIds = new Set(stage?.moderators ?? []);
  const isSpeaker = (userId: string) => !stageMode || speakerIds.has(userId);
  const selfOnStage = isSpeaker(selfId);
  const selfModerator = moderatorIds.has(selfId);
  const onStage = participants.filter((participant) => isSpeaker(participant.userId));
  const audience = stageMode ? participants.filter((participant) => !isSpeaker(participant.userId)) : [];
  const emitStage = (event: "stage:raise" | "stage:speaker", payload: Record<string, unknown>) => {
    if (!accessToken || !session) return;
    getSocket(accessToken).emit(event, { channelId: session.channelId, ...payload });
  };

  // Screens being shared: other people's first (that is what you came to watch), then your own.
  const shares = useMemo<Share[]>(() => {
    const list: Share[] = remote
      .filter((entry) => entry.video && isSpeaker(entry.userId))
      .map((entry) => ({ key: entry.userId, userId: entry.userId, name: entry.name || nameOf(entry.userId), stream: entry.video!, self: false }));
    if (localScreen && selfOnStage) list.push({ key: "self", userId: selfId, name: "You", stream: localScreen, self: true });
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remote, localScreen, selfOnStage, stage, members]);
  const activeShare = shares.find((entry) => entry.key === focusedShare) ?? shares[0] ?? null;
  // Tiles sized to fill the room's area (both ways) without scrolling; measured in the room's own window, which is a
  // popout's when the room is popped out.
  const [gridArea, setGridArea] = useState<HTMLDivElement | null>(null);
  const [gridBox, setGridBox] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (!gridArea) return;
    const view = gridArea.ownerDocument.defaultView as (Window & typeof globalThis) | null;
    const Observer = view?.ResizeObserver ?? ResizeObserver;
    const update = () => setGridBox({ width: gridArea.clientWidth, height: gridArea.clientHeight });
    update();
    const observer = new Observer(update);
    observer.observe(gridArea);
    return () => observer.disconnect();
  }, [gridArea]);
  const aloneNote = participants.length === 1 && !stageMode;
  const grid = fitGrid(onStage.length + shares.length, gridBox.width, gridBox.height - (aloneNote ? 36 : 0));
  // The saved default (Settings > Appearance > Layout). Automatic: other people's shares open the big view (unless
  // that is switched off); your own screen isn't worth watching big (it mirrors itself), so it stays in the grid.
  const remoteShareCount = shares.filter((entry) => !entry.self).length;
  const automaticView = layoutPrefs.voiceLayout === "auto" ? (remoteShareCount > 0 && layoutPrefs.focusNewShares ? "focus" : "grid") : layoutPrefs.voiceLayout;
  const view = viewChoice ?? automaticView;
  // Someone starting or stopping a share goes back to the default view.
  useEffect(() => {
    setView(null);
  }, [remoteShareCount]);

  if (!session) return null;

  const failedPeers = remote.filter((entry) => entry.state === "failed").length;
  const badge =
    connection === "connecting"
      ? { tone: "border-amber-400/40 bg-amber-500/10 text-amber-200", icon: <Loader2 className="h-3 w-3 animate-spin" />, text: "Joining" }
      : connection === "reconnecting"
        ? { tone: "border-amber-400/40 bg-amber-500/10 text-amber-200", icon: <Loader2 className="h-3 w-3 animate-spin" />, text: "Reconnecting" }
        : connection === "disconnected"
          ? { tone: "border-rose-400/40 bg-rose-500/10 text-rose-200", icon: <WifiOff className="h-3 w-3" />, text: "Disconnected" }
          : failedPeers > 0
            ? { tone: "border-amber-400/40 bg-amber-500/10 text-amber-200", icon: <Wifi className="h-3 w-3" />, text: `Connected · ${failedPeers} can't connect` }
            : { tone: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200", icon: <Wifi className="h-3 w-3" />, text: "Connected" };
  const peopleCount = onStage.length + audience.length;
  const showFocus = view === "focus" && activeShare !== null;
  const tileFor = (participant: Participant, compact?: boolean) => {
    // Moderators can move other speakers (but not fellow moderators) back to the audience.
    const moveDown =
      stageMode && selfModerator && !participant.self && !moderatorIds.has(participant.userId) ? (
        <button
          type="button"
          title="Move to audience"
          aria-label={`Move ${participant.name} to the audience`}
          onClick={() => emitStage("stage:speaker", { userId: participant.userId, speaker: false })}
          className="rounded-md border border-white/10 bg-black/60 p-1 text-slate-300 hover:border-rose-400/50 hover:text-rose-200"
        >
          <ArrowDownToLine className="h-3.5 w-3.5" />
        </button>
      ) : null;
    return (
      <ParticipantTile
        key={participant.userId}
        participant={participant}
        level={levels[participant.self ? "self" : participant.userId] ?? 0}
        volume={participant.self ? 1 : peerVolumes[participant.userId] ?? 1}
        onVolume={participant.self ? undefined : (volume) => setPeerVolume(participant.userId, volume)}
        compact={compact}
        action={moveDown}
      />
    );
  };

  const shareLabel = shareBlocked
    ? "Share screen"
    : flags.screenSharing
      ? screenShare.state === "requesting"
        ? "Choosing…"
        : "Stop sharing"
      : "Share screen";

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-300">
            <Radio className="h-4.5 w-4.5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="nf-heading truncate text-base font-bold text-white">{session.channelName}</h2>
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
              {stageMode ? "Stage" : "Voice channel"} · {peopleCount} {peopleCount === 1 ? "person" : "people"} · {session.mode === "mesh" ? "Peer to peer" : "LiveKit"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {shares.length > 0 ? (
            <div className="inline-flex rounded-lg border border-white/10 p-0.5" role="group" aria-label="Layout">
              <button type="button" aria-pressed={view === "focus"} onClick={() => setView("focus")} className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${view === "focus" ? "bg-amber-500/20 text-amber-100" : "text-slate-300 hover:text-white"}`}>
                Screen
              </button>
              <button type="button" aria-pressed={view === "grid"} onClick={() => setView("grid")} className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${view === "grid" ? "bg-amber-500/20 text-amber-100" : "text-slate-300 hover:text-white"}`}>
                Everyone
              </button>
            </div>
          ) : null}
          <span role="status" className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] ${badge.tone}`}>
            {badge.icon} {badge.text}
          </span>
          {canPopout && !inPopout ? (
            <button
              type="button"
              onClick={() => openPopout("voice", { channelId: session.channelId })}
              title="Open the voice room in its own window (the same call)"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-slate-200 transition hover:border-amber-400/50 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Pop out
            </button>
          ) : null}
        </div>
      </header>

      {error ? <p role="alert" className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">{error}</p> : null}
      {micNotice ? <p className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">{micNotice.text}</p> : null}
      {shareBlocked && selfOnStage ? (
        <p className="rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          Screen sharing needs Nexus Forge Desktop {DESKTOP_SCREEN_SHARE_VERSION} or newer, and this app is {desktopVersion}. Install the update when the app offers it, or get it from{" "}
          <Link href="/download" className="font-semibold underline underline-offset-2">nfgcord.com/download</Link>. You can still talk, listen and watch other people&apos;s screens.
        </p>
      ) : null}
      {screenShare.state === "requesting" ? <p className="text-center text-xs text-amber-200">Choose a screen or window to share in the picker.</p> : null}
      {screenShare.state === "denied" || screenShare.state === "error" ? (
        <div role="alert" className="rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-100">
          <p>{screenShare.message}</p>
          {/* The reason and the app version, so a report or screenshot says exactly what failed. */}
          <p className="mt-0.5 text-[10px] text-rose-200/70">
            {screenShare.detail ? `${screenShare.detail} · ` : ""}
            {screenShareReadiness(desktopVersion).app}
          </p>
        </div>
      ) : null}

      <div className="relative min-h-0 flex-1">
        {showFocus && activeShare ? (
          <div className="flex h-full min-h-0 flex-col gap-2">
            <div className="min-h-0 flex-1">
              <FocusedShare
                share={activeShare}
                shares={shares}
                onSelect={setFocusedShare}
                onShowGrid={() => setView("grid")}
                onPopout={canPopout ? () => openPopout("share", { key: activeShare.key, name: activeShare.name }) : undefined}
                poppedOut={sharePopout?.key === activeShare.key ? { onFocus: () => focusPopout("share"), onReturn: () => closePopout("share") } : undefined}
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1" aria-label="People in this channel">
              {onStage.map((participant) => tileFor(participant, true))}
            </div>
          </div>
        ) : (
          <div ref={setGridArea} className="@container flex h-full flex-col overflow-y-auto">
            {stageMode && !onStage.length ? (
              <p className="mx-auto mt-6 max-w-md rounded-xl border border-dashed border-white/10 px-3 py-4 text-center text-xs text-slate-500">Nobody is on stage yet. A moderator can invite people up.</p>
            ) : (
              <div
                className={`mx-auto my-auto grid w-full gap-3 ${grid.tileWidth ? "justify-center" : gridFor(onStage.length + shares.length)}`}
                style={grid.tileWidth ? { gridTemplateColumns: `repeat(${grid.columns}, ${grid.tileWidth}px)` } : undefined}
              >
                {onStage.map((participant) => tileFor(participant))}
                {shares.map((entry) => (
                  <button
                    key={`share-${entry.key}`}
                    type="button"
                    onClick={() => {
                      setFocusedShare(entry.key);
                      setView("focus");
                    }}
                    className="group relative aspect-video w-full overflow-hidden rounded-xl border border-amber-500/30 bg-black text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400"
                    aria-label={entry.self ? "Your screen. Open it large." : `${entry.name}'s screen. Open it large.`}
                  >
                    <StreamVideo stream={entry.stream} className="h-full w-full object-contain" />
                    <span className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-lg bg-black/70 px-2 py-1 text-xs font-semibold text-white">
                      <MonitorUp className="h-3.5 w-3.5 text-amber-300" /> {entry.self ? "Your screen" : `${entry.name}'s screen`}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {aloneNote ? (
              <p className="mb-auto mt-4 text-center text-xs text-slate-500">You are the only one here. Others in the forge see you in the channel list and can hop in.</p>
            ) : null}
          </div>
        )}
      </div>

      {stageMode ? (
        <section className="space-y-2" aria-label="Audience">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">Audience · {audience.length}</p>
          {audience.length ? (
            <ul className="flex flex-wrap gap-2">
              {/* Raised hands first, so moderators see who wants to speak. */}
              {[...audience].sort((a, b) => Number(raisedIds.has(b.userId)) - Number(raisedIds.has(a.userId))).map((participant) => (
                <li key={participant.userId} className={`inline-flex items-center gap-2 rounded-full border py-1 pl-1 pr-2 text-xs ${raisedIds.has(participant.userId) ? "border-amber-400/50 bg-amber-500/10 text-amber-100" : "border-white/10 bg-white/[0.03] text-slate-200"}`}>
                  {participant.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={participant.avatar} alt="" className="h-6 w-6 rounded-full object-cover" />
                  ) : (
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-800 text-[10px] font-bold text-amber-100">{initials(participant.name)}</span>
                  )}
                  <span className="max-w-[10rem] truncate font-semibold">{participant.name}{participant.self ? " (you)" : ""}</span>
                  {raisedIds.has(participant.userId) ? <Hand className="h-3.5 w-3.5 text-amber-300" aria-label="Hand raised" /> : null}
                  {selfModerator && !participant.self ? (
                    <button type="button" onClick={() => emitStage("stage:speaker", { userId: participant.userId, speaker: true })} className="inline-flex items-center gap-1 rounded-full border border-violet-400/40 bg-violet-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-200 hover:bg-violet-500/20">
                      <ArrowUpToLine className="h-3 w-3" /> Invite to speak
                    </button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">No listeners yet.</p>
          )}
        </section>
      ) : null}
      {pushToTalk.enabled && selfOnStage ? (
        <p className="text-center text-xs text-slate-400">
          Push-to-talk is on: hold <kbd className="rounded border border-white/15 bg-white/5 px-1.5 py-0.5 font-mono text-[11px] text-slate-200">`</kbd> to talk.
          {pushToTalk.talking ? <span className="ml-1.5 font-semibold text-emerald-300">Talking</span> : null}
        </p>
      ) : null}
      {stageMode && !selfOnStage ? <p className="text-center text-xs text-slate-400">You&apos;re in the audience, so your mic is off. Raise your hand to ask to speak.</p> : null}

      {showDevices && session.mode === "mesh" ? <CallDevices desktopVersion={desktopVersion} /> : null}

      <div className="@container/controls flex flex-wrap items-center justify-center gap-2 rounded-xl border border-white/[0.06] bg-black/30 p-2" role="toolbar" aria-label="Call controls">
        {stageMode && !selfOnStage ? (
          <ControlButton label={raisedIds.has(selfId) ? "Lower hand" : "Raise hand"} pressed={raisedIds.has(selfId)} onClick={() => emitStage("stage:raise", { raised: !raisedIds.has(selfId) })} icon={<Hand className="h-4 w-4" />} />
        ) : null}
        {stageMode && selfOnStage ? <ControlButton label="Move to audience" onClick={() => emitStage("stage:speaker", { userId: selfId, speaker: false })} icon={<ArrowDownToLine className="h-4 w-4" />} /> : null}
        <ControlButton label={flags.muted ? "Unmute" : "Mute"} pressed={flags.muted} tone="danger" onClick={() => toggle("muted")} icon={flags.muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />} />
        <ControlButton label={flags.deafened ? "Undeafen" : "Deafen"} pressed={flags.deafened} tone="danger" onClick={() => toggle("deafened")} icon={flags.deafened ? <HeadphoneOff className="h-4 w-4" /> : <Headphones className="h-4 w-4" />} />
        {session.mode === "mesh" && selfOnStage ? (
          <ControlButton label={flags.camera ? "Stop video" : "Video"} pressed={flags.camera} tone="sky" onClick={() => toggle("camera")} icon={flags.camera ? <VideoOff className="h-4 w-4" /> : <Video className="h-4 w-4" />} />
        ) : null}
        {session.mode === "mesh" && selfOnStage ? (
          <ControlButton
            label={shareLabel}
            pressed={flags.screenSharing && !shareBlocked}
            onClick={() => toggle("screenSharing")}
            disabled={shareBlocked}
            title={shareBlocked ? `Screen sharing needs Nexus Forge Desktop ${DESKTOP_SCREEN_SHARE_VERSION} or newer` : undefined}
            icon={flags.screenSharing ? <MonitorX className="h-4 w-4" /> : <MonitorUp className="h-4 w-4" />}
          />
        ) : null}
        {session.forgeId && selfOnStage ? <SoundboardButton forgeId={session.forgeId} channelId={session.channelId} nameOf={(userId) => (userId === selfId ? "You" : participants.find((entry) => entry.userId === userId)?.name ?? nameOf(userId))} /> : null}
        {session.mode === "mesh" ? <ControlButton label="Devices" pressed={showDevices} onClick={() => setShowDevices((open) => !open)} icon={<Settings2 className="h-4 w-4" />} /> : null}
        <span className="mx-1 hidden h-6 w-px bg-white/10 sm:block" aria-hidden="true" />
        <button
          type="button"
          onClick={leave}
          className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-rose-500 px-4 text-[11px] font-bold uppercase tracking-[0.12em] text-white transition hover:bg-rose-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300"
        >
          <PhoneOff className="h-4 w-4" /> Leave
        </button>
      </div>
    </div>
  );
}
