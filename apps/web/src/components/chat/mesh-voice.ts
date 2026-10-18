"use client";

import type { Socket } from "socket.io-client";
import { isDesktopApp, isSecurePage, listMediaDevices, mediaDevicesAvailable, newAudioContext, openCamera, openMicrophone, stopStream } from "@/lib/media/media-devices";
import { MIC_NOTICE, classifyMediaError, isMissingDeviceError, needsMicProcessing, nextGateState, resolveDeviceChoice, rmsOf, rmsToMeter, sameMicCapture, type GateState, type MicSettings } from "@/lib/media/media-prefs";

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
 * - Offers, answers and candidates from one person are applied one at a time, in order. When both sides
 *   offer at once, the side with the smaller user id keeps its offer and the other answers it first
 *   ("perfect negotiation"), then re-sends its own change.
 *
 * Devices:
 * - The outgoing mic runs through Web Audio (gain, sensitivity gate, meter). Changing the
 *   mic or its processing swaps the outgoing track with RTCRtpSender.replaceTrack, so the
 *   call is not renegotiated.
 * - The camera keeps one MediaStream for the whole time it is on, so the other side keeps
 *   its label; switching camera swaps the track inside it.
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
  /** A camera or screen change that waits until the connection is stable enough to offer it. */
  pendingRenegotiation: boolean;
  pendingIceRestart: boolean;
  /** Our offer is being made right now (see sendOffer); an offer from them meanwhile is a collision. */
  makingOffer: boolean;
  /** Failed offer/answer attempts in a row; reset when one succeeds. */
  negotiationFailures: number;
};

export type MeshNotice = { tone: "info" | "warn" | "error"; text: string } | null;

/** detail is the technical reason (the error name), shown small under the message so a report can quote it. */
export type ScreenShareUpdate = { state: "requesting" | "sharing" | "stopped" | "denied" | "error"; message?: string; detail?: string };

export type MeshVoiceOptions = {
  socket: Socket;
  channelId: string;
  selfId: string;
  iceServers: RTCIceServer[];
  /** Microphone choice and processing (Settings > Voice & Video). Changes apply during a call. */
  mic: MicSettings;
  /** Playback volume 0..1 for everyone else. */
  outputVolume?: number;
  outputDeviceId?: string | null;
  /** Camera used when the camera turns on (null = system default). */
  cameraDeviceId?: string | null;
  onPeersChanged: (peers: MeshPeer[]) => void;
  onLevel?: (userId: string, level: number) => void;
  onError: (message: string) => void;
  /** The server refused the join because the room is at the peer-to-peer limit. */
  onFull?: (limit: number) => void;
  /** Fired when the local screen share stops (user pressed the browser's Stop sharing). */
  onScreenShareEnded?: () => void;
  /** Screen share status for the room UI: requesting, sharing, stopped, denied or error. */
  onScreenState?: (update: ScreenShareUpdate) => void;
  onLocalScreen?: (stream: MediaStream | null) => void;
  /** Local camera preview, and a callback when the camera stops on its own (unplugged, revoked). */
  onLocalCamera?: (stream: MediaStream | null) => void;
  onCameraEnded?: () => void;
  /** Microphone notices: fell back to the default device, or the microphone disconnected. null clears. */
  onMicNotice?: (notice: MeshNotice) => void;
};

type SignalData =
  | { type: "offer"; sdp: string }
  | { type: "answer"; sdp: string }
  | { type: "ice"; candidate: RTCIceCandidateInit };

/** The microphone graph: a meter tap on the captured mic, plus gain and a sensitivity gate when set. */
type MicGraph = {
  source: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  silent: GainNode;
  buffer: Float32Array<ArrayBuffer>;
  processing: GraphProcessing | null;
};

type GraphProcessing = {
  gain: GainNode;
  gate: GainNode;
  destination: MediaStreamAudioDestinationNode;
  gateState: GateState;
  timer: number;
};

const RESTART_AFTER_DISCONNECT_MS = 4000;
const MAX_ICE_RESTARTS = 2;
const MAX_NEGOTIATION_RETRIES = 2;
const NEGOTIATION_RETRY_MS = 600;
const REDIAL_DELAY_MS = 1500;
const SCREEN_STALL_GRACE_MS = 3000;
const GATE_INTERVAL_MS = 50;

