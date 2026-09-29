"use client";

import type { CosmeticSlot } from "@/lib/api";

/**
 * Artwork for equipped cosmetics, drawn straight onto the avatar in its own 200x320
 * coordinate space (see AvatarRenderer). Each item key gets its own shape so gear is
 * recognisable at thumbnail size as well as in the studio.
 *
 * Anything unknown falls back to a plain tinted shape for its slot, so a newly seeded
 * item still shows up on the character instead of vanishing.
 */

export type EquippedCosmetic = {
  slot: CosmeticSlot;
  key: string;
  name: string;
  color?: string | null;
  metadata?: { accent?: string } | null;
};

const TORSO = "M60 118 q40 -18 80 0 l8 84 q-48 10 -96 0 z";
const SHOE_LEFT = "M70 262 h30 a6 6 0 0 1 6 6 v8 h-40 a4 4 0 0 1 -4 -4 v-4 a6 6 0 0 1 6 -6 z";
const SHOE_RIGHT = "M100 262 h30 a6 6 0 0 1 6 6 v4 a4 4 0 0 1 -4 4 h-40 v-8 a6 6 0 0 1 6 -6 z";

function parse(hex: string): [number, number, number] {
  const value = hex.replace("#", "");
  if (value.length !== 6) return [120, 120, 120];
  return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16)) as [number, number, number];
}

function toHex(channels: [number, number, number]) {
  return `#${channels.map((c) => Math.max(0, Math.min(255, Math.round(c))).toString(16).padStart(2, "0")).join("")}`;
}

function lighten(hex: string, amount: number) {
  return toHex(parse(hex).map((c) => c + (255 - c) * amount) as [number, number, number]);
}

function darken(hex: string, amount: number) {
  return toHex(parse(hex).map((c) => c * (1 - amount)) as [number, number, number]);
}

function colorOf(item: EquippedCosmetic, fallback: string) {
  return item.color || fallback;
}

function accentOf(item: EquippedCosmetic, fallback: string) {
  return item.metadata?.accent || fallback;
}

/** Drawn behind the body: packs and wings sit under the torso. */
export function CosmeticBackLayer({ item, accent }: { item: EquippedCosmetic; accent: string }) {
  const base = colorOf(item, "#0f172a");
  const glow = accentOf(item, accent);

  if (item.key === "back-flux-wings") {
    return (
      <g opacity="0.95">
        <path d="M66 128 q-40 -16 -52 18 q26 -6 34 10 q-22 6 -26 28 q30 -10 48 -22 z" fill={base} opacity="0.85" />
        <path d="M134 128 q40 -16 52 18 q-26 -6 -34 10 q22 6 26 28 q-30 -10 -48 -22 z" fill={base} opacity="0.85" />
        <path d="M66 128 q-34 -12 -44 16" stroke={lighten(glow, 0.4)} strokeWidth="2" fill="none" />
        <path d="M134 128 q34 -12 44 16" stroke={lighten(glow, 0.4)} strokeWidth="2" fill="none" />
        <path d="M62 152 q-22 2 -30 20" stroke={lighten(glow, 0.5)} strokeWidth="1.6" fill="none" opacity="0.8" />
        <path d="M138 152 q22 2 30 20" stroke={lighten(glow, 0.5)} strokeWidth="1.6" fill="none" opacity="0.8" />
      </g>
    );
  }

  if (item.key === "back-neon-backpack") {
    return (
      <g>
        <rect x="68" y="124" width="64" height="72" rx="12" fill={darken(base, 0.15)} />
        <rect x="76" y="136" width="48" height="26" rx="6" fill={lighten(base, 0.12)} />
        <rect x="76" y="168" width="48" height="6" rx="3" fill={glow} opacity="0.9" />
        <rect x="90" y="182" width="20" height="8" rx="3" fill={glow} opacity="0.55" />
      </g>
    );
  }

  return <rect x="70" y="126" width="60" height="66" rx="12" fill={darken(base, 0.1)} />;
}

