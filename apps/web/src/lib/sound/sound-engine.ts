/**
 * The app's sound effects, in one place. Every cue is synthesized here with the Web Audio API (no audio files, so
 * nothing is borrowed from other apps or games and nothing has to download). Components never play audio themselves:
 * they call playCue() for a real state change, and this module decides whether it is heard:
 *  - the master switch, the volume and the cue's category (voice, screen share, messages, UI, seasonal, easter eggs);
 *  - a per-cue cooldown, so a burst of identical events (a re-render, two events for one change) plays once;
 *  - at most a few sounds at a time, so cues never pile up over voice chat.
 * Sound never replaces a visual notice: every event that plays a cue is also shown on screen.
 */

export type SoundCategory = "voice" | "screenShare" | "messages" | "ui" | "seasonal" | "easterEggs";
export type SoundPack = "forge" | "soft";

export type SoundSettings = {
  enabled: boolean;
  /** 0 to 100. */
  volume: number;
  pack: SoundPack;
  voice: boolean;
  screenShare: boolean;
  /** Message and notification sounds (Settings → Notifications → Notification sounds). */
  messages: boolean;
  ui: boolean;
  seasonal: boolean;
  easterEggs: boolean;
};

export const DEFAULT_SOUND_SETTINGS: SoundSettings = {
  enabled: true,
  volume: 70,
  pack: "forge",
  voice: true,
  screenShare: true,
  messages: true,
  ui: false,
  seasonal: true,
  easterEggs: true,
};

type Note = { freq: number; at: number; dur: number; glideTo?: number; gain?: number };
type Cue = { label: string; category: SoundCategory; cooldownMs: number; notes: Note[] };

// Short, quiet, original cues. Frequencies stay in a comfortable range (no piercing highs), and each lasts under a second.
export const CUES = {
  voiceConnected: { label: "You joined a voice channel", category: "voice", cooldownMs: 1500, notes: [{ freq: 523, at: 0, dur: 0.12 }, { freq: 784, at: 0.1, dur: 0.18 }] },
  voiceDisconnected: { label: "You left a voice channel", category: "voice", cooldownMs: 1500, notes: [{ freq: 784, at: 0, dur: 0.12 }, { freq: 523, at: 0.1, dur: 0.2 }] },
  participantJoined: { label: "Someone joined your channel", category: "voice", cooldownMs: 700, notes: [{ freq: 659, at: 0, dur: 0.08 }, { freq: 880, at: 0.07, dur: 0.12, gain: 0.8 }] },
  participantLeft: { label: "Someone left your channel", category: "voice", cooldownMs: 700, notes: [{ freq: 880, at: 0, dur: 0.08, gain: 0.8 }, { freq: 659, at: 0.07, dur: 0.12, gain: 0.8 }] },
  connectionLost: { label: "Connection lost, reconnecting", category: "voice", cooldownMs: 4000, notes: [{ freq: 392, at: 0, dur: 0.16 }, { freq: 330, at: 0.16, dur: 0.22 }] },
  reconnected: { label: "Reconnected", category: "voice", cooldownMs: 4000, notes: [{ freq: 523, at: 0, dur: 0.08 }, { freq: 659, at: 0.08, dur: 0.08 }, { freq: 784, at: 0.16, dur: 0.14 }] },
  screenShareStarted: { label: "Screen sharing started", category: "screenShare", cooldownMs: 1500, notes: [{ freq: 440, at: 0, dur: 0.22, glideTo: 880 }] },
  screenShareStopped: { label: "Screen sharing stopped", category: "screenShare", cooldownMs: 1500, notes: [{ freq: 880, at: 0, dur: 0.22, glideTo: 440 }] },
  screenShareFailed: { label: "Screen sharing could not start", category: "screenShare", cooldownMs: 1500, notes: [{ freq: 247, at: 0, dur: 0.14 }, { freq: 220, at: 0.14, dur: 0.2 }] },
  message: { label: "New message or mention", category: "messages", cooldownMs: 1200, notes: [{ freq: 880, at: 0, dur: 0.1 }, { freq: 1319, at: 0.09, dur: 0.16, gain: 0.7 }] },
  success: { label: "Action finished", category: "ui", cooldownMs: 600, notes: [{ freq: 988, at: 0, dur: 0.12, gain: 0.7 }] },
  error: { label: "Something went wrong", category: "ui", cooldownMs: 800, notes: [{ freq: 262, at: 0, dur: 0.18 }] },
  click: { label: "Button click", category: "ui", cooldownMs: 60, notes: [{ freq: 1568, at: 0, dur: 0.025, gain: 0.35 }] },
  seasonalHello: { label: "Seasonal greeting", category: "seasonal", cooldownMs: 60000, notes: [{ freq: 659, at: 0, dur: 0.14 }, { freq: 784, at: 0.13, dur: 0.14 }, { freq: 1047, at: 0.26, dur: 0.24 }] },
  secret: { label: "Hidden discovery", category: "easterEggs", cooldownMs: 3000, notes: [{ freq: 1047, at: 0, dur: 0.08 }, { freq: 1319, at: 0.07, dur: 0.08 }, { freq: 1568, at: 0.14, dur: 0.08 }, { freq: 2093, at: 0.21, dur: 0.22, gain: 0.6 }] },
} satisfies Record<string, Cue>;

