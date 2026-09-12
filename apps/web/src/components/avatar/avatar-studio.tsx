"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Check, Dices, Eye, Glasses, Loader2, Mountain, Redo2, Save, Scissors, Shirt, Smile, Trash2, Undo2, User, X } from "lucide-react";
import { applyAvatarPreset, createAvatarPreset, deleteAvatarPreset, getAvatar, saveAvatar, type AvatarConfig } from "@/lib/api";
import { AvatarRenderer, defaultAvatarConfig } from "@/components/avatar/avatar-renderer";
import { useAuthStore } from "@/store/auth-store";

type Category = "body" | "hair" | "face" | "eyes" | "outfit" | "accessories" | "background";
type Tab = "studio" | "collection" | "animations";

const categories: Array<{ id: Category; label: string; icon: typeof User }> = [
  { id: "body", label: "Body", icon: User },
  { id: "hair", label: "Hair", icon: Scissors },
  { id: "face", label: "Face", icon: Smile },
  { id: "eyes", label: "Eyes", icon: Eye },
  { id: "outfit", label: "Outfit", icon: Shirt },
  { id: "accessories", label: "Extras", icon: Glasses },
  { id: "background", label: "Scene", icon: Mountain },
];

const hairStyles: AvatarConfig["hair"][] = ["spiky", "fade", "curls", "long", "bun", "buzz", "mohawk", "none"];
const hairColors = ["#22d3ee", "#e6b325", "#f472b6", "#a855f7", "#ef4444", "#10b981", "#f8fafc", "#0f172a", "#7c2d12", "#fde68a"];
const skinTones = ["#f5d0b0", "#e8b894", "#d9a577", "#c48a5a", "#a66a3f", "#7a4a2b", "#5b3520", "#3f2417"];
const eyeStyles: AvatarConfig["eyes"][] = ["sharp", "round", "calm", "visor"];
const eyeColors = ["#38bdf8", "#22c55e", "#a855f7", "#e6b325", "#ef4444", "#f8fafc", "#1e293b"];
const faces: AvatarConfig["face"][] = ["focused", "neutral", "smirk", "grin"];
const accessories: AvatarConfig["accessory"][] = ["none", "shades", "headset", "mask", "bandana"];
const outfitColors = ["#111318", "#1d4ed8", "#7f1d1d", "#334155", "#3f3f46", "#4c1d95", "#e6b325", "#e2e8f0", "#0f766e", "#9a3412"];
const backgrounds: AvatarConfig["background"][] = ["city", "forge", "void", "arena"];

const panel = "rounded-2xl border border-amber-500/15 bg-[#0d1119] p-4";
const goldBtn = "inline-flex items-center gap-1.5 rounded-lg bg-amber-400 px-3.5 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-950 transition hover:bg-amber-300 disabled:opacity-50";
const ghostBtn = "inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-200 transition hover:border-amber-400/50 disabled:opacity-50";

function errorText(error: unknown) {
  if (axios.isAxiosError(error)) return (error.response?.data as { error?: string } | undefined)?.error ?? error.message;
  return error instanceof Error ? error.message : "Something went wrong";
}

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

function randomConfig(): AvatarConfig {
  const accent = pick(["#e6b325", "#22d3ee", "#f472b6", "#a855f7", "#22c55e"]);
  return {
    body: pick(["slim", "athletic", "broad"] as const),
    skin: pick(skinTones),
    hair: pick(hairStyles.filter((style) => style !== "none")),
    hairColor: pick(hairColors),
    hairLength: Math.floor(Math.random() * 100),
    eyes: pick(eyeStyles),
    eyeColor: pick(eyeColors),
    face: pick(faces),
    accessory: pick(accessories),
    topColor: pick(outfitColors),
    bottomColor: pick(outfitColors),
    shoeColor: pick(outfitColors),
    accent,
    background: pick(backgrounds),
  };
}

