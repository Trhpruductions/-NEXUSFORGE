/**
 * Pure rules for microphone, speaker and camera choices. No browser APIs live here, so the
 * saved-choice format, device fallback, error wording and meter math can be unit tested under
 * node (apps/web/tests/media). Browser calls are in media-devices.ts.
 */

export type InputMode = "voice" | "ptt";

/** Everything the user chooses on this device, for one account. */
export type MediaPrefs = {
  /** Saved microphone id; null = system default. */
  micDeviceId: string | null;
  /** Saved speaker or headphone id; null = system default. */
  speakerDeviceId: string | null;
  /** Saved camera id; null = system default. */
  cameraDeviceId: string | null;
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
  /** Mic gain 0..100 (100 = unchanged). */
  inputVolume: number;
  /** Gate threshold 0..100 on the input meter. Below it the mic is not sent. 0 = always send. */
  inputSensitivity: number;
  /** Playback volume for everyone else, 0..100. */
  outputVolume: number;
  /** Voice activity (send while you talk) or push to talk (hold the backquote key in a call). */
  inputMode: InputMode;
};

export const DEFAULT_MEDIA_PREFS: MediaPrefs = {
  micDeviceId: null,
  speakerDeviceId: null,
  cameraDeviceId: null,
  noiseSuppression: true,
  echoCancellation: true,
  autoGainControl: true,
  inputVolume: 100,
  inputSensitivity: 0,
  outputVolume: 100,
  inputMode: "voice",
};

/** Version of the saved JSON. A different version is ignored and the defaults apply. */
export const MEDIA_PREFS_VERSION = 1;

/** The microphone settings one call needs. */
export type MicSettings = {
  deviceId: string | null;
  noiseSuppression: boolean;
  echoCancellation: boolean;
  autoGainControl: boolean;
  inputVolume: number;
  inputSensitivity: number;
};

/** Account voice settings the server already stores (Settings > Voice). Used once, to seed this PC. */
export type ServerVoiceSeed = {
  inputDeviceId?: string | null;
  outputDeviceId?: string | null;
  cameraDeviceId?: string | null;
  inputMode?: string;
  inputVolume?: number;
  outputVolume?: number;
  noiseSuppression?: boolean;
  echoCancellation?: boolean;
};

/** Notices shown in the call when the microphone isn't the one picked. */
export const MIC_NOTICE = {
  fallback: "Your saved microphone isn't connected, so the system default is in use for now.",
} as const;

export type MediaKind = "microphone" | "camera" | "screen";
export type DeviceKind = "audioinput" | "audiooutput" | "videoinput";

/** Minimal shape of a device, so the rules work on MediaDeviceInfo or plain objects. */
export type DeviceLike = { deviceId: string; label: string; kind: string };

/** The key is per account, so accounts on one PC never read each other's choices. */
export function mediaPrefsKey(userId: string | null | undefined): string | null {
  return userId ? `nf-media-prefs:${userId}` : null;
}

export function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function percentOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(clampPercent(value)) : fallback;
}

function flagOr(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

/** null stays null (system default); a non-empty string is a device id; anything else keeps the fallback. */
function deviceIdOr(value: unknown, fallback: string | null): string | null {
  if (value === null) return null;
  if (typeof value === "string") return value.length > 0 && value.length <= 200 ? value : null;
  return fallback;
}

/** Turns untrusted input (storage, server) into valid prefs. Bad fields keep the base value. */
export function sanitizeMediaPrefs(value: unknown, base: MediaPrefs = DEFAULT_MEDIA_PREFS): MediaPrefs {
  const source: Record<string, unknown> = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    micDeviceId: deviceIdOr(source.micDeviceId, base.micDeviceId),
    speakerDeviceId: deviceIdOr(source.speakerDeviceId, base.speakerDeviceId),
    cameraDeviceId: deviceIdOr(source.cameraDeviceId, base.cameraDeviceId),
    noiseSuppression: flagOr(source.noiseSuppression, base.noiseSuppression),
    echoCancellation: flagOr(source.echoCancellation, base.echoCancellation),
    autoGainControl: flagOr(source.autoGainControl, base.autoGainControl),
    inputVolume: percentOr(source.inputVolume, base.inputVolume),
    inputSensitivity: percentOr(source.inputSensitivity, base.inputSensitivity),
    outputVolume: percentOr(source.outputVolume, base.outputVolume),
    inputMode: source.inputMode === "ptt" || source.inputMode === "voice" ? source.inputMode : base.inputMode,
  };
}

