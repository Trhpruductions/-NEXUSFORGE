"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { defaultAvatarConfig } from "@/components/avatar/avatar-renderer";
import { createAvatarPreset, createUploadPresign, getApiErrorMessage, updateAvatarPreset, type AvatarConfig } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import {
  ACCESSORIES,
  BODY_TYPES,
  BOTTOMS,
  DEFAULT_DESIGN,
  EYE_STYLES,
  HAIR_STYLES,
  LABELS,
  MATERIAL_STYLES,
  PALETTE,
  SHOES,
  SKIN_TONES,
  TOPS,
  type AvatarDesign,
} from "@/components/avatar3d/design";
import type { CaptureFn, ViewerPose, ViewerShot } from "@/components/avatar3d/avatar-viewer";

const POSE_CHOICES: Array<{ id: ViewerPose; label: string }> = [
  { id: "relaxed", label: "Relaxed" },
  { id: "victory", label: "Victory" },
  { id: "showcase", label: "Showcase" },
];
const SHOT_CHOICES: Array<{ id: ViewerShot; label: string }> = [
  { id: "full", label: "Full body" },
  { id: "portrait", label: "Portrait" },
  { id: "side", label: "Side" },
];
const RENDER_BACKGROUNDS: Array<{ id: "studio" | "night" | "transparent"; label: string }> = [
  { id: "studio", label: "Studio" },
  { id: "night", label: "Night" },
  { id: "transparent", label: "Clear PNG" },
];
const RENDER_SIZES: Record<ViewerShot, { width: number; height: number }> = {
  full: { width: 900, height: 1200 },
  portrait: { width: 800, height: 800 },
  side: { width: 900, height: 1200 },
};

// The 3D viewer needs WebGL, so it loads only in the browser.
const AvatarViewer = dynamic(() => import("@/components/avatar3d/avatar-viewer").then((m) => m.AvatarViewer), {
  ssr: false,
  loading: () => <div className="flex h-full items-center justify-center text-xs uppercase tracking-[0.2em] text-slate-400">Loading 3D…</div>,
});

type Section = "body" | "skin" | "hair" | "eyes" | "tops" | "bottoms" | "shoes" | "accessories" | "material";

const SECTIONS: Array<{ id: Section; label: string }> = [
  { id: "body", label: "Body" },
  { id: "skin", label: "Skin" },
  { id: "hair", label: "Hair" },
  { id: "eyes", label: "Eyes" },
  { id: "tops", label: "Tops" },
  { id: "bottoms", label: "Bottoms" },
  { id: "shoes", label: "Shoes" },
  { id: "accessories", label: "Accessories" },
  { id: "material", label: "Material" },
];

const chip = (active: boolean) =>
  `rounded-lg border px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.14em] transition ${active ? "border-amber-400 bg-amber-500/10 text-amber-100" : "border-white/10 bg-[#11151e] text-slate-300 hover:border-white/30"}`;

function Swatches({ label, colours, value, onPick }: { label: string; colours: readonly string[]; value: string; onPick: (hex: string) => void }) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <div className="flex flex-wrap gap-2">
        {colours.map((hex) => (
          <button
            key={hex}
            type="button"
            onClick={() => onPick(hex)}
            aria-label={`${label} ${hex}`}
            aria-pressed={value.toLowerCase() === hex.toLowerCase()}
            style={{ backgroundColor: hex }}
            className={`h-8 w-8 rounded-full border-2 transition ${value.toLowerCase() === hex.toLowerCase() ? "scale-110 border-amber-300" : "border-white/10 hover:border-white/40"}`}
          />
        ))}
        <label className="relative h-8 w-8 cursor-pointer overflow-hidden rounded-full border-2 border-dashed border-white/25" title="Custom colour">
          <span className="sr-only">Custom {label.toLowerCase()}</span>
          <input type="color" value={value} onChange={(event) => onPick(event.target.value)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0" aria-label={`Custom ${label.toLowerCase()}`} />
          <span className="flex h-full w-full items-center justify-center text-[11px] text-slate-400">+</span>
        </label>
      </div>
    </div>
  );
}

function Chips<T extends string>({ label, options, value, onPick }: { label: string; options: readonly T[]; value: T; onPick: (value: T) => void }) {
  return (
    <div>
      <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {options.map((option) => (
          <button key={option} type="button" aria-pressed={value === option} onClick={() => onPick(option)} className={chip(value === option)}>
            {LABELS[option] ?? option}
          </button>
        ))}
      </div>
    </div>
  );
}