function Swatches({ colors, value, onPick }: { colors: string[]; value: string; onPick: (color: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {colors.map((color) => (
        <button
          key={color}
          type="button"
          onClick={() => onPick(color)}
          title={color}
          style={{ backgroundColor: color }}
          className={`h-7 w-7 rounded-full border-2 transition ${value.toLowerCase() === color.toLowerCase() ? "border-amber-300 scale-110" : "border-white/10 hover:border-white/40"}`}
        />
      ))}
      <label className="relative h-7 w-7 cursor-pointer overflow-hidden rounded-full border-2 border-dashed border-white/20" title="Custom color">
        <input type="color" value={value} onChange={(event) => onPick(event.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
        <span className="flex h-full w-full items-center justify-center text-[10px] text-slate-400">+</span>
      </label>
    </div>
  );
}

function Options<T extends string>({ options, value, onPick, render }: { options: readonly T[]; value: T; onPick: (value: T) => void; render?: (value: T) => React.ReactNode }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onPick(option)}
          className={`rounded-lg border px-2 py-2 text-[11px] font-semibold capitalize transition ${value === option ? "border-amber-400 bg-amber-500/10 text-amber-100" : "border-white/10 bg-[#11151e] text-slate-300 hover:border-white/30"}`}
        >
          {render ? render(option) : option}
        </button>
      ))}
    </div>
  );
}