export type CueName = keyof typeof CUES;

const MAX_VOICES = 4;

/** Whether a cue may play now. Pure, so the rules can be tested without audio. */
export function shouldPlay(cue: CueName, settings: SoundSettings, now: number, lastPlayedAt: number | undefined): { play: boolean; reason: string } {
  if (!settings.enabled) return { play: false, reason: "all sound effects are off" };
  if (settings.volume <= 0) return { play: false, reason: "volume is zero" };
  const { category, cooldownMs } = CUES[cue];
  if (!settings[category]) return { play: false, reason: `${category} sounds are off` };
  if (lastPlayedAt !== undefined && now - lastPlayedAt < cooldownMs) return { play: false, reason: "played a moment ago" };
  return { play: true, reason: "ok" };
}

/** Clamps settings from storage or the server into a safe shape. Unknown or broken values fall back to the defaults. */
export function normalizeSoundSettings(input: Partial<Record<keyof SoundSettings, unknown>> | null | undefined): SoundSettings {
  const source = input ?? {};
  const bool = (key: keyof SoundSettings) => (typeof source[key] === "boolean" ? (source[key] as boolean) : (DEFAULT_SOUND_SETTINGS[key] as boolean));
  const volume = typeof source.volume === "number" && Number.isFinite(source.volume) ? Math.min(100, Math.max(0, Math.round(source.volume))) : DEFAULT_SOUND_SETTINGS.volume;
  const pack: SoundPack = source.pack === "soft" ? "soft" : "forge";
  return {
    enabled: bool("enabled"),
    volume,
    pack,
    voice: bool("voice"),
    screenShare: bool("screenShare"),
    messages: bool("messages"),
    ui: bool("ui"),
    seasonal: bool("seasonal"),
    easterEggs: bool("easterEggs"),
  };
}

let settings: SoundSettings = DEFAULT_SOUND_SETTINGS;
let context: AudioContext | null = null;
let activeVoices = 0;
const lastPlayed = new Map<CueName, number>();

export function configureSounds(next: SoundSettings) {
  settings = next;
}

export function currentSoundSettings(): SoundSettings {
  return settings;
}

function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!context) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      context = new Ctor();
    } catch {
      return null;
    }
  }
  if (context.state === "suspended") void context.resume().catch(() => undefined);
  return context;
}

function render(cue: CueName) {
  const ctx = audioContext();
  if (!ctx || activeVoices >= MAX_VOICES) return false;
  const soft = settings.pack === "soft";
  const master = ctx.createGain();
  // Kept deliberately quiet: full volume is still well under a voice at normal level.
  master.gain.value = (settings.volume / 100) * (soft ? 0.18 : 0.26);
  master.connect(ctx.destination);
  const start = ctx.currentTime + 0.01;
  let end = start;
  const notes: readonly Note[] = CUES[cue].notes;
  for (const note of notes) {
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = soft ? "sine" : "triangle";
    const freq = soft ? note.freq / 2 : note.freq;
    osc.frequency.setValueAtTime(freq, start + note.at);
    if (note.glideTo) osc.frequency.exponentialRampToValueAtTime(soft ? note.glideTo / 2 : note.glideTo, start + note.at + note.dur);
    const peak = note.gain ?? 1;
    env.gain.setValueAtTime(0.0001, start + note.at);
    env.gain.exponentialRampToValueAtTime(peak, start + note.at + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, start + note.at + note.dur);
    osc.connect(env).connect(master);
    osc.start(start + note.at);
    osc.stop(start + note.at + note.dur + 0.02);
    end = Math.max(end, start + note.at + note.dur + 0.02);
  }
  activeVoices += 1;
  window.setTimeout(() => {
    activeVoices = Math.max(0, activeVoices - 1);
    master.disconnect();
  }, Math.ceil((end - ctx.currentTime) * 1000) + 50);
  return true;
}

/** Plays a cue for a real event, if the settings and cooldown allow it. Never throws. */
export function playCue(cue: CueName): boolean {
  try {
    const now = Date.now();
    if (!shouldPlay(cue, settings, now, lastPlayed.get(cue)).play) return false;
    lastPlayed.set(cue, now);
    return render(cue);
  } catch {
    return false;
  }
}

/** Settings preview: plays the cue at the chosen volume and pack even if its category is off. */
export function previewCue(cue: CueName, preview: SoundSettings = settings): boolean {
  try {
    const saved = settings;
    settings = { ...preview, enabled: true };
    const played = render(cue);
    settings = saved;
    return played;
  } catch {
    return false;
  }
}