export function AvatarBuilder({ initial = DEFAULT_DESIGN, presetId = null, initialName = "My avatar" }: { initial?: AvatarDesign; presetId?: string | null; initialName?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((state) => state.accessToken);
  const csrfToken = useAuthStore((state) => state.csrfToken);
  const [name, setName] = useState(initialName);
  const [design, setDesign] = useState<AvatarDesign>(initial);
  const [savedJson, setSavedJson] = useState<string | null>(presetId ? JSON.stringify(initial) : null);
  const [notice, setNotice] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const dirty = presetId ? savedJson !== JSON.stringify(design) : true;
  const [section, setSection] = useState<Section>("hair");
  const [spin, setSpin] = useState(true);
  const [background, setBackground] = useState<"studio" | "night" | "transparent">("studio");
  const captureRef = useRef<CaptureFn | null>(null);
  const [pose, setPose] = useState<ViewerPose>("relaxed");
  const [shot, setShot] = useState<ViewerShot>("full");
  const [renderBackground, setRenderBackground] = useState<"studio" | "night" | "transparent">("studio");
  const [renderNote, setRenderNote] = useState<string | null>(null);
  const [pictureBusy, setPictureBusy] = useState(false);
  // A prepared PNG waits for the Save PNG link. It is kept only while the view it was rendered from is unchanged.
  const [pngFile, setPngFile] = useState<{ url: string; name: string } | null>(null);
  const pngUrlRef = useRef<string | null>(null);
  useEffect(() => {
    if (pngUrlRef.current) URL.revokeObjectURL(pngUrlRef.current);
    pngUrlRef.current = null;
    setPngFile(null);
  }, [shot, pose, renderBackground, design]);
  useEffect(
    () => () => {
      if (pngUrlRef.current) URL.revokeObjectURL(pngUrlRef.current);
    },
    []
  );

  const update = useCallback((patch: Partial<AvatarDesign>) => setDesign((current) => ({ ...current, ...patch })), []);

  // The stored avatar keeps the legacy fields too (set to their defaults) so older screens still read it.
  const configToSave = (): AvatarConfig => ({ ...defaultAvatarConfig, design });
  const finishSave = async (id: string, created: boolean, text: string) => {
    setSavedJson(JSON.stringify(design));
    setNotice({ tone: "ok", text });
    await queryClient.invalidateQueries({ queryKey: ["avatar"] });
    if (created) router.replace(`/app/avatars/${id}`);
  };
  const save = useMutation({
    mutationFn: async () => {
      if (!accessToken || !csrfToken) throw new Error("Sign in to save your avatar.");
      const label = name.trim() || "My avatar";
      if (presetId) {
        const updated = await updateAvatarPreset(accessToken, csrfToken, presetId, { name: label, config: configToSave() });
        return { id: updated.preset.id, created: false };
      }
      const created = await createAvatarPreset(accessToken, csrfToken, { name: label, config: configToSave() });
      return { id: created.preset.id, created: true };
    },
    onSuccess: (result) => finishSave(result.id, result.created, "Avatar saved to your account."),
    onError: (error) => setNotice({ tone: "error", text: getApiErrorMessage(error) }),
  });
  const saveCopy = useMutation({
    mutationFn: async () => {
      if (!accessToken || !csrfToken) throw new Error("Sign in to save your avatar.");
      const copy = await createAvatarPreset(accessToken, csrfToken, { name: `${(name.trim() || "My avatar").slice(0, 32)} copy`, config: configToSave() });
      return { id: copy.preset.id };
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["avatar"] });
      router.push(`/app/avatars/${result.id}`);
    },
    onError: (error) => setNotice({ tone: "error", text: getApiErrorMessage(error) }),
  });
  const toggleAccessory = (id: (typeof ACCESSORIES)[number]) =>
    setDesign((current) => ({
      ...current,
      accessories: current.accessories.includes(id) ? current.accessories.filter((a) => a !== id) : [...current.accessories, id],
    }));

  /** Renders the figure to a PNG blob, at the chosen shot, pose and background. */
  const renderPng = async (target: ViewerShot, background: "studio" | "night" | "transparent") => {
    const capture = captureRef.current;
    if (!capture) throw new Error("The 3D view is still loading. Try again in a moment.");
    return capture({ shot: target, pose, background, ...RENDER_SIZES[target] });
  };
  /**
   * Renders the picture for the Save PNG link. The download itself is a plain link click, so the browser
   * always treats it as the person's own download; a script click after a slow render can be blocked.
   */
  const preparePng = async () => {
    setRenderNote("Rendering…");
    try {
      const blob = await renderPng(shot, renderBackground);
      const url = URL.createObjectURL(blob);
      if (pngUrlRef.current) URL.revokeObjectURL(pngUrlRef.current);
      pngUrlRef.current = url;
      const slug = (name.trim() || "avatar").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "avatar";
      setPngFile({ url, name: `${slug}-${shot}.png` });
      setRenderNote("Ready. Press Save PNG to download it.");
    } catch (error) {
      setRenderNote(error instanceof Error ? error.message : "The picture could not be created.");
    }
  };
  /** Uploads a portrait of the saved look and stores it on the avatar, for the gallery and profile. */
  const useAsPicture = async () => {
    if (!presetId) {
      setRenderNote("Save the avatar first, then use it as your profile picture.");
      return;
    }
    if (dirty) {
      setRenderNote("Save changes first, so the picture matches the saved look.");
      return;
    }
    if (!accessToken || !csrfToken) {
      setRenderNote("Sign in to save your profile picture.");
      return;
    }
    setPictureBusy(true);
    setRenderNote("Creating your profile picture…");
    try {
      const blob = await renderPng("portrait", renderBackground === "transparent" ? "studio" : renderBackground);
      const presign = await createUploadPresign(accessToken, csrfToken, { filename: "avatar-portrait.png", contentType: "image/png", size: blob.size });
      const put = await fetch(presign.uploadUrl, { method: "PUT", headers: { "Content-Type": "image/png" }, body: blob });
      if (!put.ok) throw new Error("The picture could not be uploaded. Try again.");
      await updateAvatarPreset(accessToken, csrfToken, presetId, { previewUrl: presign.fileUrl });
      await queryClient.invalidateQueries({ queryKey: ["avatar"] });
      setRenderNote("Profile picture saved. It now shows in your gallery.");
    } catch (error) {
      setRenderNote(error instanceof Error ? error.message : getApiErrorMessage(error));
    } finally {
      setPictureBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-[220px] flex-1 text-xs text-slate-300">
          <span className="mb-1 block text-[10px] uppercase tracking-[0.18em] text-slate-500">Avatar name</span>
          <input value={name} maxLength={40} onChange={(event) => setName(event.target.value)} className="w-full rounded-lg border border-white/10 bg-[#11151e] px-3 py-2 text-sm text-white outline-none focus:border-amber-400/60" />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          {presetId ? (
            <button type="button" onClick={() => saveCopy.mutate()} disabled={saveCopy.isPending} className={`${chip(false)} disabled:opacity-50`}>Save as new</button>
          ) : null}
          <button type="button" onClick={() => save.mutate()} disabled={!dirty || save.isPending} className="rounded-lg bg-amber-400 px-4 py-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-950 transition hover:bg-amber-300 disabled:opacity-50">
            {save.isPending ? "Saving…" : presetId ? "Save changes" : "Save avatar"}
          </button>
        </div>
        <p role="status" aria-live="polite" className={`w-full text-[11px] ${notice?.tone === "error" ? "text-rose-200" : notice ? "text-emerald-200" : "text-slate-400"}`}>
          {notice ? notice.text : dirty ? "Unsaved changes" : "All changes saved"}
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[180px_minmax(0,1fr)_340px]">
      {/* Categories: a row on phones, a column on desktop. */}
      <nav aria-label="Avatar categories" className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible">
        {SECTIONS.map((entry) => (
          <button key={entry.id} type="button" aria-pressed={section === entry.id} onClick={() => setSection(entry.id)} className={`shrink-0 whitespace-nowrap rounded-xl border px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-[0.16em] ${section === entry.id ? "border-amber-400 bg-amber-500/10 text-amber-100" : "border-white/10 bg-[#0d1119] text-slate-300 hover:border-white/30"}`}>
            {entry.label}
          </button>
        ))}
      </nav>

      {/* The figure. */}
      <div className="space-y-3">
        <AvatarViewer design={design} autoRotate={spin} background={background} pose={pose} captureRef={captureRef} className="h-[52vh] min-h-[340px] w-full lg:h-[64vh]" />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={spin} onClick={() => setSpin((v) => !v)} className={chip(spin)}>Auto turn</button>
            {(["studio", "night", "transparent"] as const).map((id) => (
              <button key={id} type="button" aria-pressed={background === id} onClick={() => setBackground(id)} className={chip(background === id)}>
                {id === "transparent" ? "Clear" : id === "night" ? "Night" : "Studio"}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setDesign(DEFAULT_DESIGN)} className={`${chip(false)} inline-flex items-center gap-1.5`}>
            <RotateCcw className="h-3.5 w-3.5" /> Reset look
          </button>
        </div>
        <p className="text-[11px] text-slate-500">Drag to turn. Scroll or pinch to zoom.</p>
        <div className="vx-panel space-y-3 rounded-2xl p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Pose</p>
              <div className="flex flex-wrap gap-2">
                {POSE_CHOICES.map((choice) => (
                  <button key={choice.id} type="button" aria-pressed={pose === choice.id} onClick={() => setPose(choice.id)} className={chip(pose === choice.id)}>{choice.label}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Camera</p>
              <div className="flex flex-wrap gap-2">
                {SHOT_CHOICES.map((choice) => (
                  <button key={choice.id} type="button" aria-pressed={shot === choice.id} onClick={() => setShot(choice.id)} className={chip(shot === choice.id)}>{choice.label}</button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Render background</p>
              <div className="flex flex-wrap gap-2">
                {RENDER_BACKGROUNDS.map((choice) => (
                  <button key={choice.id} type="button" aria-pressed={renderBackground === choice.id} onClick={() => setRenderBackground(choice.id)} className={chip(renderBackground === choice.id)}>{choice.label}</button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => void preparePng()} className={chip(false)}>Prepare PNG</button>
            {pngFile ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pngFile.url} alt="Preview of the prepared PNG" className="h-16 w-auto rounded-md border border-white/10 bg-[#0b1220] object-contain" />
                <a href={pngFile.url} download={pngFile.name} className={chip(true)}>Save PNG</a>
              </>
            ) : null}
            <button type="button" onClick={() => void useAsPicture()} disabled={pictureBusy || !presetId} className={`${chip(false)} disabled:opacity-40`}>
              {pictureBusy ? "Working…" : "Use as profile picture"}
            </button>
            {renderNote ? <p role="status" aria-live="polite" className="text-[11px] text-slate-300">{renderNote}</p> : null}
          </div>
        </div>
      </div>

      {/* Controls for the chosen category. */}
      <div className="vx-panel space-y-5 rounded-2xl p-4">
        {section === "body" ? (
          <Chips label="Body size" options={BODY_TYPES} value={design.body} onPick={(body) => update({ body })} />
        ) : null}
        {section === "skin" ? <Swatches label="Skin tone" colours={SKIN_TONES} value={design.skin} onPick={(skin) => update({ skin })} /> : null}
        {section === "hair" ? (
          <>
            <Chips label="Hair style" options={HAIR_STYLES} value={design.hair} onPick={(hair) => update({ hair })} />
            <Swatches label="Hair colour" colours={PALETTE} value={design.hairColor} onPick={(hairColor) => update({ hairColor })} />
          </>
        ) : null}
        {section === "eyes" ? (
          <>
            <Chips label="Eye style" options={EYE_STYLES} value={design.eyeStyle} onPick={(eyeStyle) => update({ eyeStyle })} />
            <Swatches label="Eye colour" colours={PALETTE} value={design.eyeColor} onPick={(eyeColor) => update({ eyeColor })} />
          </>
        ) : null}
        {section === "tops" ? (
          <>
            <Chips label="Top" options={TOPS} value={design.top} onPick={(top) => update({ top })} />
            <Swatches label="Top colour" colours={PALETTE} value={design.topColor} onPick={(topColor) => update({ topColor })} />
          </>
        ) : null}
        {section === "bottoms" ? (
          <>
            <Chips label="Bottoms" options={BOTTOMS} value={design.bottom} onPick={(bottom) => update({ bottom })} />
            <Swatches label="Bottoms colour" colours={PALETTE} value={design.bottomColor} onPick={(bottomColor) => update({ bottomColor })} />
          </>
        ) : null}
        {section === "shoes" ? (
          <>
            <Chips label="Shoes" options={SHOES} value={design.shoes} onPick={(shoes) => update({ shoes })} />
            <Swatches label="Shoe colour" colours={PALETTE} value={design.shoeColor} onPick={(shoeColor) => update({ shoeColor })} />
          </>
        ) : null}
        {section === "accessories" ? (
          <>
            <div>
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Accessories (choose any)</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {ACCESSORIES.map((id) => (
                  <button key={id} type="button" aria-pressed={design.accessories.includes(id)} onClick={() => toggleAccessory(id)} className={chip(design.accessories.includes(id))}>
                    {LABELS[id]}
                  </button>
                ))}
              </div>
            </div>
            <Swatches label="Accent colour" colours={PALETTE} value={design.accent} onPick={(accent) => update({ accent })} />
          </>
        ) : null}
        {section === "material" ? (
          <>
            <Chips label="Finish" options={MATERIAL_STYLES} value={design.material} onPick={(material) => update({ material })} />
            <p className="text-[11px] leading-relaxed text-slate-500">The finish applies to tops, bottoms and shoes: matte is dull, satin soft, gloss shiny and metallic reflective.</p>
          </>
        ) : null}
      </div>
      </div>
    </div>
  );
}
