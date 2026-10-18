"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Headphones, Loader2, Mic, Shield, Video, Volume2 } from "lucide-react";
import { Toggle } from "@/components/settings/toggle";
import { DevicePicker } from "@/components/voice/device-picker";
import { useMediaDevices } from "@/components/voice/use-media-devices";
import {
  MicLevelMeter,
  isSecurePage,
  mediaDevicesAvailable,
  openCamera,
  openMicrophone,
  outputSelectionSupported,
  playTestTone,
  stopStream,
  type PermissionValue,
} from "@/lib/media/media-devices";
import { classifyMediaError, isMissingDeviceError, type MediaPrefs, type ServerVoiceSeed } from "@/lib/media/media-prefs";
import { useMediaPrefsSync, useMediaStore } from "@/lib/media/media-store";

const panel = "vx-panel rounded-2xl p-4";
const sectionTitle = "nf-heading text-[13px] font-bold uppercase tracking-[0.18em] text-white";
const goldBtn = "inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-950 transition hover:bg-amber-300 disabled:opacity-50";
const ghostBtn = "inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200 transition hover:border-amber-400/50 disabled:opacity-50";
const hint = "text-[11px] text-slate-500";

/**
 * Settings > Voice & Video. Every control changes what the browser does: the mic and camera
 * are opened with the chosen device and processing, the meter reads the same signal the call
 * sends, and the speaker test routes through the chosen output where the browser allows it.
 */
export function VoiceVideoSettings({ userId, serverVoice }: { userId: string | null; serverVoice: ServerVoiceSeed | undefined }) {
  useMediaPrefsSync(userId, serverVoice);
  const prefs = useMediaStore((state) => state.prefs);
  const micNotice = useMediaStore((state) => state.micNotice);
  const { devices, microphone, camera, refresh } = useMediaDevices();
  // Read after mount so the server render and the first client render match.
  const [support, setSupport] = useState({ secure: true, api: true, output: false });
  useEffect(() => {
    setSupport({ secure: isSecurePage(), api: mediaDevicesAvailable(), output: outputSelectionSupported() });
  }, []);

  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <p className="text-xs text-slate-400 xl:col-span-2">
        Your choices are saved on this device for this account. They apply right away, and during a call too. Device names show once you allow access.
      </p>
      <MicPanel prefs={prefs} devices={devices} permission={microphone} notice={micNotice?.text ?? null} onDevicesChanged={refresh} apiAvailable={support.api} />
      <div className="space-y-4">
        <SpeakerPanel prefs={prefs} devices={devices} outputSupported={support.output} />
        <CameraPanel prefs={prefs} devices={devices} permission={camera} onDevicesChanged={refresh} />
      </div>
      <TroubleshootingPanel microphone={microphone} camera={camera} secure={support.secure} />
    </div>
  );
}

function Notice({ tone, children }: { tone: "error" | "warn" | "info"; children: ReactNode }) {
  const style = tone === "error" ? "border-rose-400/30 bg-rose-500/10 text-rose-100" : tone === "warn" ? "border-amber-400/30 bg-amber-500/10 text-amber-100" : "border-white/10 bg-white/[0.03] text-slate-300";
  return <p className={`rounded-lg border px-3 py-2 text-xs ${style}`}>{children}</p>;
}

