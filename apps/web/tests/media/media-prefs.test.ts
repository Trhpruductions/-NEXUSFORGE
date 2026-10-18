import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_MEDIA_PREFS,
  DESKTOP_SCREEN_SHARE_VERSION,
  buildAudioConstraints,
  cameraConstraints,
  classifyMediaError,
  desktopTooOldForScreenShare,
  isMissingDeviceError,
  mediaPrefsKey,
  micSettingsFrom,
  needsMicProcessing,
  nextGateState,
  readMediaPrefs,
  realDevices,
  resolveDeviceChoice,
  rmsOf,
  rmsToMeter,
  sameMicCapture,
  sanitizeMediaPrefs,
  seedFromServer,
  writeMediaPrefs,
  type KeyValueStorage,
  type MediaPrefs,
} from "../../src/lib/media/media-prefs";

/** In-memory storage with the same string-only behaviour as localStorage. */
function memoryStorage(): KeyValueStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, String(value));
    },
  };
}

const throwingStorage: KeyValueStorage = {
  getItem: () => {
    throw new Error("SecurityError: storage blocked");
  },
  setItem: () => {
    throw new Error("QuotaExceededError");
  },
};

function error(name: string, message = "") {
  const failure = new Error(message);
  failure.name = name;
  return failure;
}

const prefsA: MediaPrefs = { ...DEFAULT_MEDIA_PREFS, micDeviceId: "mic-a", inputSensitivity: 35, outputVolume: 60 };
const prefsB: MediaPrefs = { ...DEFAULT_MEDIA_PREFS, micDeviceId: "mic-b", inputMode: "ptt" };

test("the saved key is per account and never shared", () => {
  assert.equal(mediaPrefsKey("user-1"), "nf-media-prefs:user-1");
  assert.notEqual(mediaPrefsKey("user-1"), mediaPrefsKey("user-2"));
  assert.equal(mediaPrefsKey(""), null);
  assert.equal(mediaPrefsKey(null), null);
  assert.equal(mediaPrefsKey(undefined), null);
});

test("choices saved for one account are invisible to another account on the same PC", () => {
  const storage = memoryStorage();
  assert.equal(writeMediaPrefs(storage, "user-a", prefsA), true);
  assert.equal(writeMediaPrefs(storage, "user-b", prefsB), true);
  assert.deepEqual(readMediaPrefs(storage, "user-a"), prefsA);
  assert.deepEqual(readMediaPrefs(storage, "user-b"), prefsB);
  assert.equal(readMediaPrefs(storage, "user-c"), null, "a third account gets no cached choices");
  assert.equal(readMediaPrefs(storage, null), null, "signed out reads nothing");
});

test("missing, corrupt, or wrong-version entries read as no saved choices", () => {
  const storage = memoryStorage();
  assert.equal(readMediaPrefs(storage, "user-a"), null);
  storage.setItem("nf-media-prefs:user-a", "{not json");
  assert.equal(readMediaPrefs(storage, "user-a"), null);
  storage.setItem("nf-media-prefs:user-a", JSON.stringify({ v: 99, prefs: prefsA }));
  assert.equal(readMediaPrefs(storage, "user-a"), null);
});

test("blocked or full storage never throws", () => {
  assert.equal(readMediaPrefs(throwingStorage, "user-a"), null);
  assert.equal(writeMediaPrefs(throwingStorage, "user-a", prefsA), false);
  assert.equal(readMediaPrefs(null, "user-a"), null);
  assert.equal(writeMediaPrefs(undefined, "user-a", prefsA), false);
});

test("untrusted stored values are clamped or fall back to the base", () => {
  const cleaned = sanitizeMediaPrefs({
    micDeviceId: 42,
    speakerDeviceId: null,
    inputVolume: 250,
    inputSensitivity: -5,
    outputVolume: Number.NaN,
    noiseSuppression: "yes",
    inputMode: "shout",
  });
  assert.equal(cleaned.micDeviceId, DEFAULT_MEDIA_PREFS.micDeviceId, "a non-string device id keeps the default");
  assert.equal(cleaned.speakerDeviceId, null);
  assert.equal(cleaned.inputVolume, 100);
  assert.equal(cleaned.inputSensitivity, 0);
  assert.equal(cleaned.outputVolume, DEFAULT_MEDIA_PREFS.outputVolume);
  assert.equal(cleaned.noiseSuppression, DEFAULT_MEDIA_PREFS.noiseSuppression);
  assert.equal(cleaned.inputMode, "voice");
  assert.deepEqual(sanitizeMediaPrefs(null), DEFAULT_MEDIA_PREFS);
});