/** Straps and trim that belong in front of the torso for back-slot gear. */
export function CosmeticBackStraps({ item, accent }: { item: EquippedCosmetic; accent: string }) {
  if (item.key !== "back-neon-backpack") return null;
  const glow = accentOf(item, accent);
  return (
    <g>
      <path d="M80 120 q-4 40 -2 70" stroke={darken(colorOf(item, "#0f172a"), 0.25)} strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M120 120 q4 40 2 70" stroke={darken(colorOf(item, "#0f172a"), 0.25)} strokeWidth="7" fill="none" strokeLinecap="round" />
      <path d="M80 120 q-4 40 -2 70" stroke={glow} strokeWidth="1.6" fill="none" opacity="0.8" />
      <path d="M120 120 q4 40 2 70" stroke={glow} strokeWidth="1.6" fill="none" opacity="0.8" />
    </g>
  );
}

export function CosmeticTopLayer({ item, accent }: { item: EquippedCosmetic; accent: string }) {
  const base = colorOf(item, "#334155");
  const glow = accentOf(item, accent);
  const shade = darken(base, 0.3);

  return (
    <g>
      <path d={TORSO} fill={base} />
      <path d="M60 122 q-16 30 -12 70 q8 4 14 -2 q0 -34 8 -60 z" fill={shade} />
      <path d="M140 122 q16 30 12 70 q-8 4 -14 -2 q0 -34 -8 -60 z" fill={shade} />

      {item.key === "top-esports-jersey" ? (
        <>
          <path d="M84 118 q16 12 32 0 l-6 -6 q-10 6 -20 0 z" fill={lighten(base, 0.25)} />
          <path d="M70 126 l-6 66" stroke={glow} strokeWidth="3" opacity="0.9" />
          <path d="M130 126 l6 66" stroke={glow} strokeWidth="3" opacity="0.9" />
          <text x="100" y="178" textAnchor="middle" fontSize="30" fontWeight="700" fill={lighten(base, 0.55)} opacity="0.9">
            7
          </text>
        </>
      ) : item.key === "top-vexora-hoodie" ? (
        <>
          <path d="M74 116 q26 22 52 0 q4 12 -6 18 q-20 12 -40 0 q-10 -6 -6 -18 z" fill={lighten(base, 0.14)} />
          <path d="M92 134 v16" stroke={glow} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M108 134 v16" stroke={glow} strokeWidth="2.5" strokeLinecap="round" />
          <rect x="80" y="168" width="40" height="22" rx="7" fill={darken(base, 0.35)} />
          <path d="M100 148 l-7 12 h14 z" fill={glow} opacity="0.95" />
        </>
      ) : item.key === "top-neon-drift-jacket" ? (
        <>
          <path d="M92 118 l-8 84 h-24 l-8 -84 q20 -14 40 0 z" fill={darken(base, 0.18)} />
          <path d="M108 118 l8 84 h24 l8 -84 q-20 -14 -40 0 z" fill={darken(base, 0.18)} />
          <path d="M96 118 l4 86 l4 -86 q-4 -3 -8 0 z" fill={lighten(base, 0.45)} />
          <path d="M64 140 q36 10 72 0" stroke={glow} strokeWidth="2.5" fill="none" opacity="0.95" />
          <path d="M66 156 q34 9 68 0" stroke={glow} strokeWidth="1.6" fill="none" opacity="0.7" />
          <path d="M56 150 q-6 22 -4 40" stroke={glow} strokeWidth="2" fill="none" opacity="0.85" />
          <path d="M144 150 q6 22 4 40" stroke={glow} strokeWidth="2" fill="none" opacity="0.85" />
        </>
      ) : (
        <>
          <path d="M86 118 q14 10 28 0 l-5 -5 q-9 5 -18 0 z" fill={lighten(base, 0.3)} />
          <path d="M100 138 l-7 12 h14 z" fill={glow} opacity="0.9" />
        </>
      )}
    </g>
  );
}

