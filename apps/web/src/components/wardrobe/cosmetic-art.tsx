"use client";

import type { CosmeticItem } from "@/lib/api";

/**
 * Vector artwork for every cosmetic in the catalog, drawn from the item's slot, key,
 * colour and accent so each card has real art like the design reference.
 */
export function CosmeticArt({ item, size = 120, className }: { item: CosmeticItem; size?: number; className?: string }) {
  const base = item.color ?? "#1e293b";
  const accent = item.metadata?.accent ?? "#e6b325";
  const key = item.key ?? "";
  const id = `art-${key || item.id}`;

  if (item.imageUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={item.imageUrl} alt="" width={size} height={size} className={`object-contain ${className ?? ""}`} />;
  }

  return (
    <svg viewBox="0 0 120 120" width={size} height={size} className={className} role="img" aria-label={item.name}>
      <defs>
        <radialGradient id={`${id}-glow`} cx="50%" cy="45%" r="55%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.45" />
          <stop offset="100%" stopColor={accent} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={lighten(base, 0.18)} />
          <stop offset="100%" stopColor={darken(base, 0.35)} />
        </linearGradient>
        <linearGradient id={`${id}-shine`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle cx="60" cy="58" r="52" fill={`url(#${id}-glow)`} />
      <g fill={`url(#${id}-body)`} stroke={darken(base, 0.5)} strokeWidth="1.5" strokeLinejoin="round">
        {shapeFor(item, id, accent, base)}
      </g>
    </svg>
  );
}

function shapeFor(item: CosmeticItem, id: string, accent: string, base: string) {
  const key = (item.key ?? "").toLowerCase();
  const shine = `url(#${id}-shine)`;

  switch (item.slot) {
    case "TOP": {
      const hood = key.includes("hoodie");
      const jacket = key.includes("jacket");
      return (
        <>
          {hood ? <path d="M40 34 Q60 14 80 34 L76 44 Q60 36 44 44 Z" /> : null}
          <path d="M44 40 L60 34 L76 40 L96 50 L88 68 L80 64 L80 100 L40 100 L40 64 L32 68 L24 50 Z" />
          <path d="M44 40 L60 34 L76 40 L80 52 L60 46 L40 52 Z" fill={shine} stroke="none" />
          {jacket ? <path d="M60 46 L60 100" stroke={accent} strokeWidth="3" fill="none" /> : null}
          {jacket ? <path d="M40 64 L40 100 M80 64 L80 100" stroke={accent} strokeWidth="1.5" strokeOpacity="0.6" fill="none" /> : null}
          {key.includes("jersey") ? <text x="60" y="80" textAnchor="middle" fontSize="18" fontWeight="700" fill={accent} stroke="none">7</text> : null}
          {hood || key.includes("vexora") ? <path d="M52 62 L60 78 L68 62 L64 62 L60 70 L56 62 Z" fill={accent} stroke="none" /> : null}
        </>
      );
    }
    case "BOTTOM": {
      const armored = key.includes("armor");
      return (
        <>
          <path d="M40 24 L80 24 L84 60 L78 104 L64 104 L60 62 L56 104 L42 104 L36 60 Z" />
          <path d="M40 24 L80 24 L82 40 L38 40 Z" fill={shine} stroke="none" />
          {key.includes("track") ? <path d="M46 40 L44 100 M74 40 L76 100" stroke={accent} strokeWidth="2.5" fill="none" /> : null}
          {key.includes("tactical") ? <rect x="66" y="56" width="12" height="12" rx="2" fill={darken(base, 0.2)} /> : null}
          {key.includes("tactical") ? <rect x="42" y="56" width="12" height="12" rx="2" fill={darken(base, 0.2)} /> : null}
          {armored ? <path d="M40 46 L56 44 L54 60 L42 62 Z M64 44 L80 46 L78 62 L66 60 Z" fill={accent} fillOpacity="0.5" /> : null}
        </>
      );
    }
    case "SHOES": {
      const galaxy = key.includes("galaxy");
      return (
        <>
          <path d="M22 78 L30 50 Q44 46 54 54 L70 62 Q92 66 98 78 L98 86 Q60 92 22 86 Z" />
          <path d="M22 86 Q60 92 98 86 L98 92 Q60 98 22 92 Z" fill={galaxy ? accent : darken(base, 0.45)} stroke="none" />
          <path d="M30 50 Q44 46 54 54 L60 58 Q48 56 34 60 Z" fill={shine} stroke="none" />
          <path d="M40 60 L50 58 M44 68 L56 64 M50 76 L62 70" stroke={accent} strokeWidth="1.5" fill="none" />
          {galaxy ? <g fill="#fff"><circle cx="40" cy="70" r="1.2" /><circle cx="66" cy="72" r="1.6" /><circle cx="80" cy="78" r="1" /><circle cx="52" cy="80" r="0.9" /></g> : null}
        </>
      );
    }
    case "HEAD": {
      if (key.includes("crown")) {
        return (
          <>
            <path d="M28 82 L24 40 L44 60 L60 30 L76 60 L96 40 L92 82 Z" />
            <rect x="28" y="82" width="64" height="10" rx="2" />
            <g fill={accent === "#e6b325" ? "#ef4444" : accent} stroke="none"><circle cx="60" cy="72" r="4" /><circle cx="40" cy="74" r="3" /><circle cx="80" cy="74" r="3" /></g>
          </>
        );
      }
      if (key.includes("mask")) {
        return (
          <>
            <path d="M26 46 Q60 30 94 46 L92 78 Q60 96 28 78 Z" />
            <path d="M34 56 Q60 50 86 56 L84 66 Q60 72 36 66 Z" fill={accent} stroke="none" opacity="0.9" />
            <path d="M26 46 Q60 30 94 46 L92 52 Q60 40 28 52 Z" fill={shine} stroke="none" />
          </>
        );
      }
      return (
        <>
          <path d="M30 62 Q30 34 60 34 Q90 34 90 62 L90 68 L30 68 Z" />
          <path d="M22 68 L98 68 L100 76 L20 76 Z" fill={darken(base, 0.25)} />
          <path d="M30 62 Q30 34 60 34 Q90 34 90 62 L88 56 Q60 42 32 56 Z" fill={shine} stroke="none" />
          <path d="M52 48 L60 62 L68 48 L64 48 L60 55 L56 48 Z" fill={accent} stroke="none" />
        </>
      );
    }
    case "FACE": {
      if (key.includes("paint")) {
        return (
          <>
            <path d="M28 44 L92 52 L90 60 L26 52 Z" fill={base} stroke="none" />
            <path d="M28 66 L92 74 L90 82 L26 74 Z" fill={darken(base, 0.2)} stroke="none" />
          </>
        );
      }
      return (
        <>
          <path d="M18 52 L102 52 L98 58 L88 76 L64 76 L60 62 L56 76 L32 76 L22 58 Z" />
          <path d="M32 58 L56 58 L54 70 L36 70 Z M64 58 L88 58 L84 70 L66 70 Z" fill={accent} fillOpacity="0.7" stroke="none" />
          <path d="M18 52 L102 52 L100 56 L20 56 Z" fill={shine} stroke="none" />
        </>
      );
    }
    case "BACK": {
      if (key.includes("wing")) {
        return (
          <>
            <path d="M60 60 Q40 20 14 34 Q26 46 20 62 Q34 58 40 70 Q46 64 60 60 Z" fill={base} />
            <path d="M60 60 Q80 20 106 34 Q94 46 100 62 Q86 58 80 70 Q74 64 60 60 Z" fill={base} />
            <path d="M60 60 Q40 32 22 38 M60 60 Q80 32 98 38" stroke={accent} strokeWidth="2" fill="none" />
            <ellipse cx="60" cy="62" rx="6" ry="14" fill={accent} stroke="none" />
          </>
        );
      }
      return (
        <>
          <rect x="34" y="30" width="52" height="66" rx="12" />
          <rect x="42" y="36" width="36" height="20" rx="6" fill={darken(base, 0.2)} />
          <rect x="42" y="64" width="36" height="22" rx="6" fill={darken(base, 0.2)} />
          <path d="M42 60 L78 60 M46 92 L74 92" stroke={accent} strokeWidth="2" fill="none" />
          <path d="M48 30 Q60 18 72 30" stroke={darken(base, 0.4)} strokeWidth="4" fill="none" />
        </>
      );
    }
    case "ACCESSORY": {
      if (key.includes("chain")) {
        return (
          <>
            <path d="M30 34 Q60 96 90 34" stroke={base} strokeWidth="6" fill="none" strokeDasharray="6 4" />
            <path d="M48 70 L60 96 L72 70 L66 70 L60 84 L54 70 Z" fill={base} />
          </>
        );
      }
      return (
        <>
          <path d="M30 70 Q30 30 60 30 Q90 30 90 70" stroke={base} strokeWidth="8" fill="none" />
          <rect x="22" y="62" width="18" height="30" rx="6" />
          <rect x="80" y="62" width="18" height="30" rx="6" />
          <path d="M40 84 Q46 96 58 96" stroke={accent} strokeWidth="3" fill="none" />
          <circle cx="60" cy="96" r="3" fill={accent} stroke="none" />
        </>
      );
    }
    case "EMOTE":
    default:
      return (
        <>
          <path d="M60 18 L69 46 L98 46 L75 63 L84 92 L60 74 L36 92 L45 63 L22 46 L51 46 Z" fill={base} />
          <path d="M60 18 L69 46 L98 46 L75 63 L60 52 Z" fill={shine} stroke="none" />
          <circle cx="60" cy="60" r="8" fill={accent} stroke="none" />
        </>
      );
  }
}

function clamp(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function parse(hex: string): [number, number, number] {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((char) => char + char).join("") : clean.padEnd(6, "0");
  return [parseInt(full.slice(0, 2), 16), parseInt(full.slice(2, 4), 16), parseInt(full.slice(4, 6), 16)];
}

function toHex([r, g, b]: [number, number, number]) {
  return `#${[r, g, b].map((channel) => clamp(channel).toString(16).padStart(2, "0")).join("")}`;
}

function lighten(hex: string, amount: number) {
  const [r, g, b] = parse(hex);
  return toHex([r + (255 - r) * amount, g + (255 - g) * amount, b + (255 - b) * amount]);
}

function darken(hex: string, amount: number) {
  const [r, g, b] = parse(hex);
  return toHex([r * (1 - amount), g * (1 - amount), b * (1 - amount)]);
}