function PermissionPill({ label, state }: { label: string; state: PermissionValue }) {
  const text = state === "granted" ? "Allowed" : state === "denied" ? "Blocked" : state === "prompt" ? "Not asked yet" : "Unknown";
  const tone = state === "granted" ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200" : state === "denied" ? "border-rose-400/40 bg-rose-500/10 text-rose-200" : "border-white/10 bg-white/[0.03] text-slate-300";
  return <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${tone}`}>{label}: {text}</span>;
}

function Slider({ label, value, onChange, note }: { label: string; value: number; onChange: (value: number) => void; note?: string }) {
  return (
    <label className="block text-xs text-slate-300">
      <span className="mb-1 flex justify-between text-[10px] uppercase tracking-[0.18em] text-slate-500">
        <span>{label}</span>
        <span>{value}</span>
      </span>
      <input type="range" min={0} max={100} value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full accent-amber-400" />
      {note ? <span className={`mt-1 block ${hint}`}>{note}</span> : null}
    </label>
  );
}

function MicPanel({
  prefs,
  devices,
  permission,
  notice,
  onDevicesChanged,
  apiAvailable,
}: {
  prefs: MediaPrefs;
  devices: MediaDeviceInfo[];
  permission: PermissionValue;
  notice: string | null;
  onDevicesChanged: () => void;
  apiAvailable: boolean;
}) {
  const update = useMediaStore((state) => state.update);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  // Asking for the mic (and camera) once is what makes the browser list device names.
  const showNames = async () => {
    setUnlocking(true);
    setUnlockError(null);
    try {
      stopStream(await openMicrophone({ deviceId: null, noiseSuppression: prefs.noiseSuppression, echoCancellation: prefs.echoCancellation, autoGainControl: prefs.autoGainControl }));
    } catch (error) {
      setUnlockError(classifyMediaError(error, "microphone", isSecurePage()).message);
    }
    try {
      // The camera is only for the device names; its stream is closed straight away.
      stopStream(await openCamera(null, false));
    } catch {
      // Camera access is optional here; its own panel shows whether it was allowed.
    }
    setUnlocking(false);
    onDevicesChanged();
  };

  return (
    <section className={`${panel} space-y-4`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={`${sectionTitle} inline-flex items-center gap-2`}>
          <Mic className="h-4 w-4 vx-accent" /> Microphone
        </h2>
        <button type="button" className={ghostBtn} disabled={unlocking || !apiAvailable} onClick={() => void showNames()}>
          {unlocking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Show device names
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <PermissionPill label="Microphone" state={permission} />
      </div>
      <p className={hint}>Show device names asks for microphone and camera access once, so the browser can list your devices. The camera is closed right away.</p>
      {!apiAvailable ? <Notice tone="error">This browser can&apos;t access a microphone.</Notice> : null}
      {unlockError ? <Notice tone="error">{unlockError}</Notice> : null}
      {notice ? <Notice tone="warn">{notice}</Notice> : null}
      <DevicePicker id="settings-mic" label="Input device" kind="audioinput" devices={devices} value={prefs.micDeviceId} onChange={(micDeviceId) => update({ micDeviceId })} />
      <MicTest prefs={prefs} onOpened={onDevicesChanged} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Slider label="Input volume" value={prefs.inputVolume} onChange={(inputVolume) => update({ inputVolume })} note="Gain on your mic. 100 is unchanged." />
        <Slider label="Input sensitivity" value={prefs.inputSensitivity} onChange={(inputSensitivity) => update({ inputSensitivity })} note="0 always sends. Higher values mute quiet sounds." />
      </div>
      <div className="flex gap-1 rounded-lg border border-white/10 bg-[#11151e] p-1">
        {(["voice", "ptt"] as const).map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => update({ inputMode: mode })}
            className={`flex-1 rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] ${prefs.inputMode === mode ? "bg-amber-400 text-slate-950" : "text-slate-400 hover:text-white"}`}
          >
            {mode === "voice" ? "Voice activity" : "Push to talk"}
          </button>
        ))}
      </div>
      <p className={hint}>Push to talk: during a call, hold the ` key to talk.</p>
      <ul className="space-y-3">
        <ToggleRow label="Noise suppression" checked={prefs.noiseSuppression} onChange={(noiseSuppression) => update({ noiseSuppression })} />
        <ToggleRow label="Echo cancellation" checked={prefs.echoCancellation} onChange={(echoCancellation) => update({ echoCancellation })} />
        <ToggleRow label="Automatic gain control" checked={prefs.autoGainControl} onChange={(autoGainControl) => update({ autoGainControl })} />
      </ul>
      <p className={hint}>Processing changes apply to your mic straight away, including during a call.</p>
    </section>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <p className="text-sm text-slate-100">{label}</p>
      <Toggle checked={checked} onChange={onChange} label={label} />
    </li>
  );
}