export function CosmeticBottomLayer({ item, accent }: { item: EquippedCosmetic; accent: string }) {
  const base = colorOf(item, "#1f2937");
  const glow = accentOf(item, accent);

  return (
    <g>
      <rect x="76" y="196" width="20" height="70" rx="6" fill={base} />
      <rect x="104" y="196" width="20" height="70" rx="6" fill={base} />
      <rect x="76" y="196" width="20" height="70" rx="6" fill="#000" opacity="0.12" />

      {item.key === "bottom-track-pants" ? (
        <>
          <rect x="78" y="200" width="3" height="62" fill={glow} opacity="0.9" />
          <rect x="119" y="200" width="3" height="62" fill={glow} opacity="0.9" />
        </>
      ) : item.key === "bottom-tactical-pants" ? (
        <>
          <rect x="78" y="216" width="14" height="14" rx="3" fill={darken(base, 0.35)} />
          <rect x="108" y="216" width="14" height="14" rx="3" fill={darken(base, 0.35)} />
          <rect x="76" y="240" width="20" height="4" fill={darken(base, 0.45)} />
          <rect x="104" y="240" width="20" height="4" fill={darken(base, 0.45)} />
        </>
      ) : item.key === "bottom-armored-legs" ? (
        <>
          <path d="M76 206 h20 v16 l-20 4 z" fill={lighten(base, 0.22)} />
          <path d="M104 206 h20 v20 l-20 -4 z" fill={lighten(base, 0.22)} />
          <rect x="76" y="232" width="20" height="10" rx="3" fill={lighten(base, 0.12)} />
          <rect x="104" y="232" width="20" height="10" rx="3" fill={lighten(base, 0.12)} />
          <rect x="78" y="250" width="16" height="3" fill={glow} opacity="0.8" />
          <rect x="106" y="250" width="16" height="3" fill={glow} opacity="0.8" />
        </>
      ) : null}
    </g>
  );
}

export function CosmeticShoesLayer({ item, accent }: { item: EquippedCosmetic; accent: string }) {
  const base = colorOf(item, "#e2e8f0");
  const glow = accentOf(item, accent);

  return (
    <g>
      <path d={SHOE_LEFT} fill={base} />
      <path d={SHOE_RIGHT} fill={darken(base, 0.2)} />
      <rect x="66" y="272" width="74" height="3" fill={glow} opacity="0.9" />

      {item.key === "shoes-gold-runners" ? (
        <>
          <path d="M72 268 q14 -5 26 2" stroke={lighten(base, 0.5)} strokeWidth="2" fill="none" />
          <path d="M104 270 q14 -5 26 2" stroke={lighten(base, 0.5)} strokeWidth="2" fill="none" />
        </>
      ) : item.key === "shoes-galaxy" ? (
        <g fill={lighten(glow, 0.5)}>
          <circle cx="78" cy="268" r="1.4" />
          <circle cx="90" cy="271" r="1" />
          <circle cx="112" cy="268" r="1.4" />
          <circle cx="126" cy="271" r="1" />
        </g>
      ) : item.key === "shoes-court-classic" ? (
        <>
          <rect x="66" y="270" width="74" height="2" fill={darken(base, 0.35)} />
          <path d="M84 264 v8" stroke={darken(base, 0.3)} strokeWidth="1.5" />
          <path d="M116 264 v8" stroke={darken(base, 0.3)} strokeWidth="1.5" />
        </>
      ) : null}
    </g>
  );
}

/** Hats and helmets, drawn over the hair. */
export function CosmeticHeadLayer({ item, accent }: { item: EquippedCosmetic; accent: string }) {
  const base = colorOf(item, "#0b0f19");
  const glow = accentOf(item, accent);

  if (item.key === "head-crown") {
    return (
      <g>
        <path d="M74 38 l8 -20 l9 12 l9 -18 l9 18 l9 -12 l8 20 z" fill={base} />
        <rect x="74" y="36" width="52" height="8" rx="3" fill={darken(base, 0.2)} />
        <circle cx="100" cy="24" r="3" fill={lighten(glow, 0.45)} />
        <circle cx="83" cy="30" r="2.2" fill={lighten(glow, 0.3)} />
        <circle cx="117" cy="30" r="2.2" fill={lighten(glow, 0.3)} />
      </g>
    );
  }

  if (item.key === "head-snapback") {
    return (
      <g>
        <path d="M70 52 q0 -28 30 -28 q30 0 30 28 v4 q-30 -10 -60 0 z" fill={base} />
        <path d="M128 52 q22 2 26 12 q-24 6 -26 -4 z" fill={darken(base, 0.25)} />
        <path d="M70 50 h60" stroke={glow} strokeWidth="2" opacity="0.9" />
        <path d="M100 30 l-5 10 h10 z" fill={glow} />
      </g>
    );
  }

  if (item.key === "head-rogue-mask") {
    return (
      <g>
        <path d="M70 58 q30 -12 60 0 v18 q-30 10 -60 0 z" fill={base} />
        <rect x="78" y="64" width="18" height="7" rx="3" fill={glow} opacity="0.95" />
        <rect x="104" y="64" width="18" height="7" rx="3" fill={glow} opacity="0.95" />
        <path d="M70 76 q30 8 60 0" stroke={darken(base, 0.4)} strokeWidth="2" fill="none" />
      </g>
    );
  }

  return (
    <g>
      <path d="M70 54 q0 -26 30 -26 q30 0 30 26 v4 q-30 -10 -60 0 z" fill={base} />
      <path d="M70 52 h60" stroke={glow} strokeWidth="2" opacity="0.8" />
    </g>
  );
}

