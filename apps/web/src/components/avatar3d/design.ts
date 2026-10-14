/**
 * The customisation model for the Nexus Forge 3D avatar: option lists, the saved design shape,
 * and applyDesign, which changes a loaded character to match a design.
 *
 * Adding a new option means adding its id here and a node named Top_<id>, Hair_<id>, Bottom_<id>,
 * Shoes_<id> or Acc_<id> to base-model.ts. The viewer and the saved data pick it up from here.
 */

export const BODY_TYPES = ["slim", "athletic", "broad"] as const;
export type BodyType = (typeof BODY_TYPES)[number];

export const HAIR_STYLES = ["none", "buzz", "spiky", "long", "curls", "bun", "mohawk"] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];

export const TOPS = ["tee", "hoodie", "jacket"] as const;
export type Top = (typeof TOPS)[number];

export const BOTTOMS = ["jeans", "cargo", "track"] as const;
export type Bottom = (typeof BOTTOMS)[number];

export const SHOES = ["sneakers", "boots"] as const;
export type Shoe = (typeof SHOES)[number];

export const ACCESSORIES = ["cap", "chain", "shades", "mask", "headset", "bandana"] as const;
export type Accessory = (typeof ACCESSORIES)[number];

export const EYE_STYLES = ["round", "sharp", "calm"] as const;
export type EyeStyle = (typeof EYE_STYLES)[number];

export const MATERIAL_STYLES = ["matte", "satin", "gloss", "metallic"] as const;
export type MaterialStyle = (typeof MATERIAL_STYLES)[number];

/** Labels for the pickers. Kept beside the ids so the UI and the data never drift apart. */
export const LABELS: Record<string, string> = {
  none: "None",
  buzz: "Buzz",
  spiky: "Spiky",
  long: "Long wave",
  curls: "Curls",
  bun: "Bun",
  mohawk: "Mohawk",
  tee: "Tee",
  hoodie: "Hoodie",
  jacket: "Jacket",
  jeans: "Slim",
  cargo: "Cargo",
  track: "Track",
  sneakers: "Sneakers",
  boots: "Boots",
  cap: "Cap",
  chain: "Chain",
  shades: "Shades",
  mask: "Mask",
  headset: "Headset",
  bandana: "Bandana",
  round: "Round",
  sharp: "Sharp",
  calm: "Calm",
  matte: "Matte",
  satin: "Satin",
  gloss: "Gloss",
  metallic: "Metallic",
  slim: "Slim",
  athletic: "Athletic",
  broad: "Broad",
};

export const MATERIAL_FINISH: Record<MaterialStyle, { roughness: number; metalness: number }> = {
  matte: { roughness: 0.92, metalness: 0 },
  satin: { roughness: 0.55, metalness: 0 },
  gloss: { roughness: 0.22, metalness: 0.05 },
  metallic: { roughness: 0.3, metalness: 0.8 },
};

/** Colours offered in every colour picker. */
export const PALETTE = ["#1b1e26", "#f8fafc", "#94a3b8", "#1d4ed8", "#2ea4ff", "#22d3ee", "#7f1d1d", "#ef4444", "#f59e0b", "#22c55e", "#a855f7", "#f472b6", "#111318", "#78350f"] as const;
export const SKIN_TONES = ["#f5d0b0", "#e8b894", "#d9a577", "#c48a5a", "#a66a3f", "#7a4a2b", "#5b3520", "#3f2417"] as const;

export type AvatarDesign = {
  version: 1;
  body: BodyType;
  skin: string;
  hair: HairStyle;
  hairColor: string;
  eyeColor: string;
  eyeStyle: EyeStyle;
  top: Top;
  topColor: string;
  bottom: Bottom;
  bottomColor: string;
  shoes: Shoe;
  shoeColor: string;
  accessories: Accessory[];
  accent: string;
  material: MaterialStyle;
};

export const DEFAULT_DESIGN: AvatarDesign = {
  version: 1,
  body: "athletic",
  skin: "#d9a577",
  hair: "spiky",
  hairColor: "#22d3ee",
  eyeColor: "#38bdf8",
  eyeStyle: "round",
  top: "tee",
  topColor: "#1b1e26",
  bottom: "jeans",
  bottomColor: "#1d2029",
  shoes: "sneakers",
  shoeColor: "#111318",
  accessories: [],
  accent: "#2ea4ff",
  material: "satin",
};