export class MeshVoice {
  private peers = new Map<string, MeshPeer>();
  /** Signals from each person, applied one at a time in arrival order (see handleSignal). */
  private signalChains = new Map<string, Promise<void>>();
  private pendingIce = new Map<string, RTCIceCandidateInit[]>();
  private restarts = new Map<string, number>();
  private timers = new Set<number>();
  private present = new Set<string>();
  /** Captured microphone (raw) and the outgoing stream that goes to every peer. */
  private raw: MediaStream | null = null;
  private local: MediaStream | null = null;
  private graph: MicGraph | null = null;
  private mic: MicSettings;
  /** The settings the current capture was opened with. */
  private micApplied: MicSettings | null = null;
  private micQueue: Promise<void> = Promise.resolve();
  /** The current capture is the system default because the saved microphone wasn't connected. */
  private micFellBack = false;
  private started = false;
  private screen: MediaStream | null = null;
  /** Bumped on every start or stop, so a slow picker that finishes after a stop is dropped. */
  private screenRequest = 0;
  private screenPending = false;
  private camera: MediaStream | null = null;
  private cameraPending = false;
  private cameraDeviceId: string | null;
  private screenSenders = new Map<string, RTCRtpSender>();
  /** Ultra video (Core+ Plus and up): 1080p camera and 1440p60 screen share. Everyone else gets HD: 720p camera, 1080p30 screen share. */
  private hdVideo = false;

  setHdVideo(hd: boolean) {
    this.hdVideo = hd;
  }
  /** Stage channels: only these people are heard and seen (null = ordinary voice room). */
  private stageSpeakers: Set<string> | null = null;
  private cameraSenders = new Map<string, RTCRtpSender>();
  private audioContext: AudioContext | null = null;
  private analysers = new Map<string, { analyser: AnalyserNode; data: Uint8Array<ArrayBuffer> }>();
  private meter: number | null = null;
  private muted = false;
  private deafened = false;
  private pushToTalk = false;
  private talking = false;
  private outputVolume: number;
  /** Per-person volume on this device (0 to 1), multiplied by the output volume. */
  private peerVolumes = new Map<string, number>();
  private outputDeviceId: string | null;
  private closed = false;

  constructor(private readonly options: MeshVoiceOptions) {
    this.mic = { ...options.mic };
    this.cameraDeviceId = options.cameraDeviceId ?? null;
    this.outputVolume = options.outputVolume ?? 1;
    this.outputDeviceId = options.outputDeviceId ?? null;
  }

  async start() {
    const { socket, channelId } = this.options;
    this.started = true;
    // A microphone that fails doesn't stop the join: the person can listen and retry in settings.
    await this.applyMic();
    // stop() may have run while the microphone prompt was open (React remounts); do not join with a dead instance.
    if (this.closed) return;

    socket.on("voice:peers", this.handlePeers);
    socket.on("voice:signal", this.handleSignal);
    socket.on("voice:occupancy", this.handleOccupancy);
    socket.on("voice:state", this.handleState);
    socket.on("voice:full", this.handleFull);
    socket.on("connect", this.handleReconnect);
    this.socketId = socket.connected ? socket.id ?? null : null;
    socket.emit("voice:join", channelId);
    this.broadcastState();
    this.meter = window.setInterval(() => this.sampleLevels(), 120);
  }

  /** The realtime connection the call was joined on (null until it is open). */
  private socketId: string | null = null;

  /**
   * The realtime connection came back after a drop (network blip, server restart). The server took us out of the
   * room when it dropped, and everyone else closed their links to us, so the call was dead while still showing
   * "Connected". Start the room afresh on the new connection: the others then connect to us again as usual.
   * The first connect after joining (the connection was still opening) is not a reconnect.
   */
  private handleReconnect = () => {
    const { socket, channelId } = this.options;
    if (this.closed) return;
    const previous = this.socketId;
    this.socketId = socket.id ?? null;
    if (!previous || previous === this.socketId) return;
    for (const peer of Array.from(this.peers.values())) this.drop(peer.userId, false);
    this.present.clear();
    this.restarts.clear();
    this.emitPeers();
    socket.emit("voice:join", channelId);
    this.broadcastState();
  };

