"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Loader2, Play, RotateCcw } from "lucide-react";
import type { AppearancePreferences, Preferences, SoundPreferences } from "@/lib/api";
import { THEMES, type ThemeId } from "@/lib/appearance/themes";
import { allSeasons, seasonFor, type SeasonId } from "@/lib/appearance/seasons";
import { DEFAULT_APPEARANCE, applyAppearance, resolveAppearance, soundSettingsFrom, type ResolvedAppearance } from "@/lib/appearance/preferences";
import { EGGS, discoveredEggs } from "@/lib/appearance/easter-eggs";
import { DEFAULT_SOUND_SETTINGS, previewCue, type CueName, type SoundSettings } from "@/lib/sound/sound-engine";
import { LayoutSettings } from "@/components/settings/layout-settings";

type SavePayload = { appearance: Partial<AppearancePreferences>; sounds: Partial<SoundPreferences>; notifications: { sounds: boolean } };

const label = "mb-1 block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500";
const group = "space-y-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4";
const selectClass = "h-10 w-full rounded-lg border border-white/10 bg-[#11151e] px-3 text-sm text-slate-100 outline-none focus:border-amber-400/60";
const ghostBtn = "inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:border-amber-400/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400";

function Switch({ checked, onChange, label: text, hint }: { checked: boolean; onChange: (value: boolean) => void; label: string; hint?: string }) {
  return (
    <li className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm text-slate-100">{text}</p>
        {hint ? <p className="text-[11px] text-slate-500">{hint}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={text}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-11 shrink-0 rounded-full border transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 ${checked ? "border-amber-400/60 bg-amber-500/40" : "border-white/15 bg-white/10"}`}
      >
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${checked ? "left-6" : "left-1"}`} />
      </button>
    </li>
  );
}

const SOUND_ROWS: Array<{ key: keyof SoundSettings; label: string; hint: string; cue: CueName }> = [
  { key: "voice", label: "Voice and calls", hint: "Joining, leaving, people coming and going, reconnecting.", cue: "voiceConnected" },
  { key: "screenShare", label: "Screen sharing", hint: "Sharing started, stopped, or could not start.", cue: "screenShareStarted" },
  { key: "messages", label: "Messages and notifications", hint: "Direct messages, mentions and other notifications.", cue: "message" },
  { key: "ui", label: "Clicks and confirmations", hint: "Off by default.", cue: "success" },
  { key: "seasonal", label: "Seasonal sounds", hint: "A short greeting during seasonal events.", cue: "seasonalHello" },
  { key: "easterEggs", label: "Hidden discoveries", hint: "Plays when you find an easter egg.", cue: "secret" },
];

/**
 * Settings → Appearance & Sounds. Every control previews immediately on this device and is saved to the account with
 * Save. Leaving without saving puts the saved look back.
 */