/** Live mic meter for the test. It reads the same signal the call would send (device, processing, input volume). */
function MicTest({ prefs, onOpened }: { prefs: MediaPrefs; onOpened: () => void }) {
  const [running, setRunning] = useState(false);
  const [level, setLevel] = useState(0);
  const [peak, setPeak] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [fellBack, setFellBack] = useState(false);
  const meterRef = useRef<MicLevelMeter | null>(null);
  const volumeRef = useRef(prefs.inputVolume);
  useEffect(() => {
    volumeRef.current = prefs.inputVolume;
    meterRef.current?.setInputVolume(prefs.inputVolume);
  }, [prefs.inputVolume]);

  useEffect(() => {
    if (!running) return;
    let cancelled = false;
    let timer = 0;
    setError(null);
    setFellBack(false);
    setPeak(0);
    MicLevelMeter.open({ deviceId: prefs.micDeviceId, noiseSuppression: prefs.noiseSuppression, echoCancellation: prefs.echoCancellation, autoGainControl: prefs.autoGainControl, inputVolume: volumeRef.current })
      .then((meter) => {
        if (cancelled) {
          meter.close();
          return;
        }
        meterRef.current = meter;
        setFellBack(meter.fellBack);
        // The microphone is open now, so the browser can name the devices and report the permission.
        onOpened();
        const tick = () => {
          if (cancelled) return;
          const value = meter.read();
          setLevel(value);
          setPeak((current) => Math.max(current, value));
          timer = window.setTimeout(tick, 80);
        };
        tick();
      })
      .catch((failure: unknown) => {
        if (cancelled) return;
        setError(classifyMediaError(failure, "microphone", isSecurePage()).message);
        setRunning(false);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      meterRef.current?.close();
      meterRef.current = null;
      setLevel(0);
    };
    // onOpened only refreshes the device list; it is read at open time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, prefs.micDeviceId, prefs.noiseSuppression, prefs.echoCancellation, prefs.autoGainControl]);

  const threshold = prefs.inputSensitivity;
  const sending = running && (threshold === 0 || level >= threshold);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Mic test</p>
        <button type="button" className={running ? ghostBtn : goldBtn} onClick={() => setRunning((current) => !current)}>
          {running ? "Stop test" : "Start mic test"}
        </button>
      </div>
      <div className="relative h-2.5 overflow-hidden rounded-full bg-slate-800" aria-label="Input level" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={level}>
        <div className="h-full rounded-full bg-emerald-400 transition-[width] duration-75" style={{ width: `${level}%` }} />
        {threshold > 0 ? <div className="absolute -top-0.5 h-3.5 w-0.5 bg-amber-300" style={{ left: `${threshold}%` }} title="Sensitivity" /> : null}
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {running && fellBack ? <Notice tone="warn">Your saved microphone isn&apos;t connected, so this test uses the system default.</Notice> : null}
      <p className={hint}>
        {running
          ? threshold === 0 || sending
            ? "Speak normally. The bar follows your input after input volume. Others can hear you at this level."
            : "Below your sensitivity right now, so others can't hear this level."
          : "Start the mic test, then speak. The bar shows what the call would send."}
        {running ? ` Peak: ${peak}.` : null}
      </p>
    </div>
  );
}

function SpeakerPanel({ prefs, devices, outputSupported }: { prefs: MediaPrefs; devices: MediaDeviceInfo[]; outputSupported: boolean }) {
  const update = useMediaStore((state) => state.update);
  const [playing, setPlaying] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const play = async () => {
    setPlaying(true);
    setNote(null);
    try {
      const result = await playTestTone(prefs.speakerDeviceId, prefs.outputVolume / 100);
      setNote(prefs.outputVolume === 0 ? "Output volume is 0, so the tone is silent." : result.note);
    } catch {
      setNote("The test tone couldn't play in this browser.");
    } finally {
      setPlaying(false);
    }
  };

  return (
    <section className={`${panel} space-y-4`}>
      <h2 className={`${sectionTitle} inline-flex items-center gap-2`}>
        <Headphones className="h-4 w-4 vx-accent" /> Speakers and headphones
      </h2>
      {!outputSupported ? <Notice tone="warn">This browser can&apos;t choose a speaker, so audio plays through the system default output. Chrome and Edge can.</Notice> : null}
      <DevicePicker id="settings-speaker" label="Output device" kind="audiooutput" devices={devices} value={prefs.speakerDeviceId} onChange={(speakerDeviceId) => update({ speakerDeviceId })} disabled={!outputSupported} />
      <Slider label="Output volume" value={prefs.outputVolume} onChange={(outputVolume) => update({ outputVolume })} note="Scales everyone else's voices and the soundboard." />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={ghostBtn} disabled={playing} onClick={() => void play()}>
          <Volume2 className="h-3.5 w-3.5" /> {playing ? "Playing..." : "Play test tone"}
        </button>
        {note ? <p className={hint}>{note}</p> : null}
      </div>
    </section>
  );
}

/** Opens the chosen camera for the preview. A saved camera that is gone falls back to the default one. */
async function openPreview(deviceId: string | null): Promise<{ stream: MediaStream; fellBack: boolean }> {
  try {
    return { stream: await openCamera(deviceId, false), fellBack: false };
  } catch (error) {
    if (deviceId && isMissingDeviceError(error)) return { stream: await openCamera(null, false), fellBack: true };
    throw error;
  }
}

function CameraPanel({ prefs, devices, permission, onDevicesChanged }: { prefs: MediaPrefs; devices: MediaDeviceInfo[]; permission: PermissionValue; onDevicesChanged: () => void }) {
  const update = useMediaStore((state) => state.update);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fellBack, setFellBack] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!previewing) return;
    let cancelled = false;
    let opened: MediaStream | null = null;
    const video = videoRef.current;
    setError(null);
    openPreview(prefs.cameraDeviceId)
      .then((result) => {
        // Closed or unmounted while the camera was opening: release it at once.
        if (cancelled) {
          stopStream(result.stream);
          return;
        }
        opened = result.stream;
        setFellBack(result.fellBack);
        if (video) video.srcObject = result.stream;
        onDevicesChanged();
      })
      .catch((failure: unknown) => {
        if (cancelled) return;
        setError(classifyMediaError(failure, "camera", isSecurePage()).message);
        setPreviewing(false);
      });
    return () => {
      // Closing the preview or leaving the page stops every track it opened.
      cancelled = true;
      stopStream(opened);
      if (video) video.srcObject = null;
    };
    // The camera choice is read when the preview starts; picking another one restarts it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewing, prefs.cameraDeviceId]);

  return (
    <section className={`${panel} space-y-4`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={`${sectionTitle} inline-flex items-center gap-2`}>
          <Video className="h-4 w-4 vx-accent" /> Camera
        </h2>
        <button type="button" className={previewing ? ghostBtn : goldBtn} onClick={() => setPreviewing((current) => !current)}>
          {previewing ? "Stop preview" : "Start preview"}
        </button>
      </div>
      <PermissionPill label="Camera" state={permission} />
      <DevicePicker id="settings-camera" label="Camera" kind="videoinput" devices={devices} value={prefs.cameraDeviceId} onChange={(cameraDeviceId) => update({ cameraDeviceId })} />
      {previewing ? (
        <div className="aspect-video overflow-hidden rounded-xl border border-white/10 bg-black">
          <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" style={{ transform: "scaleX(-1)" }} />
        </div>
      ) : null}
      {fellBack && previewing ? <Notice tone="warn">Your saved camera isn&apos;t connected, so the preview uses the default camera.</Notice> : null}
      {error ? <Notice tone="error">{error}</Notice> : null}
      <p className={hint}>The preview stops when you close it or leave this page. In a call, changing camera switches the video without rejoining.</p>
    </section>
  );
}

function TroubleshootingPanel({ microphone, camera, secure }: { microphone: PermissionValue; camera: PermissionValue; secure: boolean }) {
  return (
    <section className={`${panel} space-y-3 xl:col-span-2`}>
      <h2 className={`${sectionTitle} inline-flex items-center gap-2`}>
        <Shield className="h-4 w-4 vx-accent" /> Permissions and troubleshooting
      </h2>
      <div className="flex flex-wrap gap-2">
        <PermissionPill label="Microphone" state={microphone} />
        <PermissionPill label="Camera" state={camera} />
        <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${secure ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200" : "border-rose-400/40 bg-rose-500/10 text-rose-200"}`}>
          Secure page: {secure ? "Yes" : "No"}
        </span>
      </div>
      <ul className="list-disc space-y-1.5 pl-5 text-xs text-slate-400">
        <li>
          <strong className="text-white">Blocked?</strong> Open the site settings from the address bar, set Microphone and Camera to Allow, then reload this page.
        </li>
        <li>
          <strong className="text-white">Windows:</strong> Settings &gt; Privacy &amp; security &gt; Microphone (and Camera). Turn on access and allow desktop apps to use it.
        </li>
        <li>
          <strong className="text-white">In use by another app?</strong> A video call, streaming tool or game can hold a device. Close that app, then try again.
        </li>
        <li>
          <strong className="text-white">Saved device unplugged?</strong> Nexus Forge uses the system default for now and switches back when your device returns.
        </li>
        <li>
          <strong className="text-white">Speakers:</strong> picking an output needs a Chromium-based browser (Chrome, Edge). Other browsers always use the system default.
        </li>
        <li>
          <strong className="text-white">Screen sharing:</strong> the browser shows a picker. Cancelling it, or using the browser&apos;s Stop sharing control, ends the share.
        </li>
        <li>
          <strong className="text-white">Saved on this device:</strong> your choices are stored in this browser for this account. They don&apos;t follow you to another computer.
        </li>
      </ul>
    </section>
  );
}