/** Makes a design safe to use: unknown or missing fields fall back to the defaults. */
export function normaliseDesign(value: unknown): AvatarDesign {
  const input = (value && typeof value === "object" ? value : {}) as Partial<Record<keyof AvatarDesign, unknown>>;
  const pick = <T extends string>(list: readonly T[], candidate: unknown, fallback: T): T =>
    (list as readonly string[]).includes(candidate as string) ? (candidate as T) : fallback;
  const hex = (candidate: unknown, fallback: string) => (typeof candidate === "string" && /^#[0-9a-f]{6}$/i.test(candidate) ? candidate : fallback);
  const accessories = Array.isArray(input.accessories)
    ? (input.accessories.filter((a) => (ACCESSORIES as readonly string[]).includes(a as string)) as Accessory[])
    : DEFAULT_DESIGN.accessories;
  return {
    version: 1,
    body: pick(BODY_TYPES, input.body, DEFAULT_DESIGN.body),
    skin: hex(input.skin, DEFAULT_DESIGN.skin),
    hair: pick(HAIR_STYLES, input.hair, DEFAULT_DESIGN.hair),
    hairColor: hex(input.hairColor, DEFAULT_DESIGN.hairColor),
    eyeColor: hex(input.eyeColor, DEFAULT_DESIGN.eyeColor),
    eyeStyle: pick(EYE_STYLES, input.eyeStyle, DEFAULT_DESIGN.eyeStyle),
    top: pick(TOPS, input.top, DEFAULT_DESIGN.top),
    topColor: hex(input.topColor, DEFAULT_DESIGN.topColor),
    bottom: pick(BOTTOMS, input.bottom, DEFAULT_DESIGN.bottom),
    bottomColor: hex(input.bottomColor, DEFAULT_DESIGN.bottomColor),
    shoes: pick(SHOES, input.shoes, DEFAULT_DESIGN.shoes),
    shoeColor: hex(input.shoeColor, DEFAULT_DESIGN.shoeColor),
    accessories,
    accent: hex(input.accent, DEFAULT_DESIGN.accent),
    material: pick(MATERIAL_STYLES, input.material, DEFAULT_DESIGN.material),
  };
}

/** The GLB file that holds the chosen body size. */
export function modelUrlFor(body: BodyType) {
  return `/avatar-models/base-${body}.glb`;
}

type Material = { name: string; color: { set: (hex: string) => unknown }; roughness: number; metalness: number };
type Node = { name: string; visible: boolean; scale: { set: (x: number, y: number, z: number) => unknown }; traverse: (fn: (node: Node & { material?: Material | Material[] }) => void) => void };

/**
 * Makes a loaded character match a design. Works on any three.js object tree built from the
 * base model (the same code path for the live viewer and the renders), so it is cheap to call on
 * every change.
 */
export function applyDesign(root: Node, design: AvatarDesign) {
  const colours: Record<string, string> = {
    Skin: design.skin,
    Hair: design.hairColor,
    Eyes: design.eyeColor,
    Suit: design.topColor,
    Pants: design.bottomColor,
    Shoes: design.shoeColor,
    Accent: design.accent,
  };
  const finish = MATERIAL_FINISH[design.material];
  const eyeScale: Record<EyeStyle, [number, number, number]> = { round: [1.25, 1.25, 1.25], sharp: [1.1, 0.7, 1], calm: [1, 0.55, 1] };

  root.traverse((node) => {
    const name = node.name || "";
    const option = name.split("_")[1];
    if (name.startsWith("Hair_")) node.visible = option === design.hair;
    else if (name.startsWith("Top_")) node.visible = option === design.top;
    else if (name.startsWith("Bottom_")) node.visible = option === design.bottom;
    else if (name.startsWith("Shoes_")) node.visible = option === design.shoes;
    else if (name.startsWith("Acc_")) node.visible = design.accessories.includes(option as Accessory);
    else if (name.startsWith("Eye_")) node.scale.set(...eyeScale[design.eyeStyle]);

    const material = node.material;
    if (!material) return;
    for (const m of Array.isArray(material) ? material : [material]) {
      const hex = colours[m.name];
      if (hex) m.color.set(hex);
      if (["Suit", "Pants", "Shoes"].includes(m.name)) {
        m.roughness = finish.roughness;
        m.metalness = finish.metalness;
      }
    }
  });
}
