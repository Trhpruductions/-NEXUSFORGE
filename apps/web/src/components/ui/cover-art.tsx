import { useId } from "react";

// Generated cover art for anything that has no uploaded banner (forges, events,
// profiles). Same seed -> same picture, so a forge keeps its look everywhere.
// Every palette is gold-accented to stay on brand; the second hue varies.

type Palette = { base: string; deep: string; glow: string; accent: string };

const PALETTES: Palette[] = [
  { base: "#1a1406", deep: "#07060a", glow: "#2ea4ff", accent: "#9fd8ff" }, // forge gold
  { base: "#1b0d08", deep: "#08050a", glow: "#f07a2a", accent: "#2ea4ff" }, // ember
  { base: "#06171a", deep: "#04080c", glow: "#22b8c7", accent: "#2ea4ff" }, // teal
  { base: "#120a1f", deep: "#06040c", glow: "#8b5cf6", accent: "#2ea4ff" }, // violet
  { base: "#1c0a0e", deep: "#08040a", glow: "#e0435e", accent: "#9fd8ff" }, // crimson
  { base: "#0a1220", deep: "#04060c", glow: "#3b82f6", accent: "#2ea4ff" }, // cobalt
];

function hash(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Small deterministic PRNG so the shapes are stable across renders.
function rng(seed: number) {
  let s = seed || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 10000) / 10000;
  };
}

export function coverPalette(seed: string): Palette {
  return PALETTES[hash(seed) % PALETTES.length];
}

type CoverArtProps = {
  seed: string;
  className?: string;
  /** "shards" suits forges/events, "rings" suits profiles; default picks from the seed. */
  variant?: "shards" | "rings" | "grid";
};

export function CoverArt({ seed, className = "", variant }: CoverArtProps) {
  const uid = useId().replace(/:/g, "");
  const h = hash(seed);
  const p = PALETTES[h % PALETTES.length];
  const rand = rng(h);
  const kind = variant ?? (["shards", "rings", "grid"] as const)[(h >>> 8) % 3];
  const gx = 20 + rand() * 60;
  const gy = 20 + rand() * 50;

  const shards = Array.from({ length: 7 }, (_, i) => {
    const x = rand() * 400;
    const w = 30 + rand() * 90;
    const tilt = (rand() - 0.5) * 120;
    return { x, w, tilt, o: 0.06 + rand() * 0.16, gold: i % 3 === 0 };
  });
  const stars = Array.from({ length: 26 }, () => ({ x: rand() * 400, y: rand() * 200, r: rand() * 1.2 + 0.2, o: rand() * 0.7 + 0.2 }));

  return (
    <svg
      className={className}
      viewBox="0 0 400 200"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
      role="presentation"
    >
      <defs>
        <linearGradient id={`bg${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={p.base} />
          <stop offset="1" stopColor={p.deep} />
        </linearGradient>
        <radialGradient id={`gl${uid}`} cx={`${gx}%`} cy={`${gy}%`} r="65%">
          <stop offset="0" stopColor={p.glow} stopOpacity="0.55" />
          <stop offset="0.45" stopColor={p.glow} stopOpacity="0.12" />
          <stop offset="1" stopColor={p.glow} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`sh${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={p.accent} stopOpacity="0.9" />
          <stop offset="1" stopColor={p.accent} stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`fade${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0.55" stopColor="#000" stopOpacity="0" />
          <stop offset="1" stopColor="#000" stopOpacity="0.55" />
        </linearGradient>
      </defs>

      <rect width="400" height="200" fill={`url(#bg${uid})`} />
      <rect width="400" height="200" fill={`url(#gl${uid})`} />

      {stars.map((s, i) => (
        <circle key={i} cx={s.x} cy={s.y} r={s.r} fill="#fff" opacity={s.o * 0.6} />
      ))}

      {kind === "shards"
        ? shards.map((s, i) => (
            <polygon
              key={i}
              points={`${s.x},-10 ${s.x + s.w},-10 ${s.x + s.w / 2 + s.tilt},210`}
              fill={s.gold ? `url(#sh${uid})` : p.glow}
              opacity={s.o}
            />
          ))
        : null}

      {kind === "rings"
        ? [0, 1, 2, 3, 4].map((i) => (
            <circle
              key={i}
              cx={gx * 4}
              cy={gy * 2}
              r={30 + i * 34}
              fill="none"
              stroke={i % 2 ? p.glow : p.accent}
              strokeOpacity={0.28 - i * 0.04}
              strokeWidth={i === 0 ? 2 : 1}
            />
          ))
        : null}

      {kind === "grid" ? (
        <g stroke={p.accent} strokeOpacity="0.1" strokeWidth="1">
          {Array.from({ length: 11 }, (_, i) => (
            <line key={`v${i}`} x1={i * 40} y1="0" x2={200 + (i * 40 - 200) * 1.8} y2="200" />
          ))}
          {Array.from({ length: 6 }, (_, i) => (
            <line key={`h${i}`} x1="0" y1={90 + i * i * 4} x2="400" y2={90 + i * i * 4} />
          ))}
        </g>
      ) : null}

      {/* Brand chevron, low key, so every cover reads as Nexus Forge. */}
      <path
        d={`M${gx * 4 - 46} ${gy * 2 - 30} L${gx * 4} ${gy * 2 + 34} L${gx * 4 + 46} ${gy * 2 - 30} L${gx * 4 + 26} ${gy * 2 - 30} L${gx * 4} ${gy * 2 + 6} L${gx * 4 - 26} ${gy * 2 - 30} Z`}
        fill={p.accent}
        opacity="0.16"
      />
      <line x1="0" y1="199" x2="400" y2="199" stroke={p.accent} strokeOpacity="0.35" />
      <rect width="400" height="200" fill={`url(#fade${uid})`} />
    </svg>
  );
}