/**
 * The account's saved server settings become this PC's first choices. Device ids are kept too:
 * if a saved device isn't connected here, the fallback rules below handle it.
 */
export function seedFromServer(voice: ServerVoiceSeed): MediaPrefs {
  return sanitizeMediaPrefs(
    {
      micDeviceId: voice.inputDeviceId,
      speakerDeviceId: voice.outputDeviceId,
      cameraDeviceId: voice.cameraDeviceId,
      noiseSuppression: voice.noiseSuppression,
      echoCancellation: voice.echoCancellation,
      inputVolume: voice.inputVolume,
      outputVolume: voice.outputVolume,
      inputMode: voice.inputMode,
    },
    DEFAULT_MEDIA_PREFS
  );
}

export type KeyValueStorage = Pick<Storage, "getItem" | "setItem">;

/** Returns the saved choices for this account, or null when there are none (or they can't be read). */
export function readMediaPrefs(storage: KeyValueStorage | null | undefined, userId: string | null | undefined): MediaPrefs | null {
  const key = mediaPrefsKey(userId);
  if (!storage || !key) return null;
  try {
    const raw = storage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { v?: unknown; prefs?: unknown } | null;
    if (!parsed || parsed.v !== MEDIA_PREFS_VERSION) return null;
    return sanitizeMediaPrefs(parsed.prefs);
  } catch {
    // Blocked or full storage, or corrupt JSON: run with the defaults instead.
    return null;
  }
}

/** Saves the choices for this account. Returns false when storage is blocked or full. */
export function writeMediaPrefs(storage: KeyValueStorage | null | undefined, userId: string | null | undefined, prefs: MediaPrefs): boolean {
  const key = mediaPrefsKey(userId);
  if (!storage || !key) return false;
  try {
    storage.setItem(key, JSON.stringify({ v: MEDIA_PREFS_VERSION, prefs: sanitizeMediaPrefs(prefs) }));
    return true;
  } catch {
    return false;
  }
}

export function micSettingsFrom(prefs: MediaPrefs): MicSettings {
  return {
    deviceId: prefs.micDeviceId,
    noiseSuppression: prefs.noiseSuppression,
    echoCancellation: prefs.echoCancellation,
    autoGainControl: prefs.autoGainControl,
    inputVolume: prefs.inputVolume,
    inputSensitivity: prefs.inputSensitivity,
  };
}

/** Gain or sensitivity is set: the outgoing mic is then the processed stream. Otherwise the mic is sent as captured. */
export function needsMicProcessing(settings: Pick<MicSettings, "inputVolume" | "inputSensitivity">): boolean {
  return settings.inputVolume !== 100 || settings.inputSensitivity > 0;
}

/** True when the new settings need a new capture (device or processing changed). Gain and sensitivity don't. */
export function sameMicCapture(a: MicSettings, b: MicSettings): boolean {
  return a.deviceId === b.deviceId && a.noiseSuppression === b.noiseSuppression && a.echoCancellation === b.echoCancellation && a.autoGainControl === b.autoGainControl;
}

/**
 * getUserMedia audio constraints. The processing toggles are bare booleans, which browsers treat as
 * "ideal", so a browser without one of them still opens the microphone.
 */
export function buildAudioConstraints(settings: Pick<MicSettings, "deviceId" | "noiseSuppression" | "echoCancellation" | "autoGainControl">): MediaTrackConstraints {
  return {
    noiseSuppression: settings.noiseSuppression,
    echoCancellation: settings.echoCancellation,
    autoGainControl: settings.autoGainControl,
    ...(settings.deviceId ? { deviceId: { exact: settings.deviceId } } : {}),
  };
}

/** Camera constraints: the same HD or ultra limits the call uses, with an optional exact device. */
export function cameraConstraints(hd: boolean, deviceId: string | null): MediaTrackConstraints {
  const base: MediaTrackConstraints = hd
    ? { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30, max: 30 } }
    : { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } };
  return deviceId ? { ...base, deviceId: { exact: deviceId } } : base;
}

/** Chrome lists "default" and "communications" aliases next to the real devices. The picker shows the real ones. */
export function isAliasDeviceId(deviceId: string): boolean {
  return deviceId === "default" || deviceId === "communications";
}

/** Real devices of one kind. Before the page has microphone or camera permission, ids are blank and are dropped. */
export function realDevices<T extends DeviceLike>(devices: readonly T[], kind: DeviceKind): T[] {
  return devices.filter((device) => device.kind === kind && device.deviceId.length > 0 && !isAliasDeviceId(device.deviceId));
}

