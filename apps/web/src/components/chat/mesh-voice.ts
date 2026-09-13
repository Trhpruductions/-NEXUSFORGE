"use client";

import type { Socket } from "socket.io-client";

/**
 * Built-in voice: a small WebRTC mesh signaled over the realtime socket.
 * Used when no LiveKit server is configured. Each participant holds one
 * RTCPeerConnection per other participant; the newcomer sends the offers.
 */

export type MeshPeer = {
  userId: string;
  connection: RTCPeerConnection;
  audio: HTMLAudioElement;
  stream: MediaStream | null;
  state: RTCPeerConnectionState;
};

export type MeshVoiceOptions = {
  socket: Socket;
  channelId: string;
  selfId: string;
  iceServers: RTCIceServer[];
  constraints: MediaTrackConstraints;
  onPeersChanged: (peers: MeshPeer[]) => void;
  onLevel?: (userId: string, level: number) => void;
  onError: (message: string) => void;
};

type SignalData =
  | { type: "offer"; sdp: string }
  | { type: "answer"; sdp: string }
  | { type: "ice"; candidate: RTCIceCandidateInit };

export class MeshVoice {
  private peers = new Map<string, MeshPeer>();
  private local: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analysers = new Map<string, { analyser: AnalyserNode; data: Uint8Array<ArrayBuffer> }>();
  private meter: number | null = null;
  private muted = false;
  private deafened = false;
  private closed = false;

  constructor(private readonly options: MeshVoiceOptions) {}

  async start() {
    const { socket, channelId } = this.options;
    try {
      this.local = await navigator.mediaDevices.getUserMedia({ audio: this.options.constraints });
    } catch (error) {
      if (!this.closed) this.options.onError(error instanceof Error ? `Microphone unavailable: ${error.message}` : "Microphone unavailable");
      this.local = null;
    }
    // stop() may have run while the microphone prompt was open (React remounts); do not join with a dead instance.
    if (this.closed) {
      this.local?.getTracks().forEach((track) => track.stop());
      this.local = null;
      return;
    }
    this.applyMute();
    this.watchLevel("self", this.local);

    socket.on("voice:peers", this.handlePeers);
    socket.on("voice:signal", this.handleSignal);
    socket.on("voice:occupancy", this.handleOccupancy);
    socket.emit("voice:join", channelId);
    this.meter = window.setInterval(() => this.sampleLevels(), 120);
  }

  stop() {
    this.closed = true;
    const { socket, channelId } = this.options;
    socket.off("voice:peers", this.handlePeers);
    socket.off("voice:signal", this.handleSignal);
    socket.off("voice:occupancy", this.handleOccupancy);
    socket.emit("voice:leave", channelId);
    for (const peer of this.peers.values()) this.drop(peer.userId, false);
    this.peers.clear();
    if (this.meter) window.clearInterval(this.meter);
    this.local?.getTracks().forEach((track) => track.stop());
    this.local = null;
    void this.audioContext?.close();
    this.audioContext = null;
    this.analysers.clear();
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    this.applyMute();
  }

  setDeafened(deafened: boolean) {
    this.deafened = deafened;
    for (const peer of this.peers.values()) peer.audio.muted = deafened;
  }

  setOutputDevice(deviceId: string | null) {
    for (const peer of this.peers.values()) {
      const element = peer.audio as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> };
      if (element.setSinkId) void element.setSinkId(deviceId ?? "").catch(() => undefined);
    }
  }

  private applyMute() {
    this.local?.getAudioTracks().forEach((track) => {
      track.enabled = !this.muted;
    });
  }

  private emitPeers() {
    if (this.closed) return;
    this.options.onPeersChanged(Array.from(this.peers.values()));
  }

  private handlePeers = (payload: { channelId: string; userIds: string[] }) => {
    if (payload.channelId !== this.options.channelId) return;
    // We are the newcomer: open a connection to everyone already in the room.
    for (const userId of payload.userIds) void this.offerTo(userId);
  };

  private handleOccupancy = (payload: { channelId: string; userIds: string[] }) => {
    if (payload.channelId !== this.options.channelId) return;
    const present = new Set(payload.userIds);
    for (const userId of Array.from(this.peers.keys())) {
      if (!present.has(userId)) this.drop(userId, true);
    }
    // Show newcomers straight away; their offer arrives a moment later.
    for (const userId of payload.userIds) {
      if (userId !== this.options.selfId && !this.peers.has(userId)) this.ensurePeer(userId);
    }
  };

  private handleSignal = async (payload: { channelId: string; from: string; data: SignalData }) => {
    if (payload.channelId !== this.options.channelId || this.closed) return;
    const { from, data } = payload;
    try {
      if (data.type === "offer") {
        const peer = this.ensurePeer(from);
        await peer.connection.setRemoteDescription({ type: "offer", sdp: data.sdp });
        const answer = await peer.connection.createAnswer();
        await peer.connection.setLocalDescription(answer);
        this.signal(from, { type: "answer", sdp: answer.sdp ?? "" });
      } else if (data.type === "answer") {
        const peer = this.peers.get(from);
        if (peer && peer.connection.signalingState === "have-local-offer") {
          await peer.connection.setRemoteDescription({ type: "answer", sdp: data.sdp });
        }
      } else if (data.type === "ice") {
        const peer = this.peers.get(from);
        if (peer && peer.connection.remoteDescription) {
          await peer.connection.addIceCandidate(data.candidate).catch(() => undefined);
        }
      }
    } catch (error) {
      this.options.onError(error instanceof Error ? error.message : "Voice negotiation failed");
    }
  };

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
    audio.setAttribute("playsinline", "true");
    document.body.appendChild(audio);

    const peer: MeshPeer = { userId, connection, audio, stream: null, state: connection.connectionState };
    this.peers.set(userId, peer);

    this.local?.getTracks().forEach((track) => connection.addTrack(track, this.local!));

    connection.onicecandidate = (event) => {
      if (event.candidate) this.signal(userId, { type: "ice", candidate: event.candidate.toJSON() });
    };
    connection.ontrack = (event) => {
      const [stream] = event.streams;
      peer.stream = stream ?? new MediaStream([event.track]);
      audio.srcObject = peer.stream;
      void audio.play().catch(() => undefined);
      this.watchLevel(userId, peer.stream);
      this.emitPeers();
    };
    connection.onconnectionstatechange = () => {
      peer.state = connection.connectionState;
      if (connection.connectionState === "failed" || connection.connectionState === "closed") this.drop(userId, true);
      else this.emitPeers();
    };

    this.emitPeers();
    return peer;
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
    for (const [key, entry] of this.analysers) {
      entry.analyser.getByteFrequencyData(entry.data);
      let sum = 0;
      for (const value of entry.data) sum += value;
      const level = Math.min(100, Math.round((sum / entry.data.length / 128) * 100));
      this.options.onLevel(key, key === "self" && this.muted ? 0 : level);
    }
  }
}