export function AppearanceSoundsSettings({
  preferences,
  userId,
  isStaff,
  saving,
  onSave,
}: {
  preferences: Preferences;
  userId: string | null;
  isStaff: boolean;
  saving: boolean;
  onSave: (payload: SavePayload) => void;
}) {
  const saved = useMemo(() => resolveAppearance(preferences.appearance), [preferences.appearance]);
  const savedSounds = useMemo(() => soundSettingsFrom(preferences), [preferences]);
  const [draft, setDraft] = useState<ResolvedAppearance>(saved);
  const [sounds, setSounds] = useState<SoundSettings>(savedSounds);
  const [seasonPreview, setSeasonPreview] = useState<SeasonId | "">("");
  const savedRef = useRef(saved);

  useEffect(() => {
    setDraft(saved);
    savedRef.current = saved;
  }, [saved]);
  useEffect(() => setSounds(savedSounds), [savedSounds]);

  // Live preview on this device. A staff-only seasonal preview overrides the date's event for the preview only.
  useEffect(() => {
    const root = document.documentElement;
    applyAppearance(root, draft);
    if (seasonPreview) root.dataset.season = seasonPreview;
  }, [draft, seasonPreview]);
  // Leaving the page without saving: back to the saved look.
  useEffect(() => () => void applyAppearance(document.documentElement, savedRef.current), []);

  const set = <K extends keyof ResolvedAppearance>(key: K, value: ResolvedAppearance[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const setSound = <K extends keyof SoundSettings>(key: K, value: SoundSettings[K]) => setSounds((current) => ({ ...current, [key]: value }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved) || JSON.stringify(sounds) !== JSON.stringify(savedSounds);
  const todaysSeason = seasonFor(new Date());
  const found = discoveredEggs(userId);

  const save = () => {
    const { messages, ...soundPrefs } = sounds;
    onSave({ appearance: draft, sounds: soundPrefs, notifications: { sounds: messages } });
  };
  const resetToDefaults = () => {
    setDraft({ ...DEFAULT_APPEARANCE });
    setSounds({ ...DEFAULT_SOUND_SETTINGS });
    setSeasonPreview("");
  };

  return (
    <div className="space-y-5">
      <section className={group} aria-labelledby="appearance-theme">
        <h3 id="appearance-theme" className="text-sm font-semibold text-white">Theme</h3>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" role="radiogroup" aria-label="Theme">
          {THEMES.map((theme) => {
            const selected = draft.theme === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => set("theme", theme.id as ThemeId)}
                className={`rounded-xl border p-3 text-left transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 ${selected ? "border-amber-400/70 bg-amber-500/10" : "border-white/10 hover:border-white/25"}`}
              >
                <span className="mb-2 flex h-10 overflow-hidden rounded-lg border border-white/10" aria-hidden="true">
                  {theme.swatch.map((color) => (
                    <span key={color} className="flex-1" style={{ backgroundColor: color }} />
                  ))}
                </span>
                <span className="block text-sm font-semibold text-white">{theme.name}</span>
                <span className="block text-[11px] leading-snug text-slate-400">{theme.description}</span>
              </button>
            );
          })}
        </div>
        <div>
          <p className={label}>Accent</p>
          <div className="flex flex-wrap gap-2">
            {([
              { key: "gold", label: "Theme default", color: "var(--nexus-gold)" },
              { key: "ember", label: "Ember", color: "#ff7a2f" },
              { key: "ice", label: "Ice", color: "#37c6ff" },
              { key: "violet", label: "Violet", color: "#a466ff" },
            ] as const).map((option) => (
              <button
                key={option.key}
                type="button"
                aria-pressed={draft.accent === option.key}
                onClick={() => set("accent", option.key)}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 ${draft.accent === option.key ? "border-amber-400/60 bg-amber-500/10 text-white" : "border-white/10 text-slate-300 hover:border-white/20"}`}
              >
                <span className="h-4 w-4 rounded-full" style={{ backgroundColor: option.color }} /> {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <label className="block text-xs text-slate-300">
            <span className={label}>Message density</span>
            <select className={selectClass} value={draft.density} onChange={(event) => set("density", event.target.value as ResolvedAppearance["density"])}>
              <option value="cozy">Cozy</option>
              <option value="compact">Compact</option>
            </select>
          </label>
          <label className="block text-xs text-slate-300">
            <span className={label}>Text size</span>
            <select className={selectClass} value={draft.fontScale} onChange={(event) => set("fontScale", event.target.value as ResolvedAppearance["fontScale"])}>
              <option value="small">Small</option>
              <option value="default">Default</option>
              <option value="large">Large</option>
            </select>
          </label>
          <label className="block text-xs text-slate-300">
            <span className={label}>Loading screen</span>
            <select className={selectClass} value={draft.loadingStyle} onChange={(event) => set("loadingStyle", event.target.value as ResolvedAppearance["loadingStyle"])}>
              <option value="forge">Forge (default)</option>
              <option value="pulse">Pulse</option>
              <option value="minimal">Minimal</option>
            </select>
          </label>
        </div>
        <ul className="space-y-3">
          <Switch checked={draft.showAvatarsInChat} onChange={(value) => set("showAvatarsInChat", value)} label="Show avatars in chat" hint="Hide them for a denser message list." />
        </ul>
      </section>

      <section className={group} aria-labelledby="appearance-motion">
        <h3 id="appearance-motion" className="text-sm font-semibold text-white">Motion and effects</h3>
        <label className="block max-w-xs text-xs text-slate-300">
          <span className={label}>Animation</span>
          <select className={selectClass} value={draft.animation} onChange={(event) => set("animation", event.target.value as ResolvedAppearance["animation"])}>
            <option value="full">Full</option>
            <option value="subtle">Subtle (no looping effects)</option>
            <option value="off">Off</option>
          </select>
        </label>
        <ul className="space-y-3">
          <Switch checked={draft.decorativeEffects} onChange={(value) => set("decorativeEffects", value)} label="Decorative effects" hint="Background glow, theme patterns and particles." />
          <Switch checked={draft.seasonal} onChange={(value) => set("seasonal", value)} label="Seasonal visuals" hint={todaysSeason ? `On now: ${todaysSeason.name}. Turn off to keep your theme as is.` : "Short themed touches during holidays and NFG milestones."} />
          <Switch checked={draft.easterEggs} onChange={(value) => set("easterEggs", value)} label="Easter eggs" hint={`Hidden surprises. Found ${found.length} of ${Object.keys(EGGS).length} on this device.`} />
        </ul>
        {isStaff ? (
          <label className="block max-w-xs text-xs text-slate-300">
            <span className={label}>Preview a seasonal event (staff)</span>
            <select className={selectClass} value={seasonPreview} onChange={(event) => setSeasonPreview(event.target.value as SeasonId | "")}>
              <option value="">Today&apos;s date</option>
              {allSeasons().map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </section>

      <section className={group} aria-labelledby="appearance-sounds">
        <h3 id="appearance-sounds" className="text-sm font-semibold text-white">Sounds</h3>
        <ul className="space-y-3">
          <Switch checked={sounds.enabled} onChange={(value) => setSound("enabled", value)} label="Sound effects" hint="Turn every Nexus Forge sound effect on or off. Voice chat itself is not affected." />
        </ul>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block text-xs text-slate-300">
            <span className={label}>Volume: {sounds.volume}%</span>
            <input type="range" min={0} max={100} step={5} value={sounds.volume} disabled={!sounds.enabled} onChange={(event) => setSound("volume", Number(event.target.value))} className="w-full accent-amber-400" aria-label="Sound effects volume" />
          </label>
          <label className="block text-xs text-slate-300">
            <span className={label}>Sound pack</span>
            <select className={selectClass} value={sounds.pack} disabled={!sounds.enabled} onChange={(event) => setSound("pack", event.target.value as SoundSettings["pack"])}>
              <option value="forge">Forge (bright)</option>
              <option value="soft">Soft (lower, quieter)</option>
            </select>
          </label>
        </div>
        <ul className="space-y-3">
          {SOUND_ROWS.map((row) => (
            <li key={row.key} className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-100">{row.label}</p>
                <p className="text-[11px] text-slate-500">{row.hint}</p>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" className={ghostBtn} onClick={() => previewCue(row.cue, sounds)} aria-label={`Preview: ${row.label}`}>
                  <Play className="h-3 w-3" /> Preview
                </button>
                <button
                  type="button"
                  role="switch"
                  aria-checked={Boolean(sounds[row.key])}
                  aria-label={row.label}
                  disabled={!sounds.enabled}
                  onClick={() => setSound(row.key, !sounds[row.key] as never)}
                  className={`relative h-6 w-11 shrink-0 rounded-full border transition disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400 ${sounds[row.key] ? "border-amber-400/60 bg-amber-500/40" : "border-white/15 bg-white/10"}`}
                >
                  <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${sounds[row.key] ? "left-6" : "left-1"}`} />
                </button>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-slate-500">Every sound also shows on screen, so nothing important depends on hearing it.</p>
      </section>

      <section className={group} aria-labelledby="appearance-access">
        <h3 id="appearance-access" className="text-sm font-semibold text-white">Accessibility</h3>
        <ul className="space-y-3">
          <Switch checked={draft.reduceMotion} onChange={(value) => set("reduceMotion", value)} label="Reduce motion" hint="Stops animations and transitions everywhere. Your system's reduce-motion setting is respected too." />
          <Switch checked={draft.noFlashing} onChange={(value) => set("noFlashing", value)} label="No flashing" hint="Stops blinking and pulsing indicators." />
          <Switch checked={draft.theme === "high-contrast"} onChange={(value) => set("theme", value ? "high-contrast" : "forge-dark")} label="High contrast" hint="Black and white with bright, clearly marked controls." />
          <Switch checked={!sounds.enabled} onChange={(value) => setSound("enabled", !value)} label="Mute all effects" hint="Silences every sound effect. Voice chat is not affected." />
        </ul>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={!dirty || saving} onClick={save} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-950 transition hover:bg-amber-300 disabled:opacity-50">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Save appearance and sounds
        </button>
        <button type="button" onClick={resetToDefaults} className={ghostBtn}>
          <RotateCcw className="h-3 w-3" /> Reset to defaults
        </button>
        <p className="text-[11px] text-slate-500">Changes preview on this device straight away and apply everywhere you sign in once saved.</p>
      </div>

      <LayoutSettings />
    </div>
  );
}
