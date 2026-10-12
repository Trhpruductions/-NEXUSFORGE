"use client";

import type { Socket } from "socket.io-client";

/**
 * Built-in voice: a small WebRTC mesh signaled over the realtime socket.
 * Used when no LiveKit server is configured. Each participant holds one
 * RTCPeerConnection per other participant; the newcomer sends the offers.
 *
 * Reliability rules:
 * - ICE candidates that arrive before the remote description are queued, not dropped.
 * - A connection that goes "disconnected" or "failed" gets an ICE restart; if that
 *   doesn't recover it, it is torn down and re-dialled while the person is still in the
 *   room. Only the side with the smaller user id initiates, so both sides never offer
 *   at once.
 */

export type MeshPeer = {
  userId: string;
  connection: RTCPeerConnection;
  audio: HTMLAudioElement;
  stream: MediaStream | null;
  /** Remote screen share, when the peer is sharing. */
  video: MediaStream | null;
  /** Remote camera, when the peer has video on. */
  camera: MediaStream | null;
  /** Every incoming video stream by id; the peer's state says which is camera/screen. */
  videoStreams: Map<string, MediaStream>;
  screenId: string | null;
  cameraId: string | null;
  /** The peer labels its streams (newer clients); then unlabelled leftovers are ignored. */
  labelled: boolean;
  state: RTCPeerConnectionState;
  /** What the peer last told us about their mic and headphones. */
  remoteMuted: boolean;
  remoteDeafened: boolean;
};

export type MeshVoiceOptions = {
  socket: Socket;
  channelId: string;
  selfId: string;
  iceServers: RTCIceServer[];
  constraints: MediaTrackConstraints;
  /** Mic gain, 1 = unchanged (Settings > Voice > input volume). */
  inputGain?: number;
  /** Playback volume 0..1 for everyone else (Settings > Voice > output volume). */
  outputVolume?: number;
  outputDeviceId?: string | null;
  onPeersChanged: (peers: MeshPeer[]) => void;
  onLevel?: (userId: string, level: number) => void;
  onError: (message: string) => void;
  /** The server refused the join because the room is at the peer-to-peer limit. */
  onFull?: (limit: number) => void;
  /** Fired when the local screen share stops (user pressed the browser's Stop sharing). */
  onScreenShareEnded?: () => void;
  onLocalScreen?: (stream: MediaStream | null) => void;
  /** Local camera preview, and a callback when the camera stops on its own (unplugged, revoked). */
  onLocalCamera?: (stream: MediaStream | null) => void;
  onCameraEnded?: () => void;
};

type SignalData =
  | { type: "offer"; sdp: string }
  | { type: "answer"; sdp: string }
  | { type: "ice"; candidate: RTCIceCandidateInit };

const RESTART_AFTER_DISCONNECT_MS = 4000;
const MAX_ICE_RESTARTS = 2;
const REDIAL_DELAY_MS = 1500;
const SCREEN_STALL_GRACE_MS = 3000;

export class MeshVoice {
  private peers = new Map<string, MeshPeer>();
  private pendingIce = new Map<string, RTCIceCandidateInit[]>();
  private restarts = new Map<string, number>();
  private timers = new Set<number>();
  private present = new Set<string>();
  private raw: MediaStream | null = null;
  private local: MediaStream | null = null;
  private screen: MediaStream | null = null;
  private camera: MediaStream | null = null;
  private cameraSenders = new Map<string, RTCRtpSender>();
  private screenSenders = new Map<string, RTCRtpSender>();
  private audioContext: AudioContext | null = null;
  private analysers = new Map<string, { analyser: AnalyserNode; data: Uint8Array<ArrayBuffer> }>();
  private meter: number | null = null;
  private muted = false;
  private deafened = false;
  private pushToTalk = false;
  private talking = false;
  private outputVolume: number;
  private outputDeviceId: string | null;
  private closed = false;

  constructor(private readonly options: MeshVoiceOptions) {
    this.outputVolume = options.outputVolume ?? 1;
    this.outputDeviceId = options.outputDeviceId ?? null;
  }