test("server settings seed a first-run PC without overwriting later local choices", () => {
  const seeded = seedFromServer({ inputDeviceId: "mic-x", outputDeviceId: null, cameraDeviceId: "cam-1", inputMode: "ptt", inputVolume: 80, outputVolume: 70, noiseSuppression: false, echoCancellation: true });
  assert.equal(seeded.micDeviceId, "mic-x");
  assert.equal(seeded.speakerDeviceId, null);
  assert.equal(seeded.cameraDeviceId, "cam-1");
  assert.equal(seeded.inputMode, "ptt");
  assert.equal(seeded.inputVolume, 80);
  assert.equal(seeded.outputVolume, 70);
  assert.equal(seeded.noiseSuppression, false);
  assert.equal(seeded.autoGainControl, true, "fields the server never stored keep the default");
  assert.deepEqual(seedFromServer({}), DEFAULT_MEDIA_PREFS);
});

const devices = [
  { deviceId: "default", label: "Default - USB Mic", kind: "audioinput" },
  { deviceId: "communications", label: "Communications - USB Mic", kind: "audioinput" },
  { deviceId: "mic-usb", label: "USB Mic", kind: "audioinput" },
  { deviceId: "mic-built", label: "Built-in", kind: "audioinput" },
  { deviceId: "spk-1", label: "Speakers", kind: "audiooutput" },
  { deviceId: "cam-1", label: "Webcam", kind: "videoinput" },
];

test("realDevices keeps one kind and drops the default and communications aliases", () => {
  assert.deepEqual(
    realDevices(devices, "audioinput").map((device) => device.deviceId),
    ["mic-usb", "mic-built"]
  );
  assert.deepEqual(
    realDevices(devices, "audiooutput").map((device) => device.deviceId),
    ["spk-1"]
  );
});

test("device choice: nothing saved means the system default", () => {
  assert.deepEqual(resolveDeviceChoice(null, devices, "audioinput"), { status: "system-default", deviceId: null });
});

test("device choice: a connected saved device is used", () => {
  assert.deepEqual(resolveDeviceChoice("mic-built", devices, "audioinput"), { status: "selected", deviceId: "mic-built" });
});

test("device choice: a saved device that is gone falls back to default but keeps its id", () => {
  assert.deepEqual(resolveDeviceChoice("mic-unplugged", devices, "audioinput"), { status: "missing", deviceId: null, savedDeviceId: "mic-unplugged" });
});

test("device choice: with no permission the ids are blank, so the saved id is kept, not dropped", () => {
  const blank = [
    { deviceId: "", label: "", kind: "audioinput" },
    { deviceId: "", label: "", kind: "videoinput" },
  ];
  assert.deepEqual(resolveDeviceChoice("mic-built", blank, "audioinput"), { status: "unknown", deviceId: "mic-built" });
});

test("a missing-device error triggers the default-device retry; a denied one does not", () => {
  assert.equal(isMissingDeviceError(error("OverconstrainedError")), true);
  assert.equal(isMissingDeviceError(error("NotFoundError")), true);
  assert.equal(isMissingDeviceError(error("NotAllowedError")), false);
  assert.equal(isMissingDeviceError(error("NotReadableError")), false);
  assert.equal(isMissingDeviceError(null), false);
});

test("audio constraints carry the processing toggles and an exact device only when one is chosen", () => {
  const withDevice = buildAudioConstraints({ deviceId: "mic-usb", noiseSuppression: false, echoCancellation: true, autoGainControl: true });
  assert.deepEqual(withDevice, { noiseSuppression: false, echoCancellation: true, autoGainControl: true, deviceId: { exact: "mic-usb" } });
  const systemDefault = buildAudioConstraints({ deviceId: null, noiseSuppression: true, echoCancellation: false, autoGainControl: false });
  assert.equal("deviceId" in systemDefault, false);
  assert.equal(systemDefault.echoCancellation, false);
});

test("a gain or sensitivity change keeps the same capture; a device or processing change does not", () => {
  const base = micSettingsFrom(prefsA);
  assert.equal(sameMicCapture(base, { ...base, inputVolume: 40, inputSensitivity: 60 }), true);
  assert.equal(sameMicCapture(base, { ...base, deviceId: "mic-b" }), false);
  assert.equal(sameMicCapture(base, { ...base, noiseSuppression: !base.noiseSuppression }), false);
});

test("processing is only in the outgoing path when gain or sensitivity is set", () => {
  assert.equal(needsMicProcessing({ inputVolume: 100, inputSensitivity: 0 }), false);
  assert.equal(needsMicProcessing({ inputVolume: 80, inputSensitivity: 0 }), true);
  assert.equal(needsMicProcessing({ inputVolume: 100, inputSensitivity: 10 }), true);
});

