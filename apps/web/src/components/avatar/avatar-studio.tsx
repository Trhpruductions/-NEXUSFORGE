"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Check, CircleUser, Dices, Eye, Footprints, Glasses, Loader2, Mountain, Play, Redo2, RotateCcw, Save, Scissors, Shirt, Smile, Sparkles, Trash2, Undo2, User, X, ZoomIn } from "lucide-react";
import { applyAvatarPreset, createAvatarPreset, deleteAvatarPreset, getAvatar, getCosmeticInventory, saveAvatar, setLoadoutSlot, type AvatarConfig, type CosmeticItem } from "@/lib/api";
import { CosmeticArt } from "@/components/wardrobe/cosmetic-art";
import { AvatarRenderer, defaultAvatarConfig } from "@/components/avatar/avatar-renderer";
import { useAuthStore } from "@/store/auth-store";

type Category = "body" | "head" | "hair" | "face" | "eyes" | "shirts" | "pants" | "shoes" | "accessories" | "background";
type Tab = "studio" | "collection" | "animations";

// Category column from the design reference (Avatar Studio panel).
const categories: Array<{ id: Category; label: string; icon: typeof User }> = [
  { id: "body", label: "Body", icon: User },
  { id: "head", label: "Head", icon: CircleUser },
  { id: "hair", label: "Hair", icon: Scissors },
  { id: "face", label: "Face", icon: Smile },
  { id: "eyes", label: "Eyes", icon: Eye },
  { id: "shirts", label: "Shirts", icon: Shirt },
  { id: "pants", label: "Pants", icon: Shirt },
  { id: "shoes", label: "Shoes", icon: Footprints },
  { id: "accessories", label: "Accessories", icon: Glasses },
  { id: "background", label: "Scene", icon: Mountain },
];

/** Emote playback: each owned emote maps to a keyframe animation on the avatar (see globals.css). */
function emoteAnimation(key: string) {
  if (key.includes("salute") || key.includes("gg")) return "nf-emote-salute";
  if (key.includes("flex")) return "nf-emote-flex";
  if (key.includes("drop")) return "nf-emote-drop";
  return "nf-emote-bounce";
}

const hairLabels: Record<AvatarConfig["hair"], string> = { spiky: "Spiky", fade: "Fade", curls: "Curls", long: "Long", bun: "Bun", buzz: "Buzz", mohawk: "Mohawk", none: "None" };
const accessoryLabels: Record<AvatarConfig["accessory"], string> = { none: "None", shades: "Shades", headset: "Headset", mask: "Mask", bandana: "Bandana" };

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