  async start() {
    const { socket, channelId } = this.options;
    try {
      this.raw = await navigator.mediaDevices.getUserMedia({ audio: this.options.constraints });
    } catch (error) {
      // A saved microphone that's been unplugged: fall back to the default one.
      if (this.options.constraints.deviceId) {
        try {
          const fallback: MediaTrackConstraints = { ...this.options.constraints };
          delete fallback.deviceId;
          this.raw = await navigator.mediaDevices.getUserMedia({ audio: fallback });
        } catch {
          this.raw = null;
        }
      }
      if (!this.raw && !this.closed) this.options.onError(error instanceof Error ? `Microphone unavailable: ${error.message}` : "Microphone unavailable");
    }
    // stop() may have run while the microphone prompt was open (React remounts); do not join with a dead instance.
    if (this.closed) {
      this.raw?.getTracks().forEach((track) => track.stop());
      this.raw = null;
      return;
    }
    this.local = this.applyInputGain(this.raw);
    this.applyMute();
    this.watchLevel("self", this.local);

    socket.on("voice:peers", this.handlePeers);
    socket.on("voice:signal", this.handleSignal);
    socket.on("voice:occupancy", this.handleOccupancy);
    socket.on("voice:state", this.handleState);
    socket.on("voice:full", this.handleFull);
    socket.emit("voice:join", channelId);
    this.broadcastState();
    this.meter = window.setInterval(() => this.sampleLevels(), 120);
  }

  stop() {
    this.closed = true;
    const { socket, channelId } = this.options;
    socket.off("voice:peers", this.handlePeers);
    socket.off("voice:signal", this.handleSignal);
    socket.off("voice:occupancy", this.handleOccupancy);
    socket.off("voice:state", this.handleState);
    socket.off("voice:full", this.handleFull);
    socket.emit("voice:leave", channelId);
    for (const timer of this.timers) window.clearTimeout(timer);
    this.timers.clear();
    this.stopScreenShare(false);
    this.stopCamera(false);
    for (const peer of Array.from(this.peers.values())) this.drop(peer.userId, false);
    this.peers.clear();
    if (this.meter) window.clearInterval(this.meter);
    this.raw?.getTracks().forEach((track) => track.stop());
    this.local?.getTracks().forEach((track) => track.stop());
    this.raw = null;
    this.local = null;
    void this.audioContext?.close();
    this.audioContext = null;
    this.analysers.clear();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.applyMute();
    this.broadcastState();
  }

  /** Deafening also cuts your mic, like Discord. */
  setDeafened(deafened: boolean) {
    this.deafened = deafened;
    for (const peer of this.peers.values()) peer.audio.muted = deafened;
    this.applyMute();
    this.broadcastState();
  }

  /** Push-to-talk: while enabled, the mic is live only while `setTalking(true)`. */
  setPushToTalk(enabled: boolean) {
    this.pushToTalk = enabled;
    this.applyMute();
  }

  setTalking(talking: boolean) {
    if (this.talking === talking) return;
    this.talking = talking;
    this.applyMute();
  }

  setOutputVolume(volume: number) {
    this.outputVolume = Math.max(0, Math.min(1, volume));
    for (const peer of this.peers.values()) peer.audio.volume = this.outputVolume;
  }

  setOutputDevice(deviceId: string | null) {
    this.outputDeviceId = deviceId;
    for (const peer of this.peers.values()) this.applySink(peer.audio);
  }

