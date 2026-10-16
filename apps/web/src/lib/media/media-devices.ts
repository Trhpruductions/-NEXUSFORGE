"use client";

import { buildAudioConstraints, cameraConstraints, isMissingDeviceError, rmsOf, rmsToMeter, type MicSettings } from "./media-prefs";

/**
 * Browser device calls: list devices, watch hot-plug, open the microphone and camera, meter a
 * stream, and play a speaker test tone. Every call checks what the browser supports first.
 */

export function mediaDevicesAvailable(): boolean {
  return typeof navigator !== "undefined" && typeof navigator.mediaDevices?.getUserMedia === "function";
}

/** Browsers only expose the microphone and camera on https or localhost. */
export function isSecurePage(): boolean {
  return typeof window === "undefined" || window.isSecureContext !== false;
}

/** Speaker choice for media elements. Chromium-based browsers have it; Firefox and Safari don't. */
export function outputSelectionSupported(): boolean {
  return typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype;
}

function contextSinkSupported(): boolean {
  return typeof AudioContext !== "undefined" && "setSinkId" in AudioContext.prototype;
}

export function newAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    return new Ctor();
  } catch {
    return null;
  }
}

export function stopStream(stream: MediaStream | null | undefined) {
  stream?.getTracks().forEach((track) => track.stop());
}

/** Device list. Before permission is granted the ids and labels are blank. */
export async function listMediaDevices(): Promise<MediaDeviceInfo[]> {
  if (!mediaDevicesAvailable()) return [];
  try {
    return await navigator.mediaDevices.enumerateDevices();
  } catch {
    return [];
  }
}

/** Calls back when devices are plugged in or removed. Returns the unsubscribe function. */
export function watchMediaDevices(onChange: () => void): () => void {
  const devices = typeof navigator !== "undefined" ? navigator.mediaDevices : undefined;
  if (!devices?.addEventListener) return () => undefined;
  devices.addEventListener("devicechange", onChange);
  return () => devices.removeEventListener("devicechange", onChange);
}

export type PermissionValue = "granted" | "denied" | "prompt" | "unknown";

export async function queryPermission(name: "microphone" | "camera"): Promise<PermissionValue> {
  try {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) return "unknown";
    const status = await navigator.permissions.query({ name: name as PermissionName });
    return status.state;
  } catch {
    // Some browsers don't know the camera or microphone permission name.
    return "unknown";
  }
}

function requireMediaDevices() {
  if (!mediaDevicesAvailable()) throw new DOMException("This browser can't capture audio or video.", "NotSupportedError");
}

export async function openMicrophone(settings: Pick<MicSettings, "deviceId" | "noiseSuppression" | "echoCancellation" | "autoGainControl">): Promise<MediaStream> {
  requireMediaDevices();
  return navigator.mediaDevices.getUserMedia({ audio: buildAudioConstraints(settings), video: false });
}

export async function openCamera(deviceId: string | null, hd: boolean): Promise<MediaStream> {
  requireMediaDevices();
  return navigator.mediaDevices.getUserMedia({ video: cameraConstraints(hd, deviceId), audio: false });
}

/**
 * Level meter for the settings mic test: the microphone, then input volume, then an analyser.
 * The meter reads the same signal the call would send. Call close() to release the microphone.
 */
export class MicLevelMeter {
  private closed = false;

  private constructor(
    private readonly stream: MediaStream,
    private readonly context: AudioContext,
    private readonly gain: GainNode,
    private readonly analyser: AnalyserNode,
    private readonly buffer: Float32Array<ArrayBuffer>,
    /** True when the saved microphone wasn't connected and the default was opened instead. */
    readonly fellBack: boolean
  ) {}

  static async open(settings: Pick<MicSettings, "deviceId" | "noiseSuppression" | "echoCancellation" | "autoGainControl" | "inputVolume">): Promise<MicLevelMeter> {
    let stream: MediaStream;
    let fellBack = false;
    try {
      stream = await openMicrophone(settings);
    } catch (error) {
      if (!settings.deviceId || !isMissingDeviceError(error)) throw error;
      stream = await openMicrophone({ ...settings, deviceId: null });
      fellBack = true;
    }
    const context = newAudioContext();
    if (!context) {
      stopStream(stream);
      throw new DOMException("This browser can't measure audio levels.", "NotSupportedError");
    }
    try {
      await context.resume().catch(() => undefined);
      const source = context.createMediaStreamSource(stream);
      const gain = context.createGain();
      gain.gain.value = settings.inputVolume / 100;
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      const silent = context.createGain();
      silent.gain.value = 0;
      source.connect(gain).connect(analyser);
      analyser.connect(silent).connect(context.destination);
      return new MicLevelMeter(stream, context, gain, analyser, new Float32Array(analyser.fftSize), fellBack);
    } catch (error) {
      stopStream(stream);
      void context.close().catch(() => undefined);
      throw error;
    }
  }

  /** Current level on the 0..100 meter scale. */
  read(): number {
    if (this.closed) return 0;
    this.analyser.getFloatTimeDomainData(this.buffer);
    return rmsToMeter(rmsOf(this.buffer));
  }

  setInputVolume(inputVolume: number) {
    if (!this.closed) this.gain.gain.value = inputVolume / 100;
  }

  close() {
    if (this.closed) return;
    this.closed = true;
    stopStream(this.stream);
    void this.context.close().catch(() => undefined);
  }
}

/**
 * A short 440 Hz tone through the chosen speaker. Routing needs AudioContext.setSinkId (Chromium);
 * elsewhere the tone plays on the system default and the note says so.
 */
export async function playTestTone(speakerDeviceId: string | null, volume: number): Promise<{ routed: boolean; note: string }> {
  const context = newAudioContext();
  if (!context) return { routed: false, note: "This browser can't play a test tone." };
  let routed = false;
  let note = "Played through the system default output.";
  try {
    if (speakerDeviceId && contextSinkSupported()) {
      try {
        await (context as AudioContext & { setSinkId: (id: string) => Promise<void> }).setSinkId(speakerDeviceId);
        routed = true;
        note = "Played through the speaker you picked.";
      } catch {
        note = "Your browser couldn't send the tone to that speaker, so it played on the system default.";
      }
    } else if (speakerDeviceId) {
      note = "This browser can't pick a speaker, so the tone played on the system default output.";
    }
    const level = Math.min(1, Math.max(0, volume)) * 0.25;
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    oscillator.frequency.value = 440;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(level, now + 0.05);
    gain.gain.setValueAtTime(level, now + 0.8);
    gain.gain.linearRampToValueAtTime(0, now + 1);
    oscillator.connect(gain).connect(context.destination);
    await context.resume().catch(() => undefined);
    oscillator.start(now);
    oscillator.stop(now + 1.05);
    await new Promise((resolve) => window.setTimeout(resolve, 1150));
    return { routed, note };
  } finally {
    void context.close().catch(() => undefined);
  }
}