  stop() {
    this.closed = true;
    const { socket, channelId } = this.options;
    socket.off("voice:peers", this.handlePeers);
    socket.off("voice:signal", this.handleSignal);
    socket.off("voice:occupancy", this.handleOccupancy);
    socket.off("voice:state", this.handleState);
    socket.off("voice:full", this.handleFull);
    socket.off("connect", this.handleReconnect);
    socket.emit("voice:leave", channelId);
    for (const timer of this.timers) window.clearTimeout(timer);
    this.timers.clear();
    this.stopScreenShare(false);
    this.stopCamera(false);
    for (const peer of Array.from(this.peers.values())) this.drop(peer.userId, false);
    this.peers.clear();
    if (this.meter) window.clearInterval(this.meter);
    this.teardownGraph();
    stopStream(this.raw);
    stopStream(this.local);
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
    for (const peer of this.peers.values()) this.applyPlayback(peer);
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

  /** How loud one person is for you. Only changes what you hear, never what they send. */
  setPeerVolume(userId: string, volume: number) {
    this.peerVolumes.set(userId, Math.max(0, Math.min(1, volume)));
    const peer = this.peers.get(userId);
    if (peer) peer.audio.volume = this.volumeFor(userId);
  }

  /** Replaces every per-person volume (anyone missing goes back to 100%) and applies it to the call. */
  setPeerVolumes(volumes: Record<string, number>) {
    this.peerVolumes = new Map(Object.entries(volumes).map(([userId, volume]) => [userId, Math.max(0, Math.min(1, volume))]));
    for (const peer of this.peers.values()) peer.audio.volume = this.volumeFor(peer.userId);
  }

  private volumeFor(userId: string) {
    return this.outputVolume * (this.peerVolumes.get(userId) ?? 1);
  }

  setOutputVolume(volume: number) {
    this.outputVolume = Math.max(0, Math.min(1, volume));
    for (const peer of this.peers.values()) peer.audio.volume = this.volumeFor(peer.userId);
  }

  setOutputDevice(deviceId: string | null) {
    this.outputDeviceId = deviceId;
    for (const peer of this.peers.values()) this.applySink(peer.audio);
  }

  /**
   * Change the microphone or how it is processed. Applies to the call straight away: the outgoing
   * track is swapped with replaceTrack, so nobody has to renegotiate. Gain and sensitivity change
   * the live graph without reopening the device.
   */
  setMic(next: Partial<MicSettings>): Promise<void> {
    this.mic = { ...this.mic, ...next };
    return this.applyMic();
  }

  /** Runs mic changes one at a time, so two switches never race for the device. */
  private applyMic(): Promise<void> {
    this.micQueue = this.micQueue.then(() => this.applyMicNow()).catch(() => undefined);
    return this.micQueue;
  }

  private async applyMicNow() {
    if (this.closed || !this.started) return;
    const wanted: MicSettings = { ...this.mic };
    const applied = this.micApplied;
    if (applied && this.raw && sameMicCapture(applied, wanted)) {
      // Same device and processing: only the gain, the sensitivity or the graph itself can change.
      this.micApplied = wanted;
      const processing = this.graph?.processing ?? null;
      if (processing) processing.gain.gain.value = wanted.inputVolume / 100;
      if (needsMicProcessing(wanted) !== Boolean(processing)) await this.swapOutgoing(wanted);
      return;
    }

    const { stream, fellBack, error } = await this.openMic(wanted);
    if (this.closed) {
      stopStream(stream);
      return;
    }
    if (!stream) {
      // Keep the microphone in use (if any) and report why the new one didn't open.
      this.options.onError(classifyMediaError(error, "microphone", isSecurePage()).message);
      return;
    }

    const previousRaw = this.raw;
    const previousLocal = this.local;
    this.raw = stream;
    this.micApplied = wanted;
    this.micFellBack = fellBack;
    stream.getAudioTracks().forEach((track) => {
      track.onended = () => this.handleMicEnded(stream);
    });
    await this.ensureRunning();
    const outgoing = this.buildOutgoing(stream, wanted);
    this.local = outgoing;
    this.applyMute();
    const [track] = outgoing.getAudioTracks();
    if (track) await this.swapAudio(track, outgoing);
    previousRaw?.getTracks().forEach((entry) => {
      entry.onended = null;
      entry.stop();
    });
    if (previousLocal && previousLocal !== previousRaw) stopStream(previousLocal);
    this.options.onMicNotice?.(fellBack ? { tone: "warn", text: MIC_NOTICE.fallback } : null);
  }

  /** Rebuilds the outgoing stream from the open microphone (no device reopen) and swaps it into every connection. */
  private async swapOutgoing(settings: MicSettings) {
    const raw = this.raw;
    if (!raw) return;
    const previous = this.local;
    await this.ensureRunning();
    const outgoing = this.buildOutgoing(raw, settings);
    if (outgoing === previous) return;
    this.local = outgoing;
    this.applyMute();
    const [track] = outgoing.getAudioTracks();
    if (track) await this.swapAudio(track, outgoing);
    if (previous && previous !== raw) stopStream(previous);
  }

  /** Opens the microphone. A saved device that is gone falls back to the system default. */
  private async openMic(settings: MicSettings): Promise<{ stream: MediaStream | null; fellBack: boolean; error?: unknown }> {
    if (!mediaDevicesAvailable()) return { stream: null, fellBack: false, error: new DOMException("Not supported", "NotSupportedError") };
    try {
      return { stream: await openMicrophone(settings), fellBack: false };
    } catch (error) {
      if (settings.deviceId && isMissingDeviceError(error)) {
        try {
          return { stream: await openMicrophone({ ...settings, deviceId: null }), fellBack: true };
        } catch (fallbackError) {
          return { stream: null, fellBack: false, error: fallbackError };
        }
      }
      return { stream: null, fellBack: false, error };
    }
  }

  /**
   * The microphone track ended (unplugged, or the device failed). Reopen the chosen microphone; if it
   * is gone, the open falls back to the default and says so.
   */
  private handleMicEnded(stream: MediaStream) {
    if (this.closed || stream !== this.raw) return;
    this.micApplied = null;
    void this.applyMic();
  }

  /**
   * Hot-plug: a saved microphone that was missing switches the call back to it once it is listed
   * again, and a saved microphone that disappeared (without its track ending) moves the call to the default.
   */
  handleDevicesChanged() {
    const wanted = this.mic.deviceId;
    if (this.closed || !this.started || !wanted) return;
    void listMediaDevices().then((list) => {
      if (this.closed || list.length === 0) return;
      const listed = resolveDeviceChoice(wanted, list, "audioinput").status === "selected";
      // Reopen when the capture no longer matches what is connected (back to the saved mic, or off a
      // missing one), or when there is no capture yet (the mic failed at join). The open falls back if needed.
      if (!this.raw || listed === this.micFellBack) {
        this.micApplied = null;
        void this.applyMic();
      }
    });
  }

  /**
   * Puts the new outgoing track on every connection. An existing audio sender switches with
   * replaceTrack (no renegotiation). A connection that has no audio sender yet gets one, then offers.
   */
  private async swapAudio(track: MediaStreamTrack, stream: MediaStream) {
    for (const peer of this.peers.values()) {
      const sender = peer.connection.getSenders().find((entry) => entry.track?.kind === "audio");
      if (sender) {
        try {
          await sender.replaceTrack(track);
        } catch {
          // The connection is closing; the next offer or recovery sends the track.
        }
      } else {
        try {
          peer.connection.addTrack(track, stream);
          void this.renegotiate(peer.userId);
        } catch {
          // connection already closed
        }
      }
    }
  }

  /**
   * The outgoing stream for a microphone. With no gain or sensitivity set it is the microphone itself,
   * and the Web Audio graph is only a meter. Otherwise it is the processed stream (gain, then the gate).
   * Without an AudioContext the microphone is sent as captured.
   */
  private buildOutgoing(raw: MediaStream, settings: MicSettings): MediaStream {
    this.teardownGraph();
    const context = this.ensureContext();
    if (!context) return raw;
    try {
      void context.resume().catch(() => undefined);
      const source = context.createMediaStreamSource(raw);
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      // The analyser also feeds a silent output so the browser keeps running it.
      const silent = context.createGain();
      silent.gain.value = 0;
      analyser.connect(silent).connect(context.destination);
      const buffer = new Float32Array(analyser.fftSize);
      // Gain and the gate need a running context. If the browser still has it paused, send the mic unprocessed.
      if (!needsMicProcessing(settings) || context.state !== "running") {
        source.connect(analyser);
        this.graph = { source, analyser, silent, buffer, processing: null };
        this.analysers.set("self", { analyser, data: new Uint8Array(analyser.frequencyBinCount) });
        return raw;
      }
      const gain = context.createGain();
      gain.gain.value = settings.inputVolume / 100;
      const gate = context.createGain();
      gate.gain.value = 1;
      const destination = context.createMediaStreamDestination();
      source.connect(gain);
      gain.connect(analyser);
      gain.connect(gate);
      gate.connect(destination);
      const graph: MicGraph = {
        source,
        analyser,
        silent,
        buffer,
        processing: { gain, gate, destination, gateState: { open: true, lastAboveMs: 0 }, timer: 0 },
      };
      graph.processing!.timer = window.setInterval(() => this.runGate(graph), GATE_INTERVAL_MS);
      this.graph = graph;
      this.analysers.set("self", { analyser, data: new Uint8Array(analyser.frequencyBinCount) });
      return destination.stream;
    } catch {
      this.graph = null;
      return raw;
    }
  }

  private teardownGraph() {
    const graph = this.graph;
    if (!graph) return;
    this.graph = null;
    this.analysers.delete("self");
    const nodes: AudioNode[] = [graph.source, graph.analyser, graph.silent];
    if (graph.processing) {
      window.clearInterval(graph.processing.timer);
      nodes.push(graph.processing.gain, graph.processing.gate, graph.processing.destination);
    }
    for (const node of nodes) node.disconnect();
  }

  /** Opens the sensitivity gate when the level is above the threshold (see nextGateState). */
  private runGate(graph: MicGraph) {
    const context = this.audioContext;
    const processing = graph.processing;
    if (this.graph !== graph || !context || !processing) return;
    graph.analyser.getFloatTimeDomainData(graph.buffer);
    const level = rmsToMeter(rmsOf(graph.buffer));
    processing.gateState = nextGateState(processing.gateState, level, this.mic.inputSensitivity, Date.now());
    processing.gate.gain.setTargetAtTime(processing.gateState.open ? 1 : 0, context.currentTime, 0.02);
  }
  /** Gain and the gate need Web Audio running. Resuming it counts as the join or settings click that started it. */
  private async ensureRunning(): Promise<void> {
    const context = this.ensureContext();
    if (context && context.state !== "running") await context.resume().catch(() => undefined);
  }

  private ensureContext(): AudioContext | null {
    this.audioContext ??= newAudioContext();
    return this.audioContext;
  }

  private applyPlayback(peer: MeshPeer) {
    peer.audio.muted = this.deafened || !this.isHeard(peer.userId);
  }

  private applyMute() {
    const onStage = !this.stageSpeakers || this.stageSpeakers.has(this.options.selfId);
    const live = onStage && !this.muted && !this.deafened && (!this.pushToTalk || this.talking);
    this.local?.getAudioTracks().forEach((track) => {
      track.enabled = live;
    });
  }

  private applySink(audio: HTMLAudioElement) {
    const element = audio as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
    if (element.setSinkId) void element.setSinkId(this.outputDeviceId ?? "").catch(() => undefined);
  }

  /** Turn the camera on for everyone in the room (like screen share: a video track per peer). */
  async startCamera(deviceId: string | null = this.cameraDeviceId) {
    this.cameraDeviceId = deviceId;
    if (this.camera || this.cameraPending || this.closed) return;
    this.cameraPending = true;
    let stream: MediaStream;
    try {
      stream = await this.captureCamera(deviceId);
    } catch (error) {
      this.cameraPending = false;
      if (!this.closed) {
        this.options.onError(classifyMediaError(error, "camera", isSecurePage()).message);
        this.options.onCameraEnded?.();
      }
      return;
    }
    this.cameraPending = false;
    if (this.closed) {
      stopStream(stream);
      return;
    }
    this.camera = stream;
    const [track] = stream.getVideoTracks();
    track.onended = () => this.stopCamera(true);
    this.options.onLocalCamera?.(stream);
    for (const peer of this.peers.values()) {
      this.cameraSenders.set(peer.userId, peer.connection.addTrack(track, stream));
      void this.renegotiate(peer.userId);
    }
    this.broadcastState();
  }

  private async captureCamera(deviceId: string | null): Promise<MediaStream> {
    try {
      return await openCamera(deviceId, this.hdVideo);
    } catch (error) {
      // The chosen camera is gone (unplugged): use the default one instead.
      if (deviceId && isMissingDeviceError(error)) return openCamera(null, this.hdVideo);
      throw error;
    }
  }

  /**
   * Switch camera while it's on. The same MediaStream stays (so the other side keeps its label);
   * the track inside it is swapped and each camera sender gets it with replaceTrack.
   */
  async setCameraDevice(deviceId: string | null) {
    this.cameraDeviceId = deviceId;
    const current = this.camera;
    if (!current || this.closed) return;
    let next: MediaStream;
    try {
      next = await this.captureCamera(deviceId);
    } catch (error) {
      if (!this.closed) this.options.onError(classifyMediaError(error, "camera", isSecurePage()).message);
      return;
    }
    // The camera may have been turned off, or the call ended, while the new one opened.
    const [newTrack] = next.getVideoTracks();
    if (this.closed || this.camera !== current || !newTrack) {
      stopStream(next);
      return;
    }
    const [oldTrack] = current.getVideoTracks();
    if (oldTrack) oldTrack.onended = null;
    newTrack.onended = () => this.stopCamera(true);
    current.addTrack(newTrack);
    for (const sender of this.cameraSenders.values()) {
      try {
        await sender.replaceTrack(newTrack);
      } catch {
        // connection already closed
      }
    }
    if (oldTrack) {
      current.removeTrack(oldTrack);
      oldTrack.stop();
    }
    this.options.onLocalCamera?.(current);
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
    if (this.screen || this.screenPending || this.closed) return;
    if (!mediaDevicesAvailable() || typeof navigator.mediaDevices.getDisplayMedia !== "function") {
      this.options.onScreenState?.({ state: "error", message: "Screen sharing isn't available in this browser or app.", detail: "getDisplayMedia missing" });
      this.options.onScreenShareEnded?.();
      return;
    }
    const request = ++this.screenRequest;
    this.screenPending = true;
    this.options.onScreenState?.({ state: "requesting" });
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: this.hdVideo
          ? { width: { max: 2560 }, height: { max: 1440 }, frameRate: { ideal: 60, max: 60 } }
          : { width: { max: 1920 }, height: { max: 1080 }, frameRate: { ideal: 30, max: 30 } },
        audio: false,
      });
    } catch (error) {
      if (request !== this.screenRequest) return;
      this.screenPending = false;
      if (!this.closed) {
        const failure = classifyMediaError(error, "screen", isSecurePage(), isDesktopApp());
        // The error name only, never the screen or window. The desktop app copies console warnings into its startup log.
        console.warn(`[voice] screen share failed: ${failure.code} (${error instanceof Error ? error.name : "unknown"})`);
        this.options.onScreenState?.({ state: failure.code === "denied" ? "denied" : "error", message: failure.message, detail: error instanceof Error ? error.name : "unknown" });
        this.options.onScreenShareEnded?.();
      }
      return;
    }
    // Stopped or left while the picker was open: release the capture at once.
    if (request !== this.screenRequest || this.closed) {
      stopStream(stream);
      return;
    }
    this.screenPending = false;
    this.screen = stream;
    const [track] = stream.getVideoTracks();
    // The browser's own "Stop sharing" control ends the track; release it and tell the room.
    track.onended = () => {
      this.stopScreenShare(true);
    };
    this.options.onLocalScreen?.(stream);
    for (const peer of this.peers.values()) {
      const sender = peer.connection.addTrack(track, stream);
      this.screenSenders.set(peer.userId, sender);
      void this.renegotiate(peer.userId);
    }
    this.options.onScreenState?.({ state: "sharing" });
    // Tell everyone which incoming stream is the screen (vs the camera).
    this.broadcastState();
  }

  stopScreenShare(notify: boolean) {
    const wasPending = this.screenPending;
    this.screenPending = false;
    this.screenRequest++;
    if (!this.screen) {
      if (wasPending) this.options.onScreenState?.({ state: "stopped" });
      return;
    }
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
    this.options.onScreenState?.({ state: "stopped" });
    this.broadcastState();
    if (notify) this.options.onScreenShareEnded?.();
  }

  private async renegotiate(userId: string, iceRestart = false) {
    const peer = this.peers.get(userId);
    if (!peer || this.closed) return;
    if (peer.makingOffer || peer.connection.signalingState !== "stable") {
      // Mid-negotiation (e.g. answering their change): keep the change and send it once the
      // connection is stable again (see onsignalingstatechange and sendOffer). A timed retry gave up after a
      // few seconds, and then a camera or screen change silently never reached the other side.
      peer.pendingRenegotiation = true;
      peer.pendingIceRestart = peer.pendingIceRestart || iceRestart;
      return;
    }
    peer.pendingRenegotiation = false;
    const restart = iceRestart || peer.pendingIceRestart;
    peer.pendingIceRestart = false;
    try {
      if (restart) peer.connection.restartIce();
      await this.sendOffer(peer);
      peer.negotiationFailures = 0;
    } catch (error) {
      this.negotiationFailed(peer, error);
    }
  }

  /**
   * Makes and sends our offer. setLocalDescription() without an argument creates the description inside the
   * connection's own queue, so an offer from them landing at the same moment cannot leave it in the wrong state (the
   * old createOffer-then-set pair failed with "Called in wrong signalingState"). While it runs, makingOffer tells
   * handleSignal that an offer from them is a collision. Whatever was set is sent with its real type.
   */
  private async sendOffer(peer: MeshPeer) {
    peer.makingOffer = true;
    try {
      await peer.connection.setLocalDescription();
      const local = peer.connection.localDescription;
      if (local && (local.type === "offer" || local.type === "answer")) this.signal(peer.userId, { type: local.type, sdp: local.sdp });
    } finally {
      peer.makingOffer = false;
      // A change queued while this offer was in flight, with nothing left to wake it: offer it now.
      if (peer.pendingRenegotiation && peer.connection.signalingState === "stable") this.later(() => void this.renegotiate(peer.userId), 0);
    }
  }

  /**
   * An offer or answer failed. Usually a moment of overlap with the other side, which a retry fixes; the raw browser
   * error goes to the console, and only a failure that keeps happening is shown, in plain words.
   */
  private negotiationFailed(peer: MeshPeer, error: unknown) {
    const name = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    console.warn(`[voice] connection update failed (${name})`);
    if (this.closed || this.peers.get(peer.userId) !== peer) return;
    peer.negotiationFailures += 1;
    if (peer.negotiationFailures <= MAX_NEGOTIATION_RETRIES) {
      this.later(() => void this.renegotiate(peer.userId), NEGOTIATION_RETRY_MS * peer.negotiationFailures);
      return;
    }
    peer.negotiationFailures = 0;
    this.options.onError("Couldn't update the connection with someone in the call. If their screen, camera or voice is missing, leave the channel and join again.");
  }

  /**
   * Stage mode: pass the current speakers (or null to leave stage mode). Audio from
   * anyone else isn't played, and your own mic stays off unless you're on stage.
   */
  setStage(speakers: string[] | null) {
    this.stageSpeakers = speakers ? new Set(speakers) : null;
    for (const peer of this.peers.values()) this.applyPlayback(peer);
    this.applyMute();
  }

  isHeard(userId: string) {
    return !this.stageSpeakers || this.stageSpeakers.has(userId);
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

  /**
   * Signals from one person are applied one at a time, in the order they arrived. Run side by side, an answer and the
   * offer right behind it (someone joining while a screen is shared gets exactly that pair) raced: the offer was
   * either dropped or failed with "Called in wrong signalingState: stable", and the newcomer never saw the screen.
   */
  private handleSignal = (payload: { channelId: string; from: string; data: SignalData }) => {
    if (payload.channelId !== this.options.channelId || this.closed) return;
    const previous = this.signalChains.get(payload.from) ?? Promise.resolve();
    const next = previous.then(() => this.applySignal(payload));
    this.signalChains.set(payload.from, next);
    void next.finally(() => {
      if (this.signalChains.get(payload.from) === next) this.signalChains.delete(payload.from);
    });
  };

  private async applySignal(payload: { channelId: string; from: string; data: SignalData }) {
    if (this.closed) return;
    const { from, data } = payload;
    let peer: MeshPeer | undefined;
    try {
      if (data.type === "offer") {
        peer = this.ensurePeer(from);
        const connection = peer.connection;
        // Both sides offered at once (e.g. two people turn their camera on together).
        // "Perfect negotiation": the side that leads keeps its offer and ignores theirs; the other side drops its own
        // offer (setRemoteDescription rolls it back by itself), answers, then re-sends its own change. Without the
        // re-send, the yielding side's new track would never be negotiated.
        const collision = peer.makingOffer || connection.signalingState !== "stable";
        if (collision && this.leads(from)) return;
        await connection.setRemoteDescription({ type: "offer", sdp: data.sdp });
        await this.flushIce(from);
        if (connection.signalingState === "have-remote-offer") {
          await connection.setLocalDescription();
          const local = connection.localDescription;
          if (local?.type === "answer") this.signal(from, { type: "answer", sdp: local.sdp });
        }
        peer.negotiationFailures = 0;
        if (collision) {
          peer.pendingRenegotiation = true;
          this.later(() => void this.renegotiate(from), 100);
        }
        // Our screen share or camera that their offer had no place for (someone joining while we already share):
        // an answer cannot add a media section, so offer it ourselves. Without this they never saw the share.
        else if (this.hasUnnegotiatedVideo(peer)) this.later(() => void this.renegotiate(from), 50);
      } else if (data.type === "answer") {
        peer = this.peers.get(from);
        // An answer to an offer that was rolled back or already answered has nothing to apply to.
        if (peer && peer.connection.signalingState === "have-local-offer") {
          await peer.connection.setRemoteDescription({ type: "answer", sdp: data.sdp });
          await this.flushIce(from);
          peer.negotiationFailures = 0;
        }
      } else if (data.type === "ice") {
        const target = this.peers.get(from);
        if (target?.connection.remoteDescription) {
          // Candidates for an offer we ignored in a collision fail harmlessly.
          await target.connection.addIceCandidate(data.candidate).catch(() => undefined);
        } else {
          // Arrived before the offer/answer was applied: keep it for later.
          const queue = this.pendingIce.get(from) ?? [];
          queue.push(data.candidate);
          this.pendingIce.set(from, queue);
        }
      }
    } catch (error) {
      if (peer) this.negotiationFailed(peer, error);
      else console.warn(`[voice] connection update failed (${error instanceof Error ? error.name : String(error)})`);
    }
  }

  /** True when one of our video tracks (screen or camera) has not been placed in the connection's negotiation yet. */
  private hasUnnegotiatedVideo(peer: MeshPeer) {
    return peer.connection.getTransceivers().some((transceiver) => transceiver.sender.track?.kind === "video" && !transceiver.mid);
  }

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
    audio.muted = this.deafened || !this.isHeard(userId);
    audio.volume = this.volumeFor(userId);
    audio.setAttribute("playsinline", "true");
    this.applySink(audio);
    document.body.appendChild(audio);

    const peer: MeshPeer = { userId, connection, audio, stream: null, video: null, camera: null, videoStreams: new Map(), screenId: null, cameraId: null, labelled: false, state: connection.connectionState, remoteMuted: false, remoteDeafened: false, pendingRenegotiation: false, pendingIceRestart: false, makingOffer: false, negotiationFailures: 0 };
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
    // A change that arrived mid-negotiation is offered as soon as the connection is stable again.
    connection.onsignalingstatechange = () => {
      if (connection.signalingState === "stable" && peer.pendingRenegotiation) void this.renegotiate(userId);
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
    if (peer.makingOffer || peer.connection.signalingState !== "stable") {
      // Already negotiating with them (their offer got here first): our offer follows once that settles.
      peer.pendingRenegotiation = true;
      return;
    }
    try {
      // Hear them even when we have no microphone to send (what offerToReceiveAudio used to do).
      if (!peer.connection.getTransceivers().some((transceiver) => transceiver.receiver.track.kind === "audio")) {
        peer.connection.addTransceiver("audio", { direction: "recvonly" });
      }
      await this.sendOffer(peer);
    } catch (error) {
      this.negotiationFailed(peer, error);
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
    this.signalChains.delete(userId);
    this.pendingIce.delete(userId);
    this.analysers.delete(userId);
    if (emit) this.emitPeers();
  }

  private watchLevel(key: string, stream: MediaStream | null) {
    if (!stream || !this.options.onLevel) return;
    try {
      const context = this.ensureContext();
      if (!context) return;
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      context.createMediaStreamSource(stream).connect(analyser);
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