  /** Turn the camera on for everyone in the room (like screen share: a video track per peer). */
  async startCamera(deviceId?: string | null) {
    if (this.camera) return;
    const video: MediaTrackConstraints = { width: { ideal: 640 }, height: { ideal: 360 }, frameRate: { ideal: 24, max: 30 } };
    try {
      try {
        this.camera = await navigator.mediaDevices.getUserMedia({ video: deviceId ? { ...video, deviceId: { exact: deviceId } } : video, audio: false });
      } catch (error) {
        // The chosen camera is gone (unplugged): use the default one instead.
        if (!deviceId || (error instanceof Error && error.name === "NotAllowedError")) throw error;
        this.camera = await navigator.mediaDevices.getUserMedia({ video, audio: false });
      }
    } catch (error) {
      this.camera = null;
      this.options.onError(error instanceof Error && error.name === "NotAllowedError" ? "Camera permission was denied" : "Couldn't start your camera");
      this.options.onCameraEnded?.();
      return;
    }
    if (this.closed) {
      this.camera.getTracks().forEach((entry) => entry.stop());
      this.camera = null;
      return;
    }
    const [track] = this.camera.getVideoTracks();
    track.onended = () => this.stopCamera(true);
    this.options.onLocalCamera?.(this.camera);
    for (const peer of this.peers.values()) {
      this.cameraSenders.set(peer.userId, peer.connection.addTrack(track, this.camera));
      void this.renegotiate(peer.userId);
    }
    this.broadcastState();
  }

  stopCamera(notify: boolean) {
    if (!this.camera) return;
    this.camera.getTracks().forEach((entry) => entry.stop());
    this.camera = null;
    for (const [userId, sender] of this.cameraSenders) {
      const peer = this.peers.get(userId);
      try {
        peer?.connection.removeTrack(sender);
      } catch {
        // connection already closed
      }
      if (peer) void this.renegotiate(userId);
    }
    this.cameraSenders.clear();
    this.options.onLocalCamera?.(null);
    this.broadcastState();
    if (notify) this.options.onCameraEnded?.();
  }

  /** Share the screen with everyone in the room (adds a video track to each peer and renegotiates). */
  async startScreenShare() {
    if (this.screen) return;
    try {
      this.screen = await navigator.mediaDevices.getDisplayMedia({ video: { frameRate: 15 }, audio: false });
    } catch {
      this.options.onScreenShareEnded?.();
      return;
    }
    const [track] = this.screen.getVideoTracks();
    track.onended = () => {
      this.stopScreenShare(true);
    };
    this.options.onLocalScreen?.(this.screen);
    for (const peer of this.peers.values()) {
      const sender = peer.connection.addTrack(track, this.screen);
      this.screenSenders.set(peer.userId, sender);
      void this.renegotiate(peer.userId);
    }
    // Tell everyone which incoming stream is the screen (vs the camera).
    this.broadcastState();
  }

  stopScreenShare(notify: boolean) {
    if (!this.screen) return;
    this.screen.getTracks().forEach((entry) => entry.stop());
    this.screen = null;
    for (const [userId, sender] of this.screenSenders) {
      const peer = this.peers.get(userId);
      try {
        peer?.connection.removeTrack(sender);
      } catch {
        // connection may already be closed
      }
      if (peer) void this.renegotiate(userId);
    }
    this.screenSenders.clear();
    this.options.onLocalScreen?.(null);
    this.broadcastState();
    if (notify) this.options.onScreenShareEnded?.();
  }

  private async renegotiate(userId: string, iceRestart = false, attempt = 0) {
    const peer = this.peers.get(userId);
    if (!peer || this.closed) return;
    if (peer.connection.signalingState !== "stable") {
      // Mid-negotiation (e.g. answering their change): try again shortly instead of
      // dropping ours, or a camera/screen change could silently never reach them.
      if (attempt < 20) this.later(() => void this.renegotiate(userId, iceRestart, attempt + 1), 250);
      return;
    }
    try {
      const offer = await peer.connection.createOffer({ iceRestart });
      await peer.connection.setLocalDescription(offer);
      this.signal(userId, { type: "offer", sdp: offer.sdp ?? "" });
    } catch (error) {
      this.options.onError(error instanceof Error ? error.message : "Could not update the call");
    }
  }

  private applyMute() {
    const live = !this.muted && !this.deafened && (!this.pushToTalk || this.talking);
    this.local?.getAudioTracks().forEach((track) => {
      track.enabled = live;
    });
  }