/** Paint, lenses and masks that sit on the face. */
export function CosmeticFaceLayer({ item, accent }: { item: EquippedCosmetic; accent: string }) {
  const base = colorOf(item, "#dc2626");
  const glow = accentOf(item, accent);

  if (item.key === "face-war-paint") {
    return (
      <g fill={base} opacity="0.88">
        <path d="M74 76 q10 -3 18 2 l-1 5 q-9 -5 -18 -2 z" />
        <path d="M74 85 q10 -3 18 2 l-1 5 q-9 -5 -18 -2 z" />
        <path d="M126 76 q-10 -3 -18 2 l1 5 q9 -5 18 -2 z" />
        <path d="M126 85 q-10 -3 -18 2 l1 5 q9 -5 18 -2 z" />
      </g>
    );
  }

  if (item.key === "face-cyber-shades") {
    return (
      <g>
        <path d="M72 64 q28 -6 56 0 v12 q-28 8 -56 0 z" fill={darken(base, 0.55)} />
        <path d="M75 66 q25 -5 50 0 v8 q-25 6 -50 0 z" fill={base} opacity="0.92" />
        <path d="M78 68 q22 -4 44 0" stroke={lighten(glow, 0.6)} strokeWidth="1.6" fill="none" opacity="0.85" />
        <path d="M68 68 h6" stroke={darken(base, 0.6)} strokeWidth="3" />
        <path d="M126 68 h6" stroke={darken(base, 0.6)} strokeWidth="3" />
      </g>
    );
  }

  return <path d="M72 82 q28 18 56 0 v12 q-28 12 -56 0 z" fill={base} opacity="0.9" />;
}

export function CosmeticAccessoryLayer({ item, accent }: { item: EquippedCosmetic; accent: string }) {
  const base = colorOf(item, "#1e293b");
  const glow = accentOf(item, accent);

  if (item.key === "acc-headset") {
    return (
      <g>
        <path d="M62 92 Q100 55 138 92" stroke={darken(base, 0.2)} strokeWidth="7" fill="none" />
        <rect x="58" y="80" width="11" height="18" rx="4" fill={base} />
        <rect x="131" y="80" width="11" height="18" rx="4" fill={base} />
        <path d="M64 96 q-7 15 10 18" stroke={base} strokeWidth="3" fill="none" />
        <circle cx="76" cy="114" r="2.6" fill={glow} />
        <rect x="60" y="86" width="3" height="7" rx="1.5" fill={glow} opacity="0.9" />
      </g>
    );
  }

  if (item.key === "acc-chain") {
    return (
      <g>
        <path d="M86 118 q14 20 28 0" stroke={base} strokeWidth="3.5" fill="none" />
        <path d="M86 118 q14 20 28 0" stroke={lighten(base, 0.45)} strokeWidth="1.4" fill="none" />
        <circle cx="100" cy="132" r="4.5" fill={base} />
        <circle cx="100" cy="132" r="2" fill={lighten(glow, 0.5)} />
      </g>
    );
  }

  return <circle cx="100" cy="130" r="5" fill={base} />;
}

/**
 * Turn an inventory payload into the gear list the renderer draws. Emotes are animations
 * rather than worn items, so they are left out.
 */
export function equippedFrom(
  items: Array<{ id: string; key: string; name: string; slot: CosmeticSlot; color?: string | null; metadata?: { accent?: string } | null }> | undefined,
  loadout: Partial<Record<CosmeticSlot, string>> | undefined,
): EquippedCosmetic[] {
  if (!items?.length || !loadout) return [];
  const byId = new Map(items.map((item) => [item.id, item]));
  return (Object.entries(loadout) as Array<[CosmeticSlot, string | undefined]>)
    .filter(([slot, id]) => slot !== "EMOTE" && Boolean(id))
    .map(([, id]) => byId.get(id as string))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => ({ slot: item.slot, key: item.key, name: item.name, color: item.color, metadata: item.metadata }));
}
