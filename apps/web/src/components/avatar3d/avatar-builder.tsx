"use client";

import dynamic from "next/dynamic";
import { useCallback, useState } from "react";
import { RotateCcw } from "lucide-react";
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

export function AvatarBuilder({ initial = DEFAULT_DESIGN }: { initial?: AvatarDesign }) {
  const [design, setDesign] = useState<AvatarDesign>(initial);
  const [section, setSection] = useState<Section>("hair");
  const [spin, setSpin] = useState(true);
  const [background, setBackground] = useState<"studio" | "night" | "transparent">("studio");

  const update = useCallback((patch: Partial<AvatarDesign>) => setDesign((current) => ({ ...current, ...patch })), []);
  const toggleAccessory = (id: (typeof ACCESSORIES)[number]) =>
    setDesign((current) => ({
      ...current,
      accessories: current.accessories.includes(id) ? current.accessories.filter((a) => a !== id) : [...current.accessories, id],
    }));

  return (
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
        <AvatarViewer design={design} autoRotate={spin} background={background} className="h-[52vh] min-h-[340px] w-full lg:h-[64vh]" />
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
  );
}