  /** Mic gain through Web Audio; returns the stream to send. */
  private applyInputGain(stream: MediaStream | null): MediaStream | null {
    const gain = this.options.inputGain ?? 1;
    if (!stream || Math.abs(gain - 1) < 0.01) return stream;
    try {
      this.audioContext ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const source = this.audioContext.createMediaStreamSource(stream);
      const node = this.audioContext.createGain();
      node.gain.value = gain;
      const destination = this.audioContext.createMediaStreamDestination();
      source.connect(node).connect(destination);
      return destination.stream;
    } catch {
      return stream;
    }
  }

  private applySink(audio: HTMLAudioElement) {
    const element = audio as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
    if (element.setSinkId) void element.setSinkId(this.outputDeviceId ?? "").catch(() => undefined);
  }

  private broadcastState() {
    if (this.closed) return;
    this.options.socket.emit("voice:state", {
      channelId: this.options.channelId,
      muted: this.muted || this.deafened,
      deafened: this.deafened,
      // Lets everyone tell our camera from our screen share.
      cameraStreamId: this.camera?.id ?? null,
      screenStreamId: this.screen?.id ?? null,
    });
  }

  private emitPeers() {
    if (this.closed) return;
    this.options.onPeersChanged(Array.from(this.peers.values()));
  }

  private later(fn: () => void, ms: number) {
    const timer = window.setTimeout(() => {
      this.timers.delete(timer);
      if (!this.closed) fn();
    }, ms);
    this.timers.add(timer);
  }

  /** Who initiates offers/restarts between two people, so both sides never do at once. */
  private leads(userId: string) {
    return this.options.selfId < userId;
  }

  private handlePeers = (payload: { channelId: string; userIds: string[] }) => {
    if (payload.channelId !== this.options.channelId) return;
    // We are the newcomer: open a connection to everyone already in the room.
    for (const userId of payload.userIds) {
      this.present.add(userId);
      void this.offerTo(userId);
    }
  };

  private handleFull = (payload: { channelId: string; limit: number }) => {
    if (payload.channelId !== this.options.channelId) return;
    this.options.onFull?.(payload.limit);
  };

  private handleState = (payload: { channelId: string; userId: string; muted: boolean; deafened: boolean; cameraStreamId?: string | null; screenStreamId?: string | null }) => {
    if (payload.channelId !== this.options.channelId) return;
    const peer = this.peers.get(payload.userId);
    if (!peer) return;
    peer.remoteMuted = Boolean(payload.muted);
    peer.remoteDeafened = Boolean(payload.deafened);
    if ("cameraStreamId" in payload || "screenStreamId" in payload) peer.labelled = true;
    peer.cameraId = payload.cameraStreamId ?? null;
    peer.screenId = payload.screenStreamId ?? null;
    this.classifyVideo(peer);
    this.emitPeers();
  };

  /** Decide which incoming stream is the camera and which is the screen share. */
  private classifyVideo(peer: MeshPeer) {
    peer.camera = peer.cameraId ? peer.videoStreams.get(peer.cameraId) ?? null : null;
    if (peer.screenId) {
      peer.video = peer.videoStreams.get(peer.screenId) ?? null;
    } else if (peer.labelled) {
      // A stream that just stopped can linger for a moment; it is not a screen share.
      peer.video = null;
    } else {
      // Older clients don't label streams: anything that isn't the camera is the screen.
      peer.video = Array.from(peer.videoStreams.values()).find((stream) => stream !== peer.camera) ?? null;
    }
  }

  private handleOccupancy = (payload: { channelId: string; userIds: string[] }) => {
    if (payload.channelId !== this.options.channelId) return;
    this.present = new Set(payload.userIds.filter((id) => id !== this.options.selfId));
    for (const userId of Array.from(this.peers.keys())) {
      if (!this.present.has(userId)) this.drop(userId, true);
    }
    // Show newcomers straight away; their offer arrives a moment later.
    let joined = false;
    for (const userId of this.present) {
      if (!this.peers.has(userId)) {
        this.ensurePeer(userId);
        joined = true;
      }
    }
    // Newcomers don't know our mute state yet.
    if (joined) this.broadcastState();
  };