/** Thumbnail grid: each tile previews the current avatar with one option swapped, like the reference. */
function ThumbOptions<T extends string>({
  options,
  value,
  config,
  patch,
  label,
  onPick,
  crop = "head",
}: {
  options: readonly T[];
  value: T;
  config: AvatarConfig;
  patch: (option: T) => Partial<AvatarConfig>;
  label?: (option: T) => string;
  onPick: (value: T) => void;
  crop?: "head" | "body" | "feet";
}) {
  const offset = crop === "head" ? "-mt-1" : crop === "feet" ? "-mt-[58px]" : "-mt-6";
  return (
    <div className="grid grid-cols-4 gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onPick(option)}
          title={label ? label(option) : option}
          className={`overflow-hidden rounded-lg border bg-[#11151e] transition ${value === option ? "border-amber-400 shadow-[0_0_14px_rgba(230,179,37,0.35)]" : "border-white/10 hover:border-white/30"}`}
        >
          <div className="flex h-14 items-start justify-center overflow-hidden">
            <AvatarRenderer config={{ ...config, ...patch(option) }} size={64} showBackground={false} className={offset} />
          </div>
          <p className={`truncate px-1 pb-1 text-center text-[9px] font-semibold uppercase tracking-[0.1em] ${value === option ? "text-amber-200" : "text-slate-400"}`}>{label ? label(option) : option}</p>
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
  const [flipped, setFlipped] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [playing, setPlaying] = useState<CosmeticItem | null>(null);

  const avatarQuery = useQuery({
    queryKey: ["avatar", accessToken],
    queryFn: () => getAvatar(accessToken!),
    enabled: Boolean(accessToken),
  });
  const inventoryQuery = useQuery({
    queryKey: ["cosmetics", "wardrobe", accessToken],
    queryFn: () => getCosmeticInventory(accessToken!),
    enabled: Boolean(accessToken),
  });
  const emotes = useMemo(() => (inventoryQuery.data?.items ?? []).filter((item) => item.slot === "EMOTE"), [inventoryQuery.data]);
  const equippedEmoteId = inventoryQuery.data?.loadout.EMOTE ?? null;
  const equipEmote = useMutation({
    mutationFn: (itemId: string | null) => setLoadoutSlot(accessToken!, csrfToken!, "EMOTE", itemId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["cosmetics"] }),
    onError: (error) => setNotice({ tone: "error", text: errorText(error) }),
  });
  const playEmote = (item: CosmeticItem) => {
    setPlaying(null);
    window.setTimeout(() => setPlaying(item), 20);
    window.setTimeout(() => setPlaying((current) => (current?.id === item.id ? null : current)), 2200);
  };

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
          ] as Array<{ id: Tab; label: string }>).map((entry) => (
            <button key={entry.id} type="button" onClick={() => setTab(entry.id)} className={`rounded-lg px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${tab === entry.id ? "bg-amber-400 text-slate-950" : "text-slate-400 hover:text-white"}`}>
              {entry.label}
            </button>
          ))}
          <Link href="/app/wardrobe" className="rounded-lg px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 transition hover:text-white">Wardrobe</Link>
          <button type="button" onClick={() => setTab("animations")} className={`rounded-lg px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] transition ${tab === "animations" ? "bg-amber-400 text-slate-950" : "text-slate-400 hover:text-white"}`}>
            Animations
          </button>
        </div>
      </div>

      {notice ? (
        <div className={`flex items-center justify-between rounded-xl border px-3 py-2 text-xs ${notice.tone === "ok" ? "border-emerald-400/30 bg-emerald-500/10 text-emerald-100" : "border-rose-400/30 bg-rose-500/10 text-rose-100"}`}>
          {notice.text}
          <button type="button" onClick={() => setNotice(null)} title="Dismiss"><X className="h-3.5 w-3.5" /></button>
        </div>
      ) : null}

      {tab === "studio" ? (
        <div className="grid gap-4 lg:grid-cols-[124px_minmax(0,1fr)_340px]">
          {/* Category column */}
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar lg:flex-col lg:overflow-visible">
            {categories.map((entry) => (
              <button
                key={entry.id}
                type="button"
                onClick={() => setCategory(entry.id)}
                className={`flex min-w-[110px] items-center gap-2 rounded-xl border px-2 py-1.5 text-left text-[9.5px] font-semibold uppercase tracking-[0.08em] transition ${
                  category === entry.id ? "border-amber-400 bg-amber-500/10 text-amber-100" : "border-white/5 bg-[#0d1119] text-slate-400 hover:border-white/20 hover:text-white"
                }`}
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border ${category === entry.id ? "border-amber-400/50 bg-amber-500/10 text-amber-300" : "border-white/10 bg-[#11151e] text-slate-400"}`}>
                  <entry.icon className="h-3.5 w-3.5" />
                </span>
                <span className="truncate">{entry.label}</span>
              </button>
            ))}
          </div>

          {/* Preview */}
          <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-[#0d1119]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_85%,rgba(230,179,37,0.18),transparent_55%)]" />
            <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(230,179,37,0.05)_1px,transparent_1px),linear-gradient(to_bottom,rgba(230,179,37,0.05)_1px,transparent_1px)] bg-[size:32px_32px] opacity-50" />
            <div className="relative flex min-h-[480px] items-center justify-center p-4">
              {avatarQuery.isLoading ? (
                <div className="flex h-[480px] items-center justify-center text-slate-400"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : (
                <div className="transition-transform duration-300" style={{ transform: `${flipped ? "scaleX(-1)" : ""} ${zoomed ? "scale(1.35) translateY(12%)" : ""}` }}>
                  <div className={playing ? emoteAnimation(playing.key) : undefined}>
                    <AvatarRenderer config={config} size={300} className="max-h-[520px] w-auto" />
                  </div>
                </div>
              )}
            </div>
            <div className="relative flex flex-wrap items-center justify-center gap-2 border-t border-white/5 p-3">
              <button type="button" onClick={() => setFlipped((value) => !value)} className={ghostBtn} title="Rotate"><RotateCcw className="h-3.5 w-3.5" /> Rotate</button>
              <button type="button" onClick={() => setZoomed((value) => !value)} className={`${ghostBtn} ${zoomed ? "border-amber-400/60 text-amber-200" : ""}`} title="Zoom"><ZoomIn className="h-3.5 w-3.5" /> Zoom</button>
              <button type="button" onClick={redo} disabled={!future.length} className={ghostBtn} title="Redo"><Redo2 className="h-3.5 w-3.5" /> Redo</button>
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
                      <button key={body} type="button" onClick={() => update({ body })} className={`overflow-hidden rounded-lg border bg-[#11151e] text-[10px] font-semibold uppercase tracking-[0.1em] ${config.body === body ? "border-amber-400 text-amber-100 shadow-[0_0_14px_rgba(230,179,37,0.35)]" : "border-white/10 text-slate-300"}`}>
                        <div className="flex h-20 items-start justify-center overflow-hidden"><AvatarRenderer config={{ ...config, body }} size={56} showBackground={false} className="-mt-1" /></div>
                        <p className="pb-1">{body}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Skin tone</p>
                  <Swatches colors={skinTones} value={config.skin} onPick={(skin) => update({ skin })} />
                </div>
              </>
            ) : null}

            {category === "head" ? (
              <>
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Skin tone</p>
                  <Swatches colors={skinTones} value={config.skin} onPick={(skin) => update({ skin })} />
                </div>
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Expression</p>
                  <ThumbOptions options={faces} value={config.face} config={config} patch={(face) => ({ face })} onPick={(face) => update({ face })} />
                </div>
              </>
            ) : null}

            {category === "hair" ? (
              <>
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Hair</p>
                  <ThumbOptions options={hairStyles} value={config.hair} config={config} patch={(hair) => ({ hair })} label={(hair) => hairLabels[hair]} onPick={(hair) => update({ hair })} />
                </div>
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Color</p>
                  <Swatches colors={hairColors} value={config.hairColor} onPick={(hairColor) => update({ hairColor })} />
                </div>
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Style</p>
                  <select value={config.hair} onChange={(event) => update({ hair: event.target.value as AvatarConfig["hair"] })} className="h-9 w-full rounded-lg border border-white/10 bg-[#11151e] px-3 text-sm text-slate-100 outline-none focus:border-amber-400/60">
                    {hairStyles.map((hair) => <option key={hair} value={hair}>{hairLabels[hair]}</option>)}
                  </select>
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
                  <ThumbOptions options={faces} value={config.face} config={config} patch={(face) => ({ face })} onPick={(face) => update({ face })} />
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
                  <ThumbOptions options={eyeStyles} value={config.eyes} config={config} patch={(eyes) => ({ eyes })} onPick={(eyes) => update({ eyes })} />
                </div>
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Eye color</p>
                  <Swatches colors={eyeColors} value={config.eyeColor} onPick={(eyeColor) => update({ eyeColor })} />
                </div>
              </>
            ) : null}

            {category === "shirts" ? (
              <>
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Shirts</p>
                  <ThumbOptions options={outfitColors} value={config.topColor} config={config} patch={(topColor) => ({ topColor })} label={() => ""} onPick={(topColor) => update({ topColor })} crop="body" />
                </div>
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Custom color</p>
                  <Swatches colors={outfitColors} value={config.topColor} onPick={(topColor) => update({ topColor })} />
                </div>
                <p className="text-[11px] text-slate-500">Owned cosmetics from the <Link href="/app/wardrobe" className="text-amber-300">Wardrobe</Link> apply their colors here when equipped.</p>
              </>
            ) : null}

            {category === "pants" ? (
              <>
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Pants</p>
                  <ThumbOptions options={outfitColors} value={config.bottomColor} config={config} patch={(bottomColor) => ({ bottomColor })} label={() => ""} onPick={(bottomColor) => update({ bottomColor })} crop="feet" />
                </div>
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Custom color</p>
                  <Swatches colors={outfitColors} value={config.bottomColor} onPick={(bottomColor) => update({ bottomColor })} />
                </div>
              </>
            ) : null}

            {category === "shoes" ? (
              <>
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Shoes</p>
                  <ThumbOptions options={outfitColors} value={config.shoeColor} config={config} patch={(shoeColor) => ({ shoeColor })} label={() => ""} onPick={(shoeColor) => update({ shoeColor })} crop="feet" />
                </div>
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Custom color</p>
                  <Swatches colors={outfitColors} value={config.shoeColor} onPick={(shoeColor) => update({ shoeColor })} />
                </div>
              </>
            ) : null}

            {category === "accessories" ? (
              <>
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Accessories</p>
                  <ThumbOptions options={accessories} value={config.accessory} config={config} patch={(accessory) => ({ accessory })} label={(accessory) => accessoryLabels[accessory]} onPick={(accessory) => update({ accessory })} />
                </div>
                <div>
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Accent color</p>
                  <Swatches colors={["#e6b325", "#22d3ee", "#f472b6", "#a855f7", "#22c55e", "#ef4444", "#f8fafc"]} value={config.accent} onPick={(accent) => update({ accent })} />
                </div>
              </>
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
                <button type="button" onClick={() => setTab("collection")} className={`${ghostBtn} px-2.5 py-1`}>Manage</button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {presets.slice(0, 6).map((preset) => (
                  <button key={preset.id} type="button" onClick={() => applyMutation.mutate(preset.id)} className="overflow-hidden rounded-lg border border-white/5 bg-[#11151e] text-left transition hover:border-amber-400/50" title={`Apply ${preset.name}`}>
                    <div className="flex h-20 items-start justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_30%,rgba(230,179,37,0.15),transparent_60%)]"><AvatarRenderer config={preset.config} size={80} showBackground={false} className="-mt-1" /></div>
                    <div className="px-2 py-1.5">
                      <p className="truncate text-[11px] font-semibold text-white">{preset.name}</p>
                      <p className="truncate text-[10px] text-amber-200/70">{preset.tagline || new Date(preset.createdAt).toLocaleDateString()}</p>
                    </div>
                  </button>
                ))}
                {!presets.length ? <p className="col-span-2 text-[11px] text-slate-500">Nothing saved yet. Use Save avatar below, then Save as new.</p> : null}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 border-t border-white/5 pt-4">
              <button type="button" onClick={() => update(randomConfig())} className={`${ghostBtn} justify-center`}><Dices className="h-3.5 w-3.5" /> Randomize</button>
              <button type="button" onClick={undo} disabled={!history.length} className={`${ghostBtn} justify-center`} title="Undo"><Undo2 className="h-3.5 w-3.5" /> Undo</button>
              <button type="button" onClick={redo} disabled={!future.length} className={`${ghostBtn} justify-center`} title="Redo"><Redo2 className="h-3.5 w-3.5" /> Redo</button>
              <button type="button" onClick={() => saveMutation.mutate()} disabled={!dirty || saveMutation.isPending} className={`${goldBtn} justify-center`}>
                {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : dirty ? <Save className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />} {dirty ? "Save avatar" : "Saved"}
              </button>
              <button type="button" onClick={() => setPresetDialog(true)} disabled={presets.length >= maxPresets} className="col-span-2 text-center text-[11px] uppercase tracking-[0.16em] text-amber-300 hover:text-amber-200 disabled:opacity-50">Save as new preset</button>
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
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="relative overflow-hidden rounded-2xl border border-amber-500/20 bg-[#0d1119]">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_85%,rgba(230,179,37,0.18),transparent_55%)]" />
            <div className="relative flex min-h-[420px] items-center justify-center p-4">
              <div className={playing ? emoteAnimation(playing.key) : undefined}>
                <AvatarRenderer config={config} size={260} />
              </div>
            </div>
            <p className="relative border-t border-white/5 p-3 text-center text-xs text-slate-400">{playing ? `Playing ${playing.name}` : "Pick an emote to play it on your avatar."}</p>
          </div>
          <div className={`${panel} space-y-3`}>
            <div className="flex items-center justify-between">
              <h2 className="nf-heading text-[13px] font-bold uppercase tracking-[0.18em] text-white">Emotes ({emotes.length})</h2>
              <Link href="/app/store" className={ghostBtn}><Sparkles className="h-3.5 w-3.5" /> Get more</Link>
            </div>
            {inventoryQuery.isLoading ? <p className="text-sm text-slate-400"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Loading emotes...</p> : null}
            {emotes.length ? (
              <ul className="space-y-2">
                {emotes.map((item) => {
                  const equipped = equippedEmoteId === item.id;
                  return (
                    <li key={item.id} className={`flex items-center gap-3 rounded-xl border bg-[#11151e] p-2 ${equipped ? "border-amber-400/50" : "border-white/5"}`}>
                      <span className="rounded-lg bg-[#0b0e15]"><CosmeticArt item={item} size={48} /></span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-white">{item.name}</p>
                        <p className="truncate text-[11px] text-slate-500">{item.description}</p>
                      </div>
                      <button type="button" onClick={() => playEmote(item)} className={`${ghostBtn} px-2.5`} title="Play"><Play className="h-3.5 w-3.5" /></button>
                      <button type="button" onClick={() => equipEmote.mutate(equipped ? null : item.id)} disabled={equipEmote.isPending} className={equipped ? "rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-2.5 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-200" : `${goldBtn} px-2.5`}>
                        {equipped ? "Profile emote" : "Use"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : inventoryQuery.data ? (
              <p className="rounded-lg border border-white/5 bg-[#11151e] px-3 py-3 text-sm text-slate-500">You do not own any emotes yet. Pick some up in the <Link href="/app/store" className="text-amber-300">Store</Link>.</p>
            ) : null}
            <p className="text-[11px] text-slate-500">Your profile emote plays on your profile card and when you join voice.</p>
          </div>
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