test("camera constraints follow the call's HD or ultra limits and an optional exact device", () => {
  const sd = cameraConstraints(false, null) as { width: { ideal: number }; height: { ideal: number } };
  assert.equal(sd.width.ideal, 1280);
  assert.equal(sd.height.ideal, 720);
  const hd = cameraConstraints(true, "cam-1") as { width: { ideal: number }; deviceId: { exact: string } };
  assert.equal(hd.width.ideal, 1920);
  assert.deepEqual(hd.deviceId, { exact: "cam-1" });
});

test("capture errors get a specific message for each kind", () => {
  assert.equal(classifyMediaError(error("NotAllowedError"), "microphone").code, "denied");
  assert.match(classifyMediaError(error("NotAllowedError"), "microphone").message, /Microphone access is blocked/);
  assert.match(classifyMediaError(error("NotAllowedError"), "camera").message, /Camera access is blocked/);
  assert.match(classifyMediaError(error("NotAllowedError"), "screen").message, /cancelled or blocked/);
  assert.equal(classifyMediaError(error("NotReadableError"), "camera").code, "in-use");
  assert.match(classifyMediaError(error("NotReadableError"), "camera").message, /camera is in use/);
  assert.equal(classifyMediaError(error("NotFoundError"), "microphone").code, "missing");
  assert.equal(classifyMediaError(error("OverconstrainedError"), "microphone").code, "missing");
  assert.equal(classifyMediaError(error("NotSupportedError"), "screen").code, "unsupported");
  assert.equal(classifyMediaError(new Error("boom"), "microphone").code, "unknown");
});

test("on an insecure page the message says so, whatever the error", () => {
  const failure = classifyMediaError(error("NotAllowedError"), "camera", false);
  assert.equal(failure.code, "insecure");
  assert.match(failure.message, /secure page/);
});

test("RMS and the dB meter: silence reads 0, -30 dBFS reads 50, full-scale sine reads 95", () => {
  assert.equal(rmsOf(new Float32Array([0, 0, 0, 0])), 0);
  assert.equal(rmsOf(new Float32Array([1, -1, 1, -1])), 1);
  assert.equal(rmsToMeter(0), 0);
  assert.equal(rmsToMeter(Number.NaN), 0);
  assert.equal(rmsToMeter(10 ** (-30 / 20)), 50);
  assert.equal(rmsToMeter(1 / Math.SQRT2), 95);
  assert.equal(rmsToMeter(1), 100);
});

test("sensitivity gate: 0 always sends; below the threshold it closes after the hold time", () => {
  let gate = { open: false, lastAboveMs: 0 };
  gate = nextGateState(gate, 5, 0, 1000);
  assert.equal(gate.open, true, "sensitivity 0 is always open");

  gate = nextGateState({ open: false, lastAboveMs: 0 }, 60, 40, 1000);
  assert.equal(gate.open, true, "above the threshold opens at once");
  assert.equal(gate.lastAboveMs, 1000);

  const held = nextGateState(gate, 10, 40, 1200);
  assert.equal(held.open, true, "still inside the hold time after speech");
  const closed = nextGateState(held, 10, 40, 1400);
  assert.equal(closed.open, false, "closes once the hold time has passed");
  const stillClosed = nextGateState(closed, 10, 40, 1500);
  assert.equal(stillClosed.open, false);
});

test("desktop app versions older than 1.0.15 can't share a screen; browsers and newer apps can", () => {
  assert.equal(DESKTOP_SCREEN_SHARE_VERSION, "1.0.15");
  assert.equal(desktopTooOldForScreenShare("1.0.14"), true);
  assert.equal(desktopTooOldForScreenShare("1.0.9"), true);
  assert.equal(desktopTooOldForScreenShare("0.9.99"), true);
  assert.equal(desktopTooOldForScreenShare("1.0.15"), false);
  assert.equal(desktopTooOldForScreenShare("1.0.16"), false);
  assert.equal(desktopTooOldForScreenShare("1.1.0"), false);
  assert.equal(desktopTooOldForScreenShare("2.0.0"), false);
  // Not the desktop app, or a version we can't read: never block sharing.
  assert.equal(desktopTooOldForScreenShare(null), false);
  assert.equal(desktopTooOldForScreenShare("1.0"), false);
  assert.equal(desktopTooOldForScreenShare("beta"), false);
});

test("screen share failures in the desktop app point to the update; in a browser they stay generic", () => {
  const notSupported = new DOMException("x", "NotSupportedError");
  assert.match(classifyMediaError(notSupported, "screen", true, true).message, /Desktop 1\.0\.15 or newer/);
  assert.equal(classifyMediaError(notSupported, "screen", true, false).message, "This browser or app can't use screen sharing.");
  assert.equal(classifyMediaError(new DOMException("x", "AbortError"), "screen", true, true).code, "denied");
});