export type DeviceChoice =
  /** Nothing saved: the system default. */
  | { status: "system-default"; deviceId: null }
  /** The saved device is connected: use it. */
  | { status: "selected"; deviceId: string }
  /** The device list can't be read yet (no permission), so keep the saved id and let capture decide. */
  | { status: "unknown"; deviceId: string }
  /** The saved device isn't connected: use the default now, keep the saved id for later. */
  | { status: "missing"; deviceId: null; savedDeviceId: string };

export function resolveDeviceChoice(saved: string | null, devices: readonly DeviceLike[], kind: DeviceKind): DeviceChoice {
  if (!saved) return { status: "system-default", deviceId: null };
  const list = realDevices(devices, kind);
  if (list.length === 0) return { status: "unknown", deviceId: saved };
  if (list.some((device) => device.deviceId === saved)) return { status: "selected", deviceId: saved };
  return { status: "missing", deviceId: null, savedDeviceId: saved };
}

function errorName(error: unknown): string {
  return error && typeof error === "object" && "name" in error ? String((error as { name: unknown }).name) : "";
}

/** The saved device is gone or can't match: retry once with the system default. */
export function isMissingDeviceError(error: unknown): boolean {
  const name = errorName(error);
  return name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError";
}

export type MediaFailureCode = "denied" | "in-use" | "missing" | "unsupported" | "insecure" | "unknown";
export type MediaFailure = { code: MediaFailureCode; message: string };

/** Plain-language reason for a capture failure, with what the user can do about it. */
export function classifyMediaError(error: unknown, kind: MediaKind, secure = true): MediaFailure {
  const name = errorName(error);
  const device = kind === "microphone" ? "microphone" : kind === "camera" ? "camera" : "screen sharing";
  if (!secure) {
    return { code: "insecure", message: "Browsers only allow microphone, camera and screen sharing on a secure page (https, or localhost). Open Nexus Forge over https." };
  }
  if (name === "NotAllowedError" || name === "SecurityError") {
    if (kind === "screen") return { code: "denied", message: "Screen sharing was cancelled or blocked. Pick a screen or window to share and try again." };
    return {
      code: "denied",
      message: `${kind === "camera" ? "Camera" : "Microphone"} access is blocked. Allow it for Nexus Forge in your browser's site settings or in Windows privacy settings, then try again.`,
    };
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    if (kind === "screen") return { code: "in-use", message: "Screen sharing couldn't start. Close the app that is capturing the screen, then try again." };
    return { code: "in-use", message: `Your ${device} is in use by another app or can't be read. Close the other app and try again.` };
  }
  if (name === "OverconstrainedError") {
    return { code: "missing", message: `The selected ${device} is no longer available. Pick another one in Voice & Video settings.` };
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    if (kind === "screen") return { code: "missing", message: "There is no screen to share." };
    return { code: "missing", message: `No ${device} found. Connect one, then try again.` };
  }
  if (name === "NotSupportedError" || name === "TypeError") {
    return { code: "unsupported", message: `This browser or app can't use ${device}.` };
  }
  return { code: "unknown", message: `Couldn't start your ${device}. Try again.` };
}

/** RMS of time-domain samples (floats between -1 and 1). */
export function rmsOf(samples: ArrayLike<number>): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let index = 0; index < samples.length; index += 1) sum += samples[index] * samples[index];
  return Math.sqrt(sum / samples.length);
}

/** Meter scale on a dB curve: -60 dBFS is the floor (0) and 0 dBFS the top (100). */
export function rmsToMeter(rms: number): number {
  if (!(rms > 0)) return 0;
  const db = 20 * Math.log10(rms);
  return Math.round(clampPercent(((db + 60) / 60) * 100));
}

export const GATE_HOLD_MS = 300;

export type GateState = { open: boolean; lastAboveMs: number };

/**
 * Input sensitivity gate. Sensitivity 0 always sends. At or above the threshold the gate opens at
 * once; it stays open for the hold time after the level drops, so word endings aren't clipped.
 */
export function nextGateState(previous: GateState, level: number, sensitivity: number, nowMs: number, holdMs = GATE_HOLD_MS): GateState {
  if (sensitivity <= 0 || level >= sensitivity) return { open: true, lastAboveMs: nowMs };
  const open = previous.open && nowMs - previous.lastAboveMs < holdMs;
  return { open, lastAboveMs: previous.lastAboveMs };
}
