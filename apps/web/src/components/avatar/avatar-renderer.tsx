"use client";

import { useId } from "react";
import type { AvatarConfig } from "@/lib/api";
import {
  CosmeticAccessoryLayer,
  CosmeticBackLayer,
  CosmeticBackStraps,
  CosmeticBottomLayer,
  CosmeticFaceLayer,
  CosmeticHeadLayer,
  CosmeticShoesLayer,
  CosmeticTopLayer,
  type EquippedCosmetic,
} from "@/components/avatar/cosmetic-layers";

export const defaultAvatarConfig: AvatarConfig = {
  body: "athletic",
  skin: "#d9a577",
  hair: "spiky",
  hairColor: "#22d3ee",
  hairLength: 60,
  eyes: "sharp",
  eyeColor: "#38bdf8",
  face: "focused",
  accessory: "none",
  topColor: "#111318",
  bottomColor: "#1f2937",
  shoeColor: "#2ea4ff",
  accent: "#2ea4ff",
  background: "city",
};

const backgrounds: Record<AvatarConfig["background"], { from: string; to: string; glow: string }> = {
  city: { from: "#0b1220", to: "#1a2a44", glow: "#22d3ee" },
  forge: { from: "#1a1206", to: "#3a2608", glow: "#2ea4ff" },
  void: { from: "#040812", to: "#1b0b2e", glow: "#a855f7" },
  arena: { from: "#0a1410", to: "#123324", glow: "#22c55e" },
};

// ---------------------------------------------------------------------------
// Colour helpers
// ---------------------------------------------------------------------------

function rgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  if (value.length !== 6) return [128, 128, 128];
  return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16)) as [number, number, number];
}

function hex(channels: number[]) {
  return `#${channels.map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0")).join("")}`;
}

function darken(color: string, amount = 0.25) {
  return hex(rgb(color).map((c) => c * (1 - amount)));
}

function lighten(color: string, amount = 0.25) {
  return hex(rgb(color).map((c) => c + (255 - c) * amount));
}

function mix(a: string, b: string, t: number) {
  const [x, y] = [rgb(a), rgb(b)];
  return hex(x.map((c, i) => c + (y[i] - c) * t));
}

// ---------------------------------------------------------------------------
// Figure geometry (200 x 320 canvas, figure centred on x = 100)
//
// Realistic-ish proportions (about 5.5 heads tall) instead of the old big-head
// cartoon. Cosmetic artwork is still authored for the old layout, so each slot is
// mapped onto the new body with a transform (see COSMETIC_FIT).
// ---------------------------------------------------------------------------

const BODY = {
  slim: { shoulder: 31, waist: 21, hip: 23, arm: 6.5, leg: 9.5, neck: 8.5 },
  athletic: { shoulder: 36, waist: 24, hip: 25, arm: 8, leg: 11, neck: 9.5 },
  broad: { shoulder: 42, waist: 29, hip: 28, arm: 9.5, leg: 12.5, neck: 11 },
} as const;

/** Old-layout cosmetic art → new figure. */
const COSMETIC_FIT = {
  head: "translate(100 56) scale(0.62) translate(-100 -72)",
  torso: "translate(100 93) scale(0.95) translate(-100 -118)",
  legs: "translate(100 170) scale(0.92 1.3) translate(-100 -196)",
  shoes: "translate(100 257) scale(0.86 1.35) translate(-100 -262)",
};

type Props = {
  config: AvatarConfig;
  size?: number;
  showBackground?: boolean;
  className?: string;
  /** Equipped cosmetics, drawn over the base character in slot order. */
  equipped?: EquippedCosmetic[];
};

/**
 * Layered SVG avatar with lighting: a key light from the upper left, soft ambient
 * occlusion, and a rim light in the accent colour. Everything is driven by the config,
 * so the same component renders the studio preview, profile card, sidebar chip and
 * saved-preset thumbnails.
 */