export function AvatarStudio() {
  const queryClient = useQueryClient();
  const { accessToken, csrfToken } = useAuthStore();
  const [tab, setTab] = useState<Tab>("studio");
  const [category, setCategory] = useState<Category>("hair");
  const [config, setConfig] = useState<AvatarConfig>(defaultAvatarConfig);
  const [history, setHistory] = useState<AvatarConfig[]>([]);
  const [future, setFuture] = useState<AvatarConfig[]>([]);
  const [presetName, setPresetName] = useState("");
  const [presetTagline, setPresetTagline] = useState("");
  const [presetDialog, setPresetDialog] = useState(false);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [loaded, setLoaded] = useState(false);

  const avatarQuery = useQuery({
    queryKey: ["avatar", accessToken],
    queryFn: () => getAvatar(accessToken!),
    enabled: Boolean(accessToken),
  });

  useEffect(() => {
    if (avatarQuery.data && !loaded) {
      setConfig(avatarQuery.data.config);
      setLoaded(true);
    }
  }, [avatarQuery.data, loaded]);

  const saved = avatarQuery.data?.config;
  const dirty = useMemo(() => JSON.stringify(saved ?? defaultAvatarConfig) !== JSON.stringify(config), [saved, config]);

  const update = (patch: Partial<AvatarConfig>) => {
    setHistory((stack) => [...stack.slice(-30), config]);
    setFuture([]);
    setConfig((current) => ({ ...current, ...patch }));
  };
  const undo = () => {
    const previous = history[history.length - 1];
    if (!previous) return;
    setHistory((stack) => stack.slice(0, -1));
    setFuture((stack) => [config, ...stack]);
    setConfig(previous);
  };
  const redo = () => {
    const next = future[0];
    if (!next) return;
    setFuture((stack) => stack.slice(1));
    setHistory((stack) => [...stack, config]);
    setConfig(next);
  };

  const saveMutation = useMutation({
    mutationFn: () => saveAvatar(accessToken!, csrfToken!, config),
    onSuccess: async () => {
      setNotice({ tone: "ok", text: "Avatar saved. It now shows on your profile." });
      await queryClient.invalidateQueries({ queryKey: ["avatar"] });
      await queryClient.invalidateQueries({ queryKey: ["profile-summary"] });
    },
    onError: (error) => setNotice({ tone: "error", text: errorText(error) }),
  });
  const presetMutation = useMutation({
    mutationFn: () => createAvatarPreset(accessToken!, csrfToken!, { name: presetName.trim(), tagline: presetTagline.trim() || undefined, config }),
    onSuccess: async () => {
      setPresetDialog(false);
      setPresetName("");
      setPresetTagline("");
      setNotice({ tone: "ok", text: "Preset saved to your collection." });
      await queryClient.invalidateQueries({ queryKey: ["avatar"] });
    },
    onError: (error) => setNotice({ tone: "error", text: errorText(error) }),
  });
  const applyMutation = useMutation({
    mutationFn: (presetId: string) => applyAvatarPreset(accessToken!, csrfToken!, presetId),
    onSuccess: async (result) => {
      setConfig(result.config);
      setHistory([]);
      setFuture([]);
      setNotice({ tone: "ok", text: "Preset applied." });
      await queryClient.invalidateQueries({ queryKey: ["avatar"] });
      await queryClient.invalidateQueries({ queryKey: ["profile-summary"] });
    },
    onError: (error) => setNotice({ tone: "error", text: errorText(error) }),
  });
  const deletePresetMutation = useMutation({
    mutationFn: (presetId: string) => deleteAvatarPreset(accessToken!, csrfToken!, presetId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["avatar"] }),
    onError: (error) => setNotice({ tone: "error", text: errorText(error) }),
  });

  const presets = avatarQuery.data?.presets ?? [];
  const maxPresets = avatarQuery.data?.maxPresets ?? 10;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="nf-heading text-xl font-bold text-white">Avatar Studio</h1>
          <p className="text-xs text-slate-400">Create. Customize. Be you.</p>
        </div>
        <div className="flex gap-1 rounded-xl border border-white/5 bg-[#0d1119] p-1">
          {([
            { id: "studio", label: "Studio" },
            { id: "collection", label: "Collection" },
            { id: "animations", label: "Animations" },
          ] as Array<{ id: Tab; label: string }>).map((entry) => (
            <button key={entry.id} type="button" onClick={() => setTab(entry.id)} className={`rounded-lg px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${tab === entry.id ? "bg-amber-400 text-slate-950" : "text-slate-400 hover:text-white"}`}>
              {entry.label}
            </button>
          ))}
          <Link href="/app/wardrobe" className="rounded-lg px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 transition hover:text-white">Wardrobe</Link>
        </div>
      </div>

      {notice ? (
        <div className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs ${notice.tone === "ok" ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100" : "border-rose-400/30 bg-rose-500/10 text-rose-100"}`}>
          {notice.text}
          <button type="button" onClick={() => setNotice(null)} title="Dismiss"><X className="h-3.5 w-3.5" /></button>
        </div>
      ) : null}

      {tab === "studio" ? (
        <div className="grid gap-4 lg:grid-cols-[88px_minmax(0,1fr)_320px]">
          {/* Category rail */}
          <div className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
            {categories.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setCategory(entry.id)}
                className={`flex min-w-[72px] flex-col items-center gap-1 rounded-xl border px-2 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] transition ${
                  category === entry.id ? "border-amber-400 bg-amber-500/10 text-amber-100" : "border-white/5 bg-[#0d1119] text-slate-400 hover:border-white/20 hover:text-white"
                }`}
              >
                <entry.icon className="h-4 w-4" />
                {entry.label}
              </button>
            ))}
          </div>

          {/* Preview */}
          <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-[#0d1119]">
            <div className="flex items-center justify-center p-4">
              {avatarQuery.isLoading ? (
                <div className="flex h-[480px] items-center justify-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : (
                <AvatarRenderer config={config} size={300} className="max-h-[520px] w-auto" />
              )}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2 border-t border-white/5 p-3">
              <button type="button" onClick={undo} disabled={!history.length} className={ghostBtn} title="Undo"><Undo2 className="h-3.5 w-3.5" /> Undo</button>
              <button type="button" onClick={redo} disabled={!future.length} className={ghostBtn} title="Redo"><Redo2 className="h-3.5 w-3.5" /> Redo</button>
              <button type="button" onClick={() => update(randomConfig())} className={ghostBtn}><Dices className="h-3.5 w-3.5" /> Randomize</button>
              <button type="button" onClick={() => saveMutation.mutate()} disabled={!dirty || saveMutation.isPending} className={goldBtn}>
                {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : dirty ? <Save className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />} {dirty ? "Save avatar" : "Saved"}
              </button>
            </div>
          </div>

          {/* Controls */}
          <div className={`${panel} space-y-5`}>
            {category === "body" ? (
              <>
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Build</p>
                  <div className="grid grid-cols-3 gap-2">
                    {(["slim", "athletic", "broad"] as const).map((body) => (
                      <button key={body} type="button" onClick={() => update({ body })} className={`rounded-lg border px-2 py-2 text-[11px] font-semibold capitalize ${config.body === body ? "border-amber-400 bg-amber-500/10 text-amber-100" : "border-white/10 bg-[#11151e] text-slate-300"}`}>{body}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Skin tone</p>
                  <Swatches colors={skinTones} value={config.skin} onPick={(skin) => update({ skin })} />
                </div>
              </>
            ) : null}

            {category === "hair" ? (
              <>
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Hair</p>
                  <Options options={hairStyles} value={config.hair} onPick={(hair) => update({ hair })} />
                </div>
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Color</p>
                  <Swatches colors={hairColors} value={config.hairColor} onPick={(hairColor) => update({ hairColor })} />
                </div>
                <div>
                  <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                    <span>Length</span>
                    <span className="text-amber-300">{config.hairLength}</span>
                  </div>
                  <input type="range" min={0} max={100} value={config.hairLength} onChange={(event) => setConfig((current) => ({ ...current, hairLength: Number(event.target.value) }))} onMouseUp={() => setHistory((stack) => [...stack.slice(-30), config])} className="w-full accent-amber-400" />
                </div>
              </>
            ) : null}

            {category === "face" ? (
              <>
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Expression</p>
                  <Options options={faces} value={config.face} onPick={(face) => update({ face })} />
                </div>
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Accent color</p>
                  <Swatches colors={["#e6b325", "#22d3ee", "#f472b6", "#a855f7", "#22c55e", "#ef4444", "#f8fafc"]} value={config.accent} onPick={(accent) => update({ accent })} />
                </div>
              </>
            ) : null}

            {category === "eyes" ? (
              <>
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Eyes</p>
                  <Options options={eyeStyles} value={config.eyes} onPick={(eyes) => update({ eyes })} />
                </div>
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Eye color</p>
                  <Swatches colors={eyeColors} value={config.eyeColor} onPick={(eyeColor) => update({ eyeColor })} />
                </div>
              </>
            ) : null}

            {category === "outfit" ? (
              <>
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Top</p>
                  <Swatches colors={outfitColors} value={config.topColor} onPick={(topColor) => update({ topColor })} />
                </div>
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Bottom</p>
                  <Swatches colors={outfitColors} value={config.bottomColor} onPick={(bottomColor) => update({ bottomColor })} />
                </div>
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Shoes</p>
                  <Swatches colors={outfitColors} value={config.shoeColor} onPick={(shoeColor) => update({ shoeColor })} />
                </div>
                <p className="text-[11px] text-slate-500">Owned cosmetics from the <Link href="/app/wardrobe" className="text-amber-300">Wardrobe</Link> apply their colors here when equipped.</p>
              </>
            ) : null}

            {category === "accessories" ? (
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Accessory</p>
                <Options options={accessories} value={config.accessory} onPick={(accessory) => update({ accessory })} />
              </div>
            ) : null}

            {category === "background" ? (
              <div>
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Scene</p>
                <Options options={backgrounds} value={config.background} onPick={(background) => update({ background })} />
              </div>
            ) : null}

            <div className="border-t border-white/5 pt-4">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Saved avatars ({presets.length}/{maxPresets})</p>
                <button type="button" onClick={() => setPresetDialog(true)} disabled={presets.length >= maxPresets} className="text-[11px] uppercase tracking-[0.16em] text-amber-300 hover:text-amber-200 disabled:opacity-50">Save as new</button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {presets.slice(0, 6).map((preset) => (
                  <button key={preset.id} type="button" onClick={() => applyMutation.mutate(preset.id)} className="overflow-hidden rounded-lg border border-white/5 bg-[#11151e] text-left transition hover:border-amber-400/50" title={`Apply ${preset.name}`}>
                    <div className="flex h-16 items-end justify-center overflow-hidden"><AvatarRenderer config={preset.config} size={64} /></div>
                    <p className="truncate px-1.5 py-1 text-[10px] font-semibold text-white">{preset.name}</p>
                  </button>
                ))}
                {!presets.length ? <p className="col-span-3 text-[11px] text-slate-500">Nothing saved yet.</p> : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "collection" ? (
        <div className={panel}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="nf-heading text-[13px] font-bold uppercase tracking-[0.18em] text-white">Saved Avatars ({presets.length}/{maxPresets})</h2>
            <button type="button" onClick={() => setPresetDialog(true)} disabled={presets.length >= maxPresets} className={goldBtn}><Save className="h-3.5 w-3.5" /> Save current</button>
          </div>
          {presets.length ? (
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
              {presets.map((preset) => (
                <div key={preset.id} className="overflow-hidden rounded-xl border border-white/5 bg-[#11151e]">
                  <div className="flex h-40 items-end justify-center overflow-hidden"><AvatarRenderer config={preset.config} size={120} /></div>
                  <div className="p-2.5">
                    <p className="truncate text-sm font-semibold text-white">{preset.name}</p>
                    <p className="truncate text-[11px] text-slate-500">{preset.tagline || new Date(preset.createdAt).toLocaleDateString()}</p>
                    <div className="mt-2 flex gap-1.5">
                      <button type="button" onClick={() => { setTab("studio"); applyMutation.mutate(preset.id); }} className={`${goldBtn} flex-1 justify-center px-2`}>Use</button>
                      <button type="button" onClick={() => window.confirm(`Delete "${preset.name}"?`) && deletePresetMutation.mutate(preset.id)} className="rounded-lg border border-white/10 px-2 text-rose-300 hover:border-rose-400/50" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Save looks from the Studio and they will show here, and on your profile.</p>
          )}
        </div>
      ) : null}

      {tab === "animations" ? (
        <div className={panel}>
          <h2 className="nf-heading mb-2 text-[13px] font-bold uppercase tracking-[0.18em] text-white">Emotes</h2>
          <p className="text-sm text-slate-400">Emotes you own in the <Link href="/app/wardrobe" className="text-amber-300">Wardrobe</Link> play in voice rooms and on your profile. Animated playback lands with the next studio update.</p>
        </div>
      ) : null}

      {presetDialog ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setPresetDialog(false)} />
          <div className="relative w-full max-w-sm rounded-2xl border border-amber-500/25 bg-[#0d1119] p-5">
            <h3 className="nf-heading mb-3 text-base font-bold text-white">Save avatar preset</h3>
            <div className="space-y-3">
              <input value={presetName} onChange={(event) => setPresetName(event.target.value)} maxLength={40} placeholder="Name (e.g. Ranked)" className="h-10 w-full rounded-lg border border-white/10 bg-[#11151e] px-3 text-sm text-slate-100 outline-none focus:border-amber-400/60" />
              <input value={presetTagline} onChange={(event) => setPresetTagline(event.target.value)} maxLength={60} placeholder="Tagline (optional)" className="h-10 w-full rounded-lg border border-white/10 bg-[#11151e] px-3 text-sm text-slate-100 outline-none focus:border-amber-400/60" />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setPresetDialog(false)} className={ghostBtn}>Cancel</button>
                <button type="button" onClick={() => presetMutation.mutate()} disabled={!presetName.trim() || presetMutation.isPending} className={goldBtn}>
                  {presetMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
