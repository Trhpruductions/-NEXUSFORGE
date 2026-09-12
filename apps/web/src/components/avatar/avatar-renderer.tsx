"use client";

import type { AvatarConfig } from "@/lib/api";

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
  shoeColor: "#e6b325",
  accent: "#e6b325",
  background: "city",
};

const backgrounds: Record<AvatarConfig["background"], { from: string; to: string; glow: string }> = {
  city: { from: "#0b1220", to: "#1a2a44", glow: "#22d3ee" },
  forge: { from: "#1a1206", to: "#3a2608", glow: "#e6b325" },
  void: { from: "#05030f", to: "#1b0b2e", glow: "#a855f7" },
  arena: { from: "#0a1410", to: "#123324", glow: "#22c55e" },
};

function darken(hex: string, amount = 0.25): string {
  const value = hex.replace("#", "");
  if (value.length !== 6) return hex;
  const channels = [0, 2, 4].map((offset) => Math.max(0, Math.round(parseInt(value.slice(offset, offset + 2), 16) * (1 - amount))));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function lighten(hex: string, amount = 0.25): string {
  const value = hex.replace("#", "");
  if (value.length !== 6) return hex;
  const channels = [0, 2, 4].map((offset) => Math.min(255, Math.round(parseInt(value.slice(offset, offset + 2), 16) + (255 - parseInt(value.slice(offset, offset + 2), 16)) * amount)));
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Layered SVG avatar. Everything is driven by the config so the same component renders the
 * studio preview, profile card, sidebar chip and saved-preset thumbnails.
 */
export function AvatarRenderer({
  config,
  size = 320,
  showBackground = true,
  className,
}: {
  config: AvatarConfig;
  size?: number;
  showBackground?: boolean;
  className?: string;
}) {
  const bg = backgrounds[config.background] ?? backgrounds.city;
  const widthScale = config.body === "slim" ? 0.88 : config.body === "broad" ? 1.14 : 1;
  const hairLen = config.hairLength / 100;
  const skinShade = darken(config.skin, 0.2);
  const hairShade = darken(config.hairColor, 0.3);
  const uid = `av-${config.background}-${config.accent.replace("#", "")}`;

  return (
    <svg viewBox="0 0 200 320" width={size} height={size * 1.6} className={className} role="img" aria-label="Avatar preview">
      <defs>
        <linearGradient id={`${uid}-bg`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={bg.from} />
          <stop offset="100%" stopColor={bg.to} />
        </linearGradient>
        <radialGradient id={`${uid}-glow`} cx="50%" cy="85%" r="50%">
          <stop offset="0%" stopColor={bg.glow} stopOpacity="0.55" />
          <stop offset="100%" stopColor={bg.glow} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${uid}-top`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={lighten(config.topColor, 0.15)} />
          <stop offset="100%" stopColor={darken(config.topColor, 0.35)} />
        </linearGradient>
      </defs>

      {showBackground ? (
        <>
          <rect width="200" height="320" rx="18" fill={`url(#${uid}-bg)`} />
          <rect width="200" height="320" rx="18" fill={`url(#${uid}-glow)`} />
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
          <ellipse cx="100" cy="292" rx="70" ry="10" fill={bg.glow} opacity="0.35" />
          <ellipse cx="100" cy="292" rx="52" ry="6" fill="none" stroke={bg.glow} strokeOpacity="0.7" strokeWidth="1.5" />
        </>
      ) : null}

      <g transform={`translate(100 0) scale(${widthScale} 1) translate(-100 0)`}>
        {/* back accessories */}
        {config.accessory === "headset" ? <path d="M62 92 Q100 55 138 92" stroke="#0f172a" strokeWidth="7" fill="none" /> : null}

        {/* legs */}
        <rect x="76" y="196" width="20" height="70" rx="6" fill={config.bottomColor} />
        <rect x="104" y="196" width="20" height="70" rx="6" fill={config.bottomColor} />
        <rect x="76" y="196" width="20" height="70" rx="6" fill="#000" opacity="0.12" />
        {/* shoes */}
        <path d="M70 262 h30 a6 6 0 0 1 6 6 v8 h-40 a4 4 0 0 1 -4 -4 v-4 a6 6 0 0 1 6 -6 z" fill={config.shoeColor} />
        <path d="M100 262 h30 a6 6 0 0 1 6 6 v4 a4 4 0 0 1 -4 4 h-40 v-8 a6 6 0 0 1 6 -6 z" fill={darken(config.shoeColor, 0.2)} />
        <rect x="66" y="272" width="74" height="3" fill={config.accent} opacity="0.9" />

        {/* torso */}
        <path d="M60 118 q40 -18 80 0 l8 84 q-48 10 -96 0 z" fill={`url(#${uid}-top)`} />
        <path d="M100 112 l-6 12 h12 z" fill={config.accent} />
        <path d="M92 150 l8 -12 l8 12 l-8 14 z" fill={config.accent} opacity="0.95" />
        {/* arms */}
        <path d="M60 122 q-16 30 -12 70 q8 4 14 -2 q0 -34 8 -60 z" fill={darken(config.topColor, 0.2)} />
        <path d="M140 122 q16 30 12 70 q-8 4 -14 -2 q0 -34 -8 -60 z" fill={darken(config.topColor, 0.2)} />
        <circle cx="53" cy="194" r="7" fill={config.skin} />
        <circle cx="147" cy="194" r="7" fill={config.skin} />

        {/* neck + head */}
        <rect x="90" y="96" width="20" height="22" fill={skinShade} />
        <path d="M70 66 q0 -34 30 -34 q30 0 30 34 v22 q0 26 -30 28 q-30 -2 -30 -28 z" fill={config.skin} />
        <path d="M70 80 q0 24 30 32 q30 -8 30 -32 v10 q0 24 -30 26 q-30 -2 -30 -26 z" fill={skinShade} opacity="0.35" />

        {/* eyes */}
        {config.eyes === "visor" ? (
          <rect x="74" y="66" width="52" height="12" rx="4" fill={config.eyeColor} opacity="0.9" />
        ) : (
          <g>
            {config.eyes === "round" ? (
              <>
                <circle cx="88" cy="72" r="4.5" fill="#fff" />
                <circle cx="112" cy="72" r="4.5" fill="#fff" />
                <circle cx="88" cy="72" r="2.4" fill={config.eyeColor} />
                <circle cx="112" cy="72" r="2.4" fill={config.eyeColor} />
              </>
            ) : config.eyes === "calm" ? (
              <>
                <path d="M82 73 q6 -4 12 0" stroke="#111" strokeWidth="2" fill="none" />
                <path d="M106 73 q6 -4 12 0" stroke="#111" strokeWidth="2" fill="none" />
              </>
            ) : (
              <>
                <path d="M80 70 l14 -1 l0 6 l-13 -1 z" fill="#fff" />
                <path d="M106 69 l14 1 l-1 4 l-13 1 z" fill="#fff" />
                <circle cx="89" cy="72" r="2.2" fill={config.eyeColor} />
                <circle cx="111" cy="72" r="2.2" fill={config.eyeColor} />
                <path d="M79 67 l16 -2" stroke={hairShade} strokeWidth="2.2" />
                <path d="M105 65 l16 2" stroke={hairShade} strokeWidth="2.2" />
              </>
            )}
          </g>
        )}

        {/* mouth */}
        {config.face === "grin" ? (
          <path d="M88 88 q12 10 24 0" stroke="#3b1d12" strokeWidth="2.2" fill="#fff" />
        ) : config.face === "smirk" ? (
          <path d="M92 89 q10 4 18 -3" stroke="#3b1d12" strokeWidth="2" fill="none" />
        ) : config.face === "neutral" ? (
          <path d="M92 89 h16" stroke="#3b1d12" strokeWidth="2" />
        ) : (
          <path d="M92 90 q8 -3 16 0" stroke="#3b1d12" strokeWidth="2" fill="none" />
        )}

        {/* hair */}
        {config.hair === "none" ? null : config.hair === "buzz" ? (
          <path d="M70 62 q0 -28 30 -28 q30 0 30 28 v6 q-30 -10 -60 0 z" fill={config.hairColor} opacity="0.85" />
        ) : config.hair === "fade" ? (
          <path d="M70 64 q0 -30 30 -30 q30 0 30 30 v4 q-30 -12 -60 0 z" fill={config.hairColor} />
        ) : config.hair === "bun" ? (
          <>
            <path d="M70 64 q0 -30 30 -30 q30 0 30 30 v4 q-30 -12 -60 0 z" fill={config.hairColor} />
            <circle cx="100" cy="30" r={8 + hairLen * 6} fill={config.hairColor} />
          </>
        ) : config.hair === "mohawk" ? (
          <>
            <path d="M74 62 q6 -14 26 -16 q20 2 26 16 q-26 -6 -52 0 z" fill={hairShade} />
            <path d={`M92 40 l8 -${18 + hairLen * 22} l8 ${18 + hairLen * 22} q-8 -6 -16 0 z`} fill={config.hairColor} />
          </>
        ) : config.hair === "curls" ? (
          <g fill={config.hairColor}>
            <circle cx="76" cy="52" r="10" />
            <circle cx="90" cy="40" r="11" />
            <circle cx="110" cy="40" r="11" />
            <circle cx="124" cy="52" r="10" />
            <circle cx="100" cy="34" r="10" />
            <circle cx="70" cy={66 + hairLen * 10} r={6 + hairLen * 6} />
            <circle cx="130" cy={66 + hairLen * 10} r={6 + hairLen * 6} />
          </g>
        ) : config.hair === "long" ? (
          <>
            <path d="M70 66 q0 -34 30 -34 q30 0 30 34 v6 q-30 -12 -60 0 z" fill={config.hairColor} />
            <path d={`M70 64 q-8 ${30 + hairLen * 50} 2 ${60 + hairLen * 70} l14 -6 q-6 -40 -4 -60 z`} fill={hairShade} />
            <path d={`M130 64 q8 ${30 + hairLen * 50} -2 ${60 + hairLen * 70} l-14 -6 q6 -40 4 -60 z`} fill={hairShade} />
          </>
        ) : (
          <g fill={config.hairColor}>
            <path d="M70 66 q0 -34 30 -34 q30 0 30 34 v4 q-30 -14 -60 0 z" />
            <path d={`M72 52 l-10 -${10 + hairLen * 18} l18 8 z`} />
            <path d={`M88 42 l-4 -${18 + hairLen * 22} l14 14 z`} />
            <path d={`M104 38 l4 -${20 + hairLen * 24} l10 20 z`} />
            <path d={`M120 46 l14 -${12 + hairLen * 18} l-2 20 z`} />
            <path d="M80 60 q20 -10 40 0" fill={lighten(config.hairColor, 0.3)} opacity="0.6" />
          </g>
        )}

        {/* front accessories */}
        {config.accessory === "shades" ? (
          <g>
            <rect x="76" y="66" width="20" height="11" rx="3" fill="#0b0f19" />
            <rect x="104" y="66" width="20" height="11" rx="3" fill="#0b0f19" />
            <path d="M96 71 h8" stroke="#0b0f19" strokeWidth="2" />
            <rect x="78" y="68" width="8" height="3" fill={config.accent} opacity="0.6" />
          </g>
        ) : config.accessory === "mask" ? (
          <path d="M72 82 q28 20 56 0 v14 q-28 12 -56 0 z" fill="#0b0f19" />
        ) : config.accessory === "bandana" ? (
          <path d="M70 60 q30 -8 60 0 v6 q-30 -6 -60 0 z" fill={config.accent} />
        ) : config.accessory === "headset" ? (
          <>
            <rect x="60" y="80" width="10" height="16" rx="4" fill="#0f172a" />
            <rect x="130" y="80" width="10" height="16" rx="4" fill="#0f172a" />
            <path d="M65 94 q-6 14 10 16" stroke="#0f172a" strokeWidth="3" fill="none" />
            <circle cx="76" cy="110" r="2.5" fill={config.accent} />
          </>
        ) : null}
      </g>
    </svg>
  );
}