export function AvatarRenderer({ config, size = 320, showBackground = true, className, equipped }: Props) {
  const uid = `av${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const id = (name: string) => `${uid}-${name}`;
  const url = (name: string) => `url(#${id(name)})`;

  const bg = backgrounds[config.background] ?? backgrounds.city;
  const b = BODY[config.body] ?? BODY.athletic;
  const len = Math.max(0, Math.min(100, config.hairLength)) / 100;

  // Skin palette from the chosen tone.
  const skin = config.skin;
  const skinLight = lighten(skin, 0.16);
  const skinShadow = darken(skin, 0.2);
  const skinDeep = darken(skin, 0.38);
  const blush = mix(skin, "#d4655a", 0.28);
  const lip = mix(darken(skin, 0.12), "#a8454a", 0.45);
  const hair = config.hairColor;
  const hairLight = lighten(hair, 0.35);
  const hairDark = darken(hair, 0.42);
  const top = config.topColor;
  const topLight = lighten(top, 0.18);
  const topDark = darken(top, 0.38);
  const pants = config.bottomColor;
  const shoe = config.shoeColor;

  const gear = new Map((equipped ?? []).map((item) => [item.slot, item]));
  const headGear = gear.get("HEAD");
  const faceGear = gear.get("FACE");
  const topGear = gear.get("TOP");
  const bottomGear = gear.get("BOTTOM");
  const shoeGear = gear.get("SHOES");
  const backGear = gear.get("BACK");
  const accessoryGear = gear.get("ACCESSORY");
  const accessoryFit = accessoryGear?.key === "acc-headset" ? COSMETIC_FIT.head : COSMETIC_FIT.torso;

  const cx = 100;
  const sh = b.shoulder;
  const L = (dx: number) => cx - dx;
  const R = (dx: number) => cx + dx;

  // Torso silhouette (also the hoodie when no TOP cosmetic is worn).
  const torso = `M${L(b.neck)} 89 C${L(b.neck + 8)} 91 ${L(sh - 6)} 93 ${L(sh)} 99
    C${L(sh + 2)} 112 ${L(sh - 1)} 130 ${L(b.waist + 1)} 152 L${L(b.waist)} 166 L${L(b.hip)} 180
    Q${cx} 186 ${R(b.hip)} 180 L${R(b.waist)} 166 L${R(b.waist + 1)} 152
    C${R(sh - 1)} 130 ${R(sh + 2)} 112 ${R(sh)} 99 C${R(sh - 6)} 93 ${R(b.neck + 8)} 91 ${R(b.neck)} 89 Z`;

  // Arms: upper arm and forearm as separate strokes so they taper and bend at the elbow.
  const elbowL = { x: L(sh + 4.5), y: 139 };
  const elbowR = { x: R(sh + 4.5), y: 139 };
  const upperL = `M${L(sh - 3)} 103 Q${L(sh + 4)} 120 ${elbowL.x} ${elbowL.y}`;
  const upperR = `M${R(sh - 3)} 103 Q${R(sh + 4)} 120 ${elbowR.x} ${elbowR.y}`;
  const foreL = `M${elbowL.x} ${elbowL.y} Q${L(sh + 4)} 160 ${L(sh + 1)} 175`;
  const foreR = `M${elbowR.x} ${elbowR.y} Q${R(sh + 4)} 160 ${R(sh + 1)} 175`;
  const handL = { x: L(sh + 1), y: 184 };
  const handR = { x: R(sh + 1), y: 184 };

  // Legs.
  const legL = `M${L(b.hip)} 176 C${L(b.hip + 1)} 205 ${L(b.leg + 13)} 232 ${L(b.leg + 9)} 259 L${L(3)} 259 C${L(4)} 232 ${L(3)} 205 ${L(1.5)} 183 Z`;
  const legR = `M${R(b.hip)} 176 C${R(b.hip + 1)} 205 ${R(b.leg + 13)} 232 ${R(b.leg + 9)} 259 L${R(3)} 259 C${R(4)} 232 ${R(3)} 205 ${R(1.5)} 183 Z`;

  // Head.
  const face = "M81 52 C81 36 90 29.5 100 29.5 C110 29.5 119 36 119 52 C119 62 118 68 115 73 C111 79 105 82.5 100 82.5 C95 82.5 89 79 85 73 C82 68 81 62 81 52 Z";
  const hairCap = "M79.5 54 C78 37 88 26 100 26 C112 26 122 37 120.5 54 C118 47 113 42.5 106 41.5 C101 44 94 43 88.5 45 C84 47 81 50 79.5 54 Z";

  return (
    <svg viewBox="0 0 200 320" width={size} height={size * 1.6} className={className} role="img" aria-label="Avatar preview">
      <defs>
        <linearGradient id={id("bg")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={bg.from} />
          <stop offset="100%" stopColor={bg.to} />
        </linearGradient>
        <radialGradient id={id("glow")} cx="50%" cy="88%" r="55%">
          <stop offset="0%" stopColor={bg.glow} stopOpacity="0.5" />
          <stop offset="100%" stopColor={bg.glow} stopOpacity="0" />
        </radialGradient>
        {/* Key light from the upper left on skin. */}
        <radialGradient id={id("skin")} cx="38%" cy="32%" r="78%">
          <stop offset="0%" stopColor={skinLight} />
          <stop offset="55%" stopColor={skin} />
          <stop offset="100%" stopColor={skinShadow} />
        </radialGradient>
        <linearGradient id={id("neck")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={skinDeep} />
          <stop offset="45%" stopColor={skinShadow} />
          <stop offset="100%" stopColor={skin} />
        </linearGradient>
        <linearGradient id={id("hair")} x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor={hairLight} />
          <stop offset="45%" stopColor={hair} />
          <stop offset="100%" stopColor={hairDark} />
        </linearGradient>
        <linearGradient id={id("top")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={topLight} />
          <stop offset="60%" stopColor={top} />
          <stop offset="100%" stopColor={topDark} />
        </linearGradient>
        <linearGradient id={id("sleeve")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={topLight} />
          <stop offset="100%" stopColor={topDark} />
        </linearGradient>
        <linearGradient id={id("pants")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={lighten(pants, 0.14)} />
          <stop offset="55%" stopColor={pants} />
          <stop offset="100%" stopColor={darken(pants, 0.35)} />
        </linearGradient>
        <linearGradient id={id("shoe")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lighten(shoe, 0.2)} />
          <stop offset="100%" stopColor={darken(shoe, 0.25)} />
        </linearGradient>
        <radialGradient id={id("iris")} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={lighten(config.eyeColor, 0.35)} />
          <stop offset="60%" stopColor={config.eyeColor} />
          <stop offset="100%" stopColor={darken(config.eyeColor, 0.55)} />
        </radialGradient>
        <linearGradient id={id("sclera")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#dcd6d0" />
          <stop offset="45%" stopColor="#f6f2ee" />
          <stop offset="100%" stopColor="#e7e0da" />
        </linearGradient>
        <linearGradient id={id("visor")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={darken(config.eyeColor, 0.4)} />
          <stop offset="50%" stopColor={config.eyeColor} />
          <stop offset="100%" stopColor={darken(config.eyeColor, 0.4)} />
        </linearGradient>
        <linearGradient id={id("lens")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#020617" />
        </linearGradient>
        <filter id={id("soft")} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.4" />
        </filter>
        <filter id={id("softer")} x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
        {/* Rim light in the accent colour, plus a soft contact shadow, around the whole figure. */}
        <filter id={id("rim")} x="-20%" y="-10%" width="140%" height="120%">
          <feDropShadow dx="1.3" dy="-0.4" stdDeviation="0.8" floodColor={config.accent} floodOpacity="0.28" />
          <feDropShadow dx="-1" dy="2" stdDeviation="2.2" floodColor="#000" floodOpacity="0.45" />
        </filter>
        <pattern id={id("stubble")} width="2.2" height="2.2" patternUnits="userSpaceOnUse">
          <circle cx="1.1" cy="1.1" r="0.35" fill={hairDark} />
        </pattern>
      </defs>

      {showBackground ? (
        <>
          <rect width="200" height="320" rx="18" fill={url("bg")} />
          <rect width="200" height="320" rx="18" fill={url("glow")} />
          {config.background === "city" ? (
            <g opacity="0.35" fill="#0f172a">
              <rect x="10" y="150" width="22" height="120" />
              <rect x="40" y="120" width="18" height="150" />
              <rect x="150" y="135" width="26" height="135" />
              <rect x="182" y="165" width="12" height="105" />
              <g fill={bg.glow} opacity="0.8">
                <rect x="14" y="160" width="3" height="3" />
                <rect x="22" y="180" width="3" height="3" />
                <rect x="45" y="130" width="3" height="3" />
                <rect x="156" y="150" width="3" height="3" />
                <rect x="168" y="190" width="3" height="3" />
              </g>
            </g>
          ) : null}
          <ellipse cx="100" cy="282" rx="68" ry="9" fill={bg.glow} opacity="0.3" />
          <ellipse cx="100" cy="282" rx="50" ry="5.5" fill="none" stroke={bg.glow} strokeOpacity="0.6" strokeWidth="1.2" />
        </>
      ) : null}

      {/* Contact shadow under the feet. */}
      <ellipse cx="100" cy="279" rx="34" ry="4" fill="#000" opacity="0.45" filter={url("soft")} />

      <g filter={url("rim")}>
        {/* ----- behind the body ----- */}
        {backGear ? <g transform={COSMETIC_FIT.torso}><CosmeticBackLayer item={backGear} accent={config.accent} /></g> : null}
        {config.hair === "long" ? (
          <path
            d={`M80 44 C70 ${70 + len * 30} 72 ${92 + len * 50} 78 ${104 + len * 58} L122 ${104 + len * 58} C128 ${92 + len * 50} 130 ${70 + len * 30} 120 44 Z`}
            fill={hairDark}
          />
        ) : null}

        {/* ----- legs ----- */}
        {bottomGear ? (
          <g transform={COSMETIC_FIT.legs}><CosmeticBottomLayer item={bottomGear} accent={config.accent} /></g>
        ) : (
          <g>
            <path d={legL} fill={url("pants")} />
            <path d={legR} fill={url("pants")} />
            {/* inseam shadow, knee creases, hem bunching */}
            <path d={`M${L(1.5)} 184 C${L(3)} 210 ${L(3.5)} 236 ${L(3)} 258`} stroke={darken(pants, 0.45)} strokeWidth="1.4" fill="none" opacity="0.6" />
            <path d={`M${R(1.5)} 184 C${R(3)} 210 ${R(3.5)} 236 ${R(3)} 258`} stroke={darken(pants, 0.45)} strokeWidth="1.4" fill="none" opacity="0.6" />
            <path d={`M${L(b.leg + 6)} 214 q5 -2 9 1 M${L(b.leg + 7)} 220 q6 -1 10 2`} stroke={darken(pants, 0.35)} strokeWidth="0.8" fill="none" opacity="0.7" />
            <path d={`M${R(b.leg + 6)} 214 q-5 -2 -9 1 M${R(b.leg + 7)} 220 q-6 -1 -10 2`} stroke={darken(pants, 0.35)} strokeWidth="0.8" fill="none" opacity="0.7" />
            <path d={`M${L(b.leg + 9)} 252 q6 -3 ${b.leg + 5} 0 M${R(b.leg + 9)} 252 q-6 -3 -${b.leg + 5} 0`} stroke={darken(pants, 0.3)} strokeWidth="0.8" fill="none" opacity="0.7" />
            {/* outer seam */}
            <path d={`M${L(b.hip - 1)} 182 C${L(b.hip)} 210 ${L(b.leg + 12)} 236 ${L(b.leg + 8)} 258`} stroke={lighten(pants, 0.25)} strokeWidth="0.5" strokeDasharray="1.4 1.2" fill="none" opacity="0.6" />
            <path d={`M${R(b.hip - 1)} 182 C${R(b.hip)} 210 ${R(b.leg + 12)} 236 ${R(b.leg + 8)} 258`} stroke={lighten(pants, 0.25)} strokeWidth="0.5" strokeDasharray="1.4 1.2" fill="none" opacity="0.6" />
          </g>
        )}

        {/* ----- shoes ----- */}
        {shoeGear ? (
          <g transform={COSMETIC_FIT.shoes}><CosmeticShoesLayer item={shoeGear} accent={config.accent} /></g>
        ) : (
          <g>
            {[-1, 1].map((side) => {
              const x = (dx: number) => cx + side * dx;
              const toe = side === -1 ? x(b.leg + 17) : x(b.leg + 17);
              return (
                <g key={side}>
                  {/* upper */}
                  <path d={`M${x(2)} 257 C${x(2)} 263 ${x(3)} 268 ${x(4)} 270 L${toe} 271 C${x(b.leg + 19)} 268 ${x(b.leg + 15)} 262 ${x(b.leg + 9)} 257 Z`} fill={url("shoe")} />
                  {/* toe cap and side panel */}
                  <path d={`M${toe} 271 C${x(b.leg + 18)} 266 ${x(b.leg + 13)} 264 ${x(b.leg + 6)} 265`} stroke={darken(shoe, 0.35)} strokeWidth="0.8" fill="none" />
                  <path d={`M${x(5)} 266 q${side * 6} -4 ${side * 12} -1`} stroke={config.accent} strokeWidth="1.5" fill="none" strokeLinecap="round" />
                  {/* laces */}
                  <path d={`M${x(b.leg + 5)} 259.5 l${side * 3} 1.2 M${x(b.leg + 7)} 261.5 l${side * 3} 1.2 M${x(b.leg + 9)} 263.5 l${side * 3} 1.2`} stroke={lighten(shoe, 0.6)} strokeWidth="0.8" strokeLinecap="round" />
                  {/* midsole and outsole */}
                  <path d={`M${x(1.5)} 269 L${toe + side * 1} 270 C${toe + side * 2} 273 ${toe} 275 ${toe - side * 2} 275 L${x(2.5)} 275 C${x(1.5)} 274 ${x(1)} 272 ${x(1.5)} 269 Z`} fill="#f1f5f9" />
                  <path d={`M${x(2.5)} 275 L${toe - side * 2} 275 L${toe - side * 2.5} 277 L${x(3)} 277 Z`} fill="#334155" />
                </g>
              );
            })}
          </g>
        )}

        {/* ----- torso and arms ----- */}
        {topGear ? (
          <g transform={COSMETIC_FIT.torso}><CosmeticTopLayer item={topGear} accent={config.accent} /></g>
        ) : (
          <g>
            {/* sleeves first so the torso overlaps the armpits */}
            <path d={upperL} stroke={url("sleeve")} strokeWidth={b.arm * 2.15} strokeLinecap="round" fill="none" />
            <path d={upperR} stroke={url("sleeve")} strokeWidth={b.arm * 2.15} strokeLinecap="round" fill="none" />
            <path d={foreL} stroke={url("sleeve")} strokeWidth={b.arm * 1.8} strokeLinecap="round" fill="none" />
            <path d={foreR} stroke={url("sleeve")} strokeWidth={b.arm * 1.8} strokeLinecap="round" fill="none" />
            {/* elbow creases */}
            <path d={`M${elbowL.x - 3} ${elbowL.y - 1} q3 2 6 0 M${elbowL.x - 2} ${elbowL.y + 3} q3 1.5 5 0`} stroke={topDark} strokeWidth="0.8" fill="none" opacity="0.7" />
            <path d={`M${elbowR.x + 3} ${elbowR.y - 1} q-3 2 -6 0 M${elbowR.x + 2} ${elbowR.y + 3} q-3 1.5 -5 0`} stroke={topDark} strokeWidth="0.8" fill="none" opacity="0.7" />
            <path d={torso} fill={url("top")} />
            {/* hood resting on the shoulders */}
            <path d={`M${L(b.neck + 6)} 90 C${L(b.neck + 9)} 98 ${R(b.neck + 9)} 98 ${R(b.neck + 6)} 90 C${R(b.neck + 3)} 95 ${L(b.neck + 3)} 95 ${L(b.neck + 6)} 90 Z`} fill={topDark} />
            {/* folds and ambient occlusion */}
            <path d={`M${L(b.waist - 2)} 150 q8 4 14 2 M${R(b.waist - 2)} 150 q-8 4 -14 2 M${L(sh - 8)} 112 q6 10 4 22`} stroke={topDark} strokeWidth="1.6" fill="none" opacity="0.55" filter={url("soft")} />
            <path d={`M${L(sh - 4)} 104 q2 30 ${sh - b.waist - 2} 50`} stroke={topDark} strokeWidth="3" fill="none" opacity="0.35" filter={url("soft")} />
            {/* kangaroo pocket, drawstrings, seams */}
            <path d={`M${L(b.waist - 5)} 168 L${L(b.waist - 9)} 150 L${R(b.waist - 9)} 150 L${R(b.waist - 5)} 168`} stroke={topDark} strokeWidth="0.9" fill="none" opacity="0.8" />
            <path d={`M${L(3)} 95 q-1 12 -2 20 M${R(3)} 95 q1 12 2 20`} stroke={lighten(top, 0.55)} strokeWidth="0.9" fill="none" strokeLinecap="round" />
            <circle cx={L(5)} cy="116" r="1" fill={config.accent} />
            <circle cx={R(5)} cy="116" r="1" fill={config.accent} />
            <path d={`M${L(b.hip)} 177 Q${cx} 182.5 ${R(b.hip)} 177`} stroke={topDark} strokeWidth="2.2" fill="none" />
            <path d={`M${L(sh)} 99 q-3 4 -3 9 M${R(sh)} 99 q3 4 3 9`} stroke={topDark} strokeWidth="0.7" strokeDasharray="1.3 1" fill="none" opacity="0.7" />
            {/* chest emblem */}
            <path d={`M${cx - 5} 124 l5 8 l5 -8 l-2.2 0 l-2.8 4.6 l-2.8 -4.6 z`} fill={config.accent} />
            {/* cuffs */}
            <path d={`M${L(sh + 1)} 171 l0 4`} stroke={topDark} strokeWidth={b.arm * 1.8 + 0.6} strokeLinecap="round" />
            <path d={`M${R(sh + 1)} 171 l0 4`} stroke={topDark} strokeWidth={b.arm * 1.8 + 0.6} strokeLinecap="round" />
          </g>
        )}
        {backGear ? <g transform={COSMETIC_FIT.torso}><CosmeticBackStraps item={backGear} accent={config.accent} /></g> : null}

        {/* ----- hands ----- */}
        {[handL, handR].map((hand, i) => {
          const side = i === 0 ? -1 : 1;
          return (
            <g key={i}>
              <path d={`M${hand.x - 4.6} ${hand.y - 6} C${hand.x - 5.5} ${hand.y + 1} ${hand.x - 3.5} ${hand.y + 7} ${hand.x} ${hand.y + 7.5} C${hand.x + 3.5} ${hand.y + 7} ${hand.x + 5.5} ${hand.y + 1} ${hand.x + 4.6} ${hand.y - 6} Z`} fill={url("skin")} />
              {/* fingers and thumb */}
              <path d={`M${hand.x - 2} ${hand.y + 1} l0 5 M${hand.x} ${hand.y + 1.5} l0 5.5 M${hand.x + 2} ${hand.y + 1} l0 5`} stroke={skinShadow} strokeWidth="0.5" strokeLinecap="round" />
              <path d={`M${hand.x - side * 4.5} ${hand.y - 3} q${-side * 1.5} 4 ${side * 0.5} 6`} stroke={skinShadow} strokeWidth="0.7" fill="none" />
            </g>
          );
        })}

        {/* ----- neck and head ----- */}
        <path d={`M${L(b.neck)} 72 L${L(b.neck)} 92 Q${cx} 96 ${R(b.neck)} 92 L${R(b.neck)} 72 Z`} fill={url("neck")} />
        {/* ears */}
        <g>
          <path d="M82 51 C77 49 76.5 57 78.5 61 C79.5 64 81.5 65 83 64 Z" fill={skin} />
          <path d="M81.2 54 C79.5 54.5 79.4 58 80.6 60.5" stroke={skinDeep} strokeWidth="0.8" fill="none" />
          <path d="M118 51 C123 49 123.5 57 121.5 61 C120.5 64 118.5 65 117 64 Z" fill={skinShadow} />
          <path d="M118.8 54 C120.5 54.5 120.6 58 119.4 60.5" stroke={skinDeep} strokeWidth="0.8" fill="none" />
        </g>
        <path d={face} fill={url("skin")} />
        {/* jaw and cheek shading, under-chin occlusion */}
        <path d="M85 73 C89 79 95 82.5 100 82.5 C105 82.5 111 79 115 73 C112 77 106 80 100 80 C94 80 88 77 85 73 Z" fill={skinShadow} opacity="0.6" />
        <ellipse cx="114.5" cy="62" rx="4" ry="7" fill={skinShadow} opacity="0.45" filter={url("soft")} />
        <ellipse cx="88.5" cy="63.5" rx="3.6" ry="2.2" fill={blush} opacity="0.55" filter={url("soft")} />
        <ellipse cx="111.5" cy="63.5" rx="3.6" ry="2.2" fill={blush} opacity="0.45" filter={url("soft")} />
        <ellipse cx="96" cy="40" rx="8" ry="4" fill={skinLight} opacity="0.5" filter={url("soft")} />

        {/* nose: bridge highlight, side shadow, tip and nostrils */}
        <path d="M99.3 55 L99 63" stroke={skinLight} strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
        <path d="M101.6 56 C102.4 60 103.2 63 102.6 65.4" stroke={skinShadow} strokeWidth="1.1" fill="none" opacity="0.8" />
        <path d="M96.6 65.6 C97.6 67.4 102.4 67.4 103.4 65.6" stroke={skinDeep} strokeWidth="0.7" fill="none" opacity="0.7" />
        <ellipse cx="98.2" cy="66.2" rx="0.9" ry="0.45" fill={skinDeep} />
        <ellipse cx="101.8" cy="66.2" rx="0.9" ry="0.45" fill={skinDeep} />

        {/* eyes */}
        <Eyes style={config.eyes} url={url} hairDark={hairDark} skin={skin} skinShadow={skinShadow} />

        {/* mouth */}
        <Mouth expression={config.face} lip={lip} skinDeep={skinDeep} />

        {/* hair */}
        <Hair style={config.hair} len={len} url={url} hair={hair} hairLight={hairLight} hairDark={hairDark} cap={hairCap} skinShadow={skinShadow} />

        {/* equipped head, face and accessory gear sit above the hair */}
        {headGear ? <g transform={COSMETIC_FIT.head}><CosmeticHeadLayer item={headGear} accent={config.accent} /></g> : null}
        {faceGear ? <g transform={COSMETIC_FIT.head}><CosmeticFaceLayer item={faceGear} accent={config.accent} /></g> : null}
        {accessoryGear ? <g transform={accessoryFit}><CosmeticAccessoryLayer item={accessoryGear} accent={config.accent} /></g> : null}

        {/* built-in accessories (only when no ACCESSORY cosmetic is equipped) */}
        {accessoryGear ? null : <Accessory kind={config.accessory} accent={config.accent} url={url} top={top} />}
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Parts
// ---------------------------------------------------------------------------

function Eyes({ style, url, hairDark, skin, skinShadow }: { style: AvatarConfig["eyes"]; url: (n: string) => string; hairDark: string; skin: string; skinShadow: string }) {
  if (style === "visor") {
    return (
      <g>
        <path d="M82 50.5 Q100 47 118 50.5 L117 59.5 Q100 62 83 59.5 Z" fill={url("visor")} opacity="0.95" />
        <path d="M85 52 Q100 49.5 112 52" stroke="#fff" strokeWidth="1" opacity="0.55" fill="none" strokeLinecap="round" />
        <path d="M82 50.5 Q100 47 118 50.5" stroke="#0b1220" strokeWidth="1.1" fill="none" />
      </g>
    );
  }
  const open = style === "round" ? 3.4 : style === "calm" ? 1.6 : 2.6; // lid opening
  const tilt = style === "sharp" ? 0.8 : 0;
  return (
    <g>
      {[-1, 1].map((side) => {
        const ex = 100 + side * 9;
        const ey = 56;
        const inner = ex - side * 5;
        const outer = ex + side * 5;
        const almond = `M${inner} ${ey} Q${ex} ${ey - open - 0.6 - (side === 1 ? 0 : 0)} ${outer} ${ey - tilt} Q${ex} ${ey + open * 0.7} ${inner} ${ey} Z`;
        return (
          <g key={side}>
            {/* socket shading */}
            <ellipse cx={ex} cy={ey - 1.5} rx="6.5" ry="3.6" fill={skinShadow} opacity="0.35" />
            <path d={almond} fill={url("sclera")} />
            <clipPath id={`${url("x").slice(5, -1)}-eye${side}`}>
              <path d={almond} />
            </clipPath>
            <g clipPath={`url(#${url("x").slice(5, -1)}-eye${side})`}>
              <circle cx={ex} cy={ey - 0.2} r="2.3" fill={url("iris")} />
              <circle cx={ex} cy={ey - 0.2} r="2.3" fill="none" stroke="#0b1220" strokeWidth="0.35" opacity="0.6" />
              <circle cx={ex} cy={ey - 0.2} r="1.05" fill="#05070c" />
              <circle cx={ex - 0.75} cy={ey - 1} r="0.55" fill="#fff" />
              <circle cx={ex + 0.7} cy={ey + 0.5} r="0.25" fill="#fff" opacity="0.7" />
              {/* upper lid shadow on the eyeball */}
              <path d={`M${inner} ${ey} Q${ex} ${ey - open - 0.6} ${outer} ${ey - tilt} L${outer} ${ey - 5} L${inner} ${ey - 5} Z`} fill="#000" opacity="0.18" transform="translate(0 1)" />
            </g>
            {/* upper lid line with lashes, crease, lower lid */}
            <path d={`M${inner - side * 0.4} ${ey + 0.2} Q${ex} ${ey - open - 0.9} ${outer + side * 0.6} ${ey - tilt - 0.4}`} stroke="#1b1210" strokeWidth="0.95" fill="none" strokeLinecap="round" />
            <path d={`M${outer - side * 1.5} ${ey - tilt - 1.2} l${side * 1.4} -0.9 M${outer - side * 3} ${ey - open} l${side * 0.9} -1`} stroke="#1b1210" strokeWidth="0.45" strokeLinecap="round" />
            <path d={`M${inner} ${ey - 2.6} Q${ex} ${ey - open - 3.4} ${outer} ${ey - tilt - 2.4}`} stroke={skinShadow} strokeWidth="0.6" fill="none" opacity="0.8" />
            <path d={`M${inner + side * 1} ${ey + 0.8} Q${ex} ${ey + open * 0.75 + 0.4} ${outer - side * 0.5} ${ey - tilt + 0.2}`} stroke={skinShadow} strokeWidth="0.45" fill="none" opacity="0.9" />
            {style === "calm" ? (
              <path d={`M${inner} ${ey} Q${ex} ${ey - open - 3} ${outer} ${ey - tilt} Q${ex} ${ey - open + 0.4} ${inner} ${ey} Z`} fill={skin} />
            ) : null}
            {/* brow */}
            <path
              d={style === "sharp" ? `M${inner - side * 0.5} ${ey - 4.6} Q${ex} ${ey - 6.4} ${outer + side * 1} ${ey - 7.4}` : `M${inner - side * 0.5} ${ey - 5.6} Q${ex} ${ey - 7.4} ${outer + side * 1} ${ey - 6}`}
              stroke={hairDark}
              strokeWidth="1.7"
              strokeLinecap="round"
              fill="none"
            />
          </g>
        );
      })}
    </g>
  );
}

function Mouth({ expression, lip, skinDeep }: { expression: AvatarConfig["face"]; lip: string; skinDeep: string }) {
  const upperLip = (y: number, curl = 0) => `M94.6 ${y} Q97.4 ${y - 1.3} 100 ${y - 0.5} Q102.6 ${y - 1.3 - curl} 105.4 ${y - curl} Q100 ${y + 0.9} 94.6 ${y} Z`;
  if (expression === "grin") {
    return (
      <g>
        <path d="M93.5 71 Q100 73 106.5 71 Q105 77.5 100 77.8 Q95 77.5 93.5 71 Z" fill="#3b0f12" />
        <path d="M94.6 71.4 Q100 73.2 105.4 71.4 L105 73 Q100 74.3 95 73 Z" fill="#f8f5f0" />
        <path d="M96 76.2 Q100 77.4 104 76.2" stroke={lip} strokeWidth="1.3" fill="none" strokeLinecap="round" />
        <path d="M93.5 71 Q100 73 106.5 71" stroke={lip} strokeWidth="1.1" fill="none" />
        <path d="M92.6 70.2 q-0.8 0.6 -0.5 1.6 M107.4 70.2 q0.8 0.6 0.5 1.6" stroke={skinDeep} strokeWidth="0.5" fill="none" />
      </g>
    );
  }
  const curl = expression === "smirk" ? 1.1 : 0;
  const down = expression === "focused" ? 0.5 : 0;
  return (
    <g>
      <path d={upperLip(71.6, curl)} fill={lip} />
      <path d={`M95.2 ${71.9 + down} Q100 ${75.2} 104.8 ${71.9 - curl + down} Q100 ${72.8} 95.2 ${71.9 + down} Z`} fill={lighten(lip, 0.08)} />
      <path d={`M94.6 ${71.6 + down} Q100 ${72.5} 105.4 ${71.6 - curl + down}`} stroke={darken(lip, 0.45)} strokeWidth="0.6" fill="none" />
      {/* lower-lip highlight and chin shadow */}
      <path d="M98.4 73.6 q1.6 0.5 3.2 0" stroke="#fff" strokeWidth="0.45" opacity="0.4" fill="none" strokeLinecap="round" />
      <path d="M97 77.2 Q100 78.3 103 77.2" stroke={skinDeep} strokeWidth="0.6" opacity="0.5" fill="none" />
      {expression === "smirk" ? <path d="M105.5 70.3 q1.2 -0.2 1.6 -1.4" stroke={skinDeep} strokeWidth="0.5" fill="none" /> : null}
    </g>
  );
}

function Hair({
  style,
  len,
  url,
  hair,
  hairLight,
  hairDark,
  cap,
  skinShadow,
}: {
  style: AvatarConfig["hair"];
  len: number;
  url: (n: string) => string;
  hair: string;
  hairLight: string;
  hairDark: string;
  cap: string;
  skinShadow: string;
}) {
  // Strand texture laid over a hair mass: dark grooves and light sheen.
  const strands = (
    <g fill="none" strokeLinecap="round">
      <path d="M86 44 C89 36 95 31 101 30 M92 43 C95 36 100 32 106 31.5 M100 42 C103 35 108 32 113 34 M108 42 C111 37 114 36 117 40 M83 49 C84 41 88 35 93 32" stroke={hairDark} strokeWidth="0.6" opacity="0.7" />
      <path d="M90 40 C93 34 98 31 103 30.5 M97 39 C100 34 104 32 109 32.5" stroke={hairLight} strokeWidth="0.7" opacity="0.65" />
    </g>
  );
  // Shadow the hair casts on the forehead.
  const fringeShadow = <path d="M83 50 C88 45.5 95 44.5 100 45.5 C105 44.5 112 45 117 50 C112 47.5 106 46.8 100 48 C94 46.8 88 47.5 83 50 Z" fill={skinShadow} opacity="0.55" />;

  switch (style) {
    case "none":
      return <ellipse cx="96" cy="37" rx="9" ry="4" fill="#fff" opacity="0.12" />;
    case "buzz":
      return (
        <g>
          <path d={cap} fill={url("stubble")} opacity="0.85" />
          <path d={cap} fill={hair} opacity="0.35" />
        </g>
      );
    case "fade":
      return (
        <g>
          {fringeShadow}
          <path d="M81.5 47 C81 36 89 27.5 100 27.5 C111 27.5 119 36 118.5 47 C114 42 108 40.5 100 40.5 C92 40.5 86 42 81.5 47 Z" fill={url("hair")} />
          {/* faded sides: stubble fading into skin */}
          <path d="M80 50 C80.5 54 81 58 82 60 L83.5 52 C83 49 82 48 80 50 Z M120 50 C119.5 54 119 58 118 60 L116.5 52 C117 49 118 48 120 50 Z" fill={url("stubble")} opacity="0.75" />
          {strands}
        </g>
      );
    case "bun": {
      const r = 5.5 + len * 4;
      return (
        <g>
          {fringeShadow}
          <circle cx="100" cy={26 - r * 0.4} r={r} fill={url("hair")} />
          <path d={`M${100 - r * 0.6} ${26 - r * 0.4} A${r * 0.6} ${r * 0.6} 0 1 1 ${100 + r * 0.6} ${26 - r * 0.4}`} stroke={hairDark} strokeWidth="0.6" fill="none" opacity="0.7" />
          <path d={cap} fill={url("hair")} />
          <path d="M84 48 C88 38 94 30 100 27.5 M116 48 C112 38 106 30 100 27.5 M90 45 C93 37 97 31 100 28 M110 45 C107 37 103 31 100 28" stroke={hairDark} strokeWidth="0.55" fill="none" opacity="0.7" />
          <path d="M93 38 C96 33 98 30 100 28.5" stroke={hairLight} strokeWidth="0.7" fill="none" opacity="0.6" />
        </g>
      );
    }
    case "mohawk": {
      const h = 10 + len * 16;
      return (
        <g>
          <path d={cap} fill={url("stubble")} opacity="0.7" />
          <path d={`M93 44 C92 ${36 - h * 0.4} 95 ${28 - h} 100 ${26 - h} C105 ${28 - h} 108 ${36 - h * 0.4} 107 44 C104 41.5 96 41.5 93 44 Z`} fill={url("hair")} />
          <path d={`M97 42 C96.5 ${34 - h * 0.4} 98 ${30 - h * 0.8} 100 ${27 - h} M103 42 C103.5 ${34 - h * 0.4} 102 ${30 - h * 0.8} 100 ${27 - h}`} stroke={hairDark} strokeWidth="0.6" fill="none" opacity="0.75" />
          <path d={`M99 41 C98.6 ${34 - h * 0.4} 99.2 ${30 - h * 0.7} 100 ${28 - h}`} stroke={hairLight} strokeWidth="0.8" fill="none" opacity="0.7" />
        </g>
      );
    }
    case "curls": {
      const curls: Array<[number, number, number]> = [
        [84, 44, 4.2], [89, 37, 4.6], [96, 32.5, 4.8], [104, 32.5, 4.8], [111, 37, 4.6], [116, 44, 4.2],
        [92, 41.5, 3.8], [100, 39, 4], [108, 41.5, 3.8], [100, 30, 4.2],
      ];
      const sideDrop = 4 + len * 12;
      return (
        <g>
          {fringeShadow}
          <path d={cap} fill={hairDark} />
          {[...curls, [81, 50 + sideDrop * 0.5, 3.8] as [number, number, number], [119, 50 + sideDrop * 0.5, 3.8] as [number, number, number], [80.5, 55 + sideDrop, 3.4] as [number, number, number], [119.5, 55 + sideDrop, 3.4] as [number, number, number]].map(([x, y, r], i) => (
            <g key={i}>
              <circle cx={x} cy={y} r={r} fill={url("hair")} />
              <path d={`M${x - r * 0.5} ${y + r * 0.1} a${r * 0.5} ${r * 0.5} 0 1 1 ${r * 0.8} ${r * 0.3}`} stroke={hairDark} strokeWidth="0.5" fill="none" opacity="0.8" />
              <circle cx={x - r * 0.35} cy={y - r * 0.4} r={r * 0.28} fill={hairLight} opacity="0.5" />
            </g>
          ))}
        </g>
      );
    }
    case "long":
      return (
        <g>
          {fringeShadow}
          <path d={cap} fill={url("hair")} />
          {/* side-swept fringe and locks framing the face */}
          <path d="M80 54 C79 44 86 38 96 37 C91 41 87 47 86 56 C85 63 84 68 82 72 C80 66 80 60 80 54 Z" fill={url("hair")} />
          <path d={`M120 54 C121 44 116 39 108 38 C113 42 115 48 115.5 56 C116 ${64 + len * 6} 116.5 ${70 + len * 10} 118 ${76 + len * 14} C121 ${68 + len * 8} 121 ${60} 120 54 Z`} fill={url("hair")} />
          <path d="M84 50 C86 43 90 39 96 37.5 M117 52 C116 45 113 41 108 38.5 M100 30 C106 31 112 35 116 42" stroke={hairDark} strokeWidth="0.6" fill="none" opacity="0.75" />
          <path d="M88 41 C92 35 97 32 103 31.5" stroke={hairLight} strokeWidth="0.8" fill="none" opacity="0.6" />
        </g>
      );
    case "spiky":
    default: {
      const h = 6 + len * 12;
      const spikes: Array<[number, number, number, number]> = [
        // base-left x, base-right x, tip x, tip y offset
        [80, 90, 74 - len * 4, 40 - h * 0.6],
        [86, 97, 86, 30 - h],
        [94, 105, 99, 26 - h * 1.1],
        [103, 113, 112, 29 - h],
        [110, 120, 125 + len * 4, 39 - h * 0.6],
      ];
      return (
        <g>
          {fringeShadow}
          <path d={cap} fill={url("hair")} />
          {spikes.map(([a, c, tx, ty], i) => (
            <g key={i}>
              <path d={`M${a} 42 Q${(a + tx) / 2 - 1} ${(42 + ty) / 2} ${tx} ${ty} Q${(c + tx) / 2 + 1} ${(40 + ty) / 2} ${c} 40 Z`} fill={url("hair")} />
              <path d={`M${(a + c) / 2} 41 Q${((a + c) / 2 + tx) / 2} ${(41 + ty) / 2} ${tx} ${ty}`} stroke={hairLight} strokeWidth="0.7" fill="none" opacity="0.6" />
            </g>
          ))}
          {/* fringe pieces over the forehead */}
          <path d="M86 44 L90 52 L93 44 L97 50 L100 43.5 L104 50 L107 44 L111 51 L114 45 C108 42 92 42 86 44 Z" fill={url("hair")} />
          {strands}
        </g>
      );
    }
  }
}

function Accessory({ kind, accent, url, top }: { kind: AvatarConfig["accessory"]; accent: string; url: (n: string) => string; top: string }) {
  switch (kind) {
    case "shades":
      return (
        <g>
          <path d="M82 53 Q90 51 97 53 Q97 60 90.5 60.5 Q83.5 60 82 53 Z" fill={url("lens")} />
          <path d="M103 53 Q110 51 118 53 Q116.5 60 109.5 60.5 Q103 60 103 53 Z" fill={url("lens")} />
          <path d="M82 53 Q90 51 97 53 M103 53 Q110 51 118 53 M97 53.5 Q100 52 103 53.5 M82 53 L78.5 54 M118 53 L121.5 54" stroke="#0b0f19" strokeWidth="1.1" fill="none" />
          <path d="M84.5 54.5 l4 -1 M105.5 54.5 l4 -1" stroke="#fff" strokeWidth="0.8" opacity="0.5" strokeLinecap="round" />
          <path d="M87 58 Q91 59.5 95 57" stroke={accent} strokeWidth="0.5" opacity="0.5" fill="none" />
        </g>
      );
    case "headset":
      return (
        <g>
          <path d="M80 50 C78 30 122 30 120 50" stroke="#0f172a" strokeWidth="3.2" fill="none" />
          <path d="M80.5 47 C80 33 120 33 119.5 47" stroke="#334155" strokeWidth="1" fill="none" />
          <rect x="75.5" y="49" width="7" height="13" rx="3.2" fill="#0f172a" />
          <rect x="117.5" y="49" width="7" height="13" rx="3.2" fill="#0f172a" />
          <rect x="76.5" y="51" width="1.4" height="9" rx="0.7" fill={accent} opacity="0.9" />
          <path d="M79 61 C79 68 85 73 92 73.5" stroke="#0f172a" strokeWidth="1.4" fill="none" />
          <circle cx="92.5" cy="73.5" r="1.6" fill="#0f172a" />
        </g>
      );
    case "mask":
      return (
        <g>
          <path d="M83 62 Q100 58 117 62 L116 72 Q110 81 100 82 Q90 81 84 72 Z" fill={darken(top, 0.1)} />
          <path d="M86 66 Q100 63 114 66 M86.5 70 Q100 67.5 113.5 70 M88 74 Q100 72 112 74" stroke={darken(top, 0.45)} strokeWidth="0.6" fill="none" opacity="0.8" />
          <path d="M83 62 L79.5 58 M117 62 L120.5 58" stroke={darken(top, 0.3)} strokeWidth="0.9" />
        </g>
      );
    case "bandana":
      return (
        <g>
          <path d="M80.5 46 Q100 38.5 119.5 46 L119.5 50.5 Q100 43.5 80.5 50.5 Z" fill={accent} />
          <path d="M82 47.5 Q100 41 118 47.5" stroke={darken(accent, 0.3)} strokeWidth="0.5" fill="none" />
          <path d="M119 48 l5 4 l-1 4 M119 48 l6 -1 l1 4" stroke={darken(accent, 0.15)} strokeWidth="2" strokeLinejoin="round" fill="none" />
        </g>
      );
    default:
      return null;
  }
}