  private handleSignal = async (payload: { channelId: string; from: string; data: SignalData }) => {
    if (payload.channelId !== this.options.channelId || this.closed) return;
    const { from, data } = payload;
    try {
      if (data.type === "offer") {
        const peer = this.ensurePeer(from);
        // Both sides offered at once (e.g. two people turn their camera on together).
        // "Perfect negotiation": the side that leads keeps its offer and ignores theirs;
        // the other side rolls back, answers, then re-sends its own change. Without the
        // re-send, the yielding side's new track would never be negotiated.
        const collision = peer.connection.signalingState !== "stable";
        if (collision && this.leads(from)) return;
        if (collision) await peer.connection.setLocalDescription({ type: "rollback" });
        await peer.connection.setRemoteDescription({ type: "offer", sdp: data.sdp });
        await this.flushIce(from);
        const answer = await peer.connection.createAnswer();
        await peer.connection.setLocalDescription(answer);
        this.signal(from, { type: "answer", sdp: answer.sdp ?? "" });
        if (collision) this.later(() => void this.renegotiate(from), 100);
      } else if (data.type === "answer") {
        const peer = this.peers.get(from);
        if (peer && peer.connection.signalingState === "have-local-offer") {
          await peer.connection.setRemoteDescription({ type: "answer", sdp: data.sdp });
          await this.flushIce(from);
        }
      } else if (data.type === "ice") {
        const peer = this.peers.get(from);
        if (peer?.connection.remoteDescription) {
          await peer.connection.addIceCandidate(data.candidate).catch(() => undefined);
        } else {
          // Arrived before the offer/answer was applied: keep it for later.
          const queue = this.pendingIce.get(from) ?? [];
          queue.push(data.candidate);
          this.pendingIce.set(from, queue);
        }
      }
    } catch (error) {
      this.options.onError(error instanceof Error ? error.message : "Voice negotiation failed");
    }
  };

  private async flushIce(userId: string) {
    const peer = this.peers.get(userId);
    const queue = this.pendingIce.get(userId);
    if (!peer || !queue?.length) return;
    this.pendingIce.delete(userId);
    for (const candidate of queue) await peer.connection.addIceCandidate(candidate).catch(() => undefined);
  }

  private signal(to: string, data: SignalData) {
    this.options.socket.emit("voice:signal", { channelId: this.options.channelId, to, data });
  }

  private ensurePeer(userId: string): MeshPeer {
    const existing = this.peers.get(userId);
    if (existing) return existing;

    const connection = new RTCPeerConnection({ iceServers: this.options.iceServers });
    const audio = document.createElement("audio");
    audio.autoplay = true;
    audio.muted = this.deafened;
    audio.volume = this.outputVolume;
    audio.setAttribute("playsinline", "true");
    this.applySink(audio);
    document.body.appendChild(audio);

    const peer: MeshPeer = { userId, connection, audio, stream: null, video: null, camera: null, videoStreams: new Map(), screenId: null, cameraId: null, labelled: false, state: connection.connectionState, remoteMuted: false, remoteDeafened: false };
    this.peers.set(userId, peer);

    this.local?.getTracks().forEach((track) => connection.addTrack(track, this.local!));
    if (this.screen) {
      const [track] = this.screen.getVideoTracks();
      if (track) this.screenSenders.set(userId, connection.addTrack(track, this.screen));
    }
    if (this.camera) {
      const [track] = this.camera.getVideoTracks();
      if (track) this.cameraSenders.set(userId, connection.addTrack(track, this.camera));
    }

    connection.onicecandidate = (event) => {
      if (event.candidate) this.signal(userId, { type: "ice", candidate: event.candidate.toJSON() });
    };
    connection.ontrack = (event) => {
      const [stream] = event.streams;
      if (event.track.kind === "video") {
        const videoStream = stream ?? new MediaStream([event.track]);
        const show = () => {
          peer.videoStreams.set(videoStream.id, videoStream);
          this.classifyVideo(peer);
          this.emitPeers();
        };
        const hide = () => {
          peer.videoStreams.delete(videoStream.id);
          this.classifyVideo(peer);
          this.emitPeers();
        };
        let stall: number | null = null;
        event.track.onended = hide;
        // A muted track is often just a network stall; hide it only if it lasts, and
        // bring it back when frames resume.
        event.track.onmute = () => {
          if (stall) return;
          stall = window.setTimeout(() => {
            stall = null;
            hide();
          }, SCREEN_STALL_GRACE_MS);
        };
        event.track.onunmute = () => {
          if (stall) window.clearTimeout(stall);
          stall = null;
          if (!peer.videoStreams.has(videoStream.id)) show();
        };
        show();
        return;
      }
      peer.stream = stream ?? new MediaStream([event.track]);
      audio.srcObject = peer.stream;
      void audio.play().catch(() => undefined);
      this.watchLevel(userId, peer.stream);
      this.emitPeers();
    };
    connection.onconnectionstatechange = () => {
      peer.state = connection.connectionState;
      const state = connection.connectionState;
      if (state === "connected") {
        this.restarts.delete(userId);
      } else if (state === "disconnected") {
        // Often recovers by itself; give it a moment before restarting ICE.
        this.later(() => {
          if (this.peers.get(userId) === peer && connection.connectionState === "disconnected") this.recover(userId);
        }, RESTART_AFTER_DISCONNECT_MS);
      } else if (state === "failed") {
        this.recover(userId);
      } else if (state === "closed") {
        this.drop(userId, true);
        return;
      }
      this.emitPeers();
    };

    this.emitPeers();
    return peer;
  }

  /** ICE restart first; if that keeps failing, tear down and re-dial while they're still here. */
  private recover(userId: string) {
    const attempts = this.restarts.get(userId) ?? 0;
    if (attempts < MAX_ICE_RESTARTS) {
      this.restarts.set(userId, attempts + 1);
      if (this.leads(userId)) void this.renegotiate(userId, true);
      return;
    }
    this.restarts.delete(userId);
    this.drop(userId, true);
    this.later(() => {
      if (!this.present.has(userId) || this.peers.has(userId)) return;
      if (this.leads(userId)) void this.offerTo(userId);
      else this.ensurePeer(userId); // the other side re-dials us
    }, REDIAL_DELAY_MS);
  }

  private async offerTo(userId: string) {
    const peer = this.ensurePeer(userId);
    try {
      const offer = await peer.connection.createOffer({ offerToReceiveAudio: true });
      await peer.connection.setLocalDescription(offer);
      this.signal(userId, { type: "offer", sdp: offer.sdp ?? "" });
    } catch (error) {
      this.options.onError(error instanceof Error ? error.message : "Could not reach a participant");
    }
  }

  private drop(userId: string, emit: boolean) {
    const peer = this.peers.get(userId);
    if (!peer) return;
    peer.connection.onicecandidate = null;
    peer.connection.ontrack = null;
    peer.connection.onconnectionstatechange = null;
    peer.connection.close();
    peer.audio.srcObject = null;
    peer.audio.remove();
    this.peers.delete(userId);
    this.pendingIce.delete(userId);
    this.analysers.delete(userId);
    if (emit) this.emitPeers();
  }

  private watchLevel(key: string, stream: MediaStream | null) {
    if (!stream || !this.options.onLevel) return;
    try {
      this.audioContext ??= new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const analyser = this.audioContext.createAnalyser();
      analyser.fftSize = 256;
      this.audioContext.createMediaStreamSource(stream).connect(analyser);
      this.analysers.set(key, { analyser, data: new Uint8Array(analyser.frequencyBinCount) });
    } catch {
      // level metering is optional
    }
  }

  private sampleLevels() {
    if (!this.options.onLevel) return;
    const selfLive = !this.muted && !this.deafened && (!this.pushToTalk || this.talking);
    for (const [key, entry] of this.analysers) {
      entry.analyser.getByteFrequencyData(entry.data);
      let sum = 0;
      for (const value of entry.data) sum += value;
      const level = Math.min(100, Math.round((sum / entry.data.length / 128) * 100));
      this.options.onLevel(key, key === "self" && !selfLive ? 0 : level);
    }
  }
}
