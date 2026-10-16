import type { MaterialSlot } from "./base-model";

/**
 * The customisation model for the Nexus Forge 3D avatar: option lists, the saved design shape,
 * compatibility and layering rules, presets, and applyDesign (which changes a loaded character to
 * match a design).
 *
 * Adding a new option means adding its id to the list below, a label in the matching META table,
 * and a node named Top_<id>, Hair_<id>, Bottom_<id>, Shoes_<id> or Acc_<id> in base-model.ts.
 * The server mirrors these lists in apps/server/src/lib/avatar-design.ts. The parity test in
 * apps/server/tests/avatar-design.test.ts fails if the two drift apart, so update both.
 *
 * Ownership: an option with a catalogKey is paid. It is only available when the account owns the
 * matching CosmeticItem (a UserCosmetic row). Options without a catalogKey are free.
 * Existing option ids are never removed or repriced, so saved looks keep working.
 */

export const BODY_TYPES = ["slim", "athletic", "broad"] as const;
export type BodyType = (typeof BODY_TYPES)[number];

export const HAIR_STYLES = ["none", "buzz", "spiky", "long", "curls", "bun", "mohawk", "bob", "ponytail", "afro", "fringe"] as const;
export type HairStyle = (typeof HAIR_STYLES)[number];

/** Base layer, worn next to the skin. */
export const TOPS = ["tee", "longsleeve", "hoodie", "polo", "tank", "jersey"] as const;
export type TopStyle = (typeof TOPS)[number];

/** Layered over the base top. "none" means no outer layer. */
export const OUTERWEAR = ["none", "jacket", "bomber", "vest", "neon"] as const;
export type OuterStyle = (typeof OUTERWEAR)[number];

export const BOTTOMS = ["jeans", "shorts", "cargo", "track", "tactical", "armored"] as const;
export type BottomStyle = (typeof BOTTOMS)[number];

export const SHOES = ["sneakers", "boots", "hightops", "slides", "chunky", "galaxy"] as const;
export type ShoeStyle = (typeof SHOES)[number];

export const ACCESSORIES = ["cap", "beanie", "visor", "bandana", "shades", "glasses", "cybershades", "chain", "mask", "headset", "backpack"] as const;
export type Accessory = (typeof ACCESSORIES)[number];

export const EYE_STYLES = ["round", "sharp", "calm"] as const;
export type EyeStyle = (typeof EYE_STYLES)[number];

export const MATERIAL_STYLES = ["matte", "satin", "gloss", "metallic"] as const;
export type MaterialStyle = (typeof MATERIAL_STYLES)[number];

/** Legacy names kept so older imports keep compiling. */
export type Top = TopStyle;
export type Bottom = BottomStyle;
export type Shoe = ShoeStyle;

type Meta = { label: string; catalogKey?: string };

const HAIR_META: Record<HairStyle, Meta & { hatCovered?: boolean }> = {
  none: { label: "None" },
  buzz: { label: "Buzz", hatCovered: true },
  spiky: { label: "Spiky", hatCovered: true },
  long: { label: "Long wave" },
  curls: { label: "Curls", hatCovered: true },
  bun: { label: "Bun", hatCovered: true },
  mohawk: { label: "Mohawk", hatCovered: true },
  bob: { label: "Bob" },
  ponytail: { label: "Ponytail" },
  afro: { label: "Afro", hatCovered: true },
  fringe: { label: "Side fringe", hatCovered: true },
};

const TOP_META: Record<TopStyle, Meta> = {
  tee: { label: "Tee" },
  longsleeve: { label: "Long sleeve" },
  hoodie: { label: "Hoodie" },
  polo: { label: "Polo" },
  tank: { label: "Tank top" },
  jersey: { label: "Esports jersey", catalogKey: "top-esports-jersey" },
};

const OUTER_META: Record<OuterStyle, Meta> = {
  none: { label: "None" },
  jacket: { label: "Jacket" },
  bomber: { label: "Bomber" },
  vest: { label: "Vest" },
  neon: { label: "Neon drift jacket", catalogKey: "top-neon-drift-jacket" },
};

const BOTTOM_META: Record<BottomStyle, Meta> = {
  jeans: { label: "Slim jeans" },
  shorts: { label: "Shorts" },
  cargo: { label: "Cargo" },
  track: { label: "Track pants" },
  tactical: { label: "Tactical pants", catalogKey: "bottom-tactical-pants" },
  armored: { label: "Armored legs", catalogKey: "bottom-armored-legs" },
};

const SHOE_META: Record<ShoeStyle, Meta> = {
  sneakers: { label: "Sneakers" },
  boots: { label: "Boots" },
  hightops: { label: "High tops" },
  slides: { label: "Slides" },
  chunky: { label: "Gold runners", catalogKey: "shoes-gold-runners" },
  galaxy: { label: "Galaxy shoes", catalogKey: "shoes-galaxy" },
};

export type AccessoryGroup = "headwear" | "eyewear" | "face" | "body";
const ACCESSORY_META: Record<Accessory, Meta & { group: AccessoryGroup }> = {
  cap: { label: "Cap", group: "headwear" },
  beanie: { label: "Beanie", group: "headwear" },
  visor: { label: "Visor", group: "headwear" },
  bandana: { label: "Bandana", group: "headwear" },
  shades: { label: "Shades", group: "eyewear" },
  glasses: { label: "Round glasses", group: "eyewear" },
  cybershades: { label: "Cyber shades", group: "eyewear", catalogKey: "face-cyber-shades" },
  chain: { label: "Chain", group: "body" },
  mask: { label: "Mask", group: "face" },
  headset: { label: "Headset", group: "face" },
  backpack: { label: "Backpack", group: "body", catalogKey: "back-neon-backpack" },
};

export const ACCESSORY_GROUP_LABELS: Record<AccessoryGroup, string> = {
  headwear: "Headwear",
  eyewear: "Eyewear",
  face: "Face and ears",
  body: "Body",
};

/** Eye, body and material labels (the 3D ids map to these). */
const PLAIN_LABELS: Record<string, string> = {
  round: "Round",
  sharp: "Sharp",
  calm: "Calm",
  slim: "Slim",
  athletic: "Athletic",
  broad: "Broad",
  matte: "Matte",
  satin: "Satin",
  gloss: "Gloss",
  metallic: "Metallic",
};

/** Labels for the pickers, kept beside the ids so the UI and the data never drift apart. */
export const LABELS: Record<string, string> = {
  ...Object.fromEntries(Object.entries(HAIR_META).map(([id, m]) => [id, m.label])),
  ...Object.fromEntries(Object.entries(TOP_META).map(([id, m]) => [id, m.label])),
  ...Object.fromEntries(Object.entries(OUTER_META).map(([id, m]) => [id, m.label])),
  ...Object.fromEntries(Object.entries(BOTTOM_META).map(([id, m]) => [id, m.label])),
  ...Object.fromEntries(Object.entries(SHOE_META).map(([id, m]) => [id, m.label])),
  ...Object.fromEntries(Object.entries(ACCESSORY_META).map(([id, m]) => [id, m.label])),
  ...PLAIN_LABELS,
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
  top: TopStyle;
  topColor: string;
  outer: OuterStyle;
  outerColor: string;
  bottom: BottomStyle;
  bottomColor: string;
  shoes: ShoeStyle;
  shoeColor: string;
  accessories: Accessory[];
  accent: string;
  metalColor: string;
  darkColor: string;
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
  outer: "none",
  outerColor: "#1b1e26",
  bottom: "jeans",
  bottomColor: "#1d2029",
  shoes: "sneakers",
  shoeColor: "#111318",
  accessories: [],
  accent: "#2ea4ff",
  metalColor: "#cbd5e1",
  darkColor: "#0b1220",
  material: "satin",
};

/**
 * Colour fields and the material slot each one paints (names from MATERIAL_SLOTS in base-model.ts).
 * Every supported slot has its own colour, so one part can change without touching another.
 */
export const COLOUR_FIELDS: ReadonlyArray<{ field: "skin" | "hairColor" | "eyeColor" | "topColor" | "outerColor" | "bottomColor" | "shoeColor" | "accent" | "metalColor" | "darkColor"; label: string; slot: MaterialSlot; help: string }> = [
  { field: "skin", label: "Skin", slot: "Skin", help: "Face, neck, arms and legs" },
  { field: "hairColor", label: "Hair", slot: "Hair", help: "Every hair style" },
  { field: "eyeColor", label: "Eyes", slot: "Eyes", help: "Iris colour" },
  { field: "topColor", label: "Base top", slot: "Suit", help: "The layer next to the skin" },
  { field: "outerColor", label: "Outerwear", slot: "Outer", help: "Jacket, bomber, vest or neon" },
  { field: "bottomColor", label: "Bottoms", slot: "Pants", help: "Trousers, shorts and leg overlays" },
  { field: "shoeColor", label: "Shoes", slot: "Shoes", help: "Uppers and soles" },
  { field: "accent", label: "Accent trim", slot: "Accent", help: "Stripes, zips, cuffs and caps" },
  { field: "metalColor", label: "Metal", slot: "Metal", help: "Chains and armour plates" },
  { field: "darkColor", label: "Lenses and dark trim", slot: "Dark", help: "Shades, glasses and backpacks" },
];

// ------------------------------------------------------------------ option lists with metadata

export type PartCategory = "hair" | "top" | "outer" | "bottom" | "shoes" | "accessory";

export type PartOption = { id: string; label: string; catalogKey?: string; group?: string; hatCovered?: boolean };

function options<T extends string>(ids: readonly T[], meta: Record<T, Meta & { group?: string; hatCovered?: boolean }>): PartOption[] {
  return ids.map((id) => ({ id, label: meta[id].label, catalogKey: meta[id].catalogKey, group: meta[id].group, hatCovered: meta[id].hatCovered }));
}

export const PART_OPTIONS: Record<PartCategory, PartOption[]> = {
  hair: options(HAIR_STYLES, HAIR_META),
  top: options(TOPS, TOP_META),
  outer: options(OUTERWEAR, OUTER_META),
  bottom: options(BOTTOMS, BOTTOM_META),
  shoes: options(SHOES, SHOE_META),
  accessory: options(ACCESSORIES, ACCESSORY_META),
};

/** Option counts per category, for the editor and for the release notes. */
export const PART_COUNTS = Object.fromEntries(
  (Object.keys(PART_OPTIONS) as PartCategory[]).map((category) => [category, { total: PART_OPTIONS[category].length, paid: PART_OPTIONS[category].filter((o) => o.catalogKey).length }]),
) as Record<PartCategory, { total: number; paid: number }>;

/** The catalog item that unlocks a paid option, or undefined when the option is free. */
export function catalogKeyFor(category: PartCategory, id: string): string | undefined {
  return PART_OPTIONS[category].find((option) => option.id === id)?.catalogKey;
}

/** True when the account may wear the option: free options always, paid ones only when owned. */
export function isPartAvailable(category: PartCategory, id: string, owned: ReadonlySet<string>): boolean {
  const key = catalogKeyFor(category, id);
  return !key || owned.has(key);
}

// ------------------------------------------------------------------ layering and compatibility rules

/** Single-choice groups: only one headwear item and one eyewear item show at a time (first in list order wins). */
export const HEADWEAR: readonly Accessory[] = ["cap", "beanie", "visor", "bandana"];
export const EYEWEAR: readonly Accessory[] = ["shades", "glasses", "cybershades"];
/** Hats that sit on the crown. They cover the hairstyles marked hatCovered. */
const HATS: readonly Accessory[] = ["cap", "beanie"];
/** Pairs that clip if both are worn. The second item is hidden when the first is chosen. */
const RIVALS: Partial<Record<Accessory, readonly Accessory[]>> = { headset: ["cap", "beanie"] };
/** Outer layers with sleeves cover the base top's sleeves. */
const OUTER_SLEEVES: Record<OuterStyle, boolean> = { none: false, jacket: true, bomber: true, vest: false, neon: true };

/** Chooses a new accessory list: adding one removes anything in its group or that rivals it. */
export function addAccessory(current: readonly Accessory[], id: Accessory): Accessory[] {
  const removed = new Set<Accessory>();
  for (const other of current) {
    const sameSingleGroup = (HEADWEAR.includes(id) && HEADWEAR.includes(other)) || (EYEWEAR.includes(id) && EYEWEAR.includes(other));
    if (sameSingleGroup || RIVALS[id]?.includes(other) || RIVALS[other]?.includes(id)) removed.add(other);
  }
  return [...current.filter((a) => !removed.has(a) && a !== id), id];
}

/** Toggles an accessory on or off, applying the same rules as addAccessory. */
export function toggleAccessory(current: readonly Accessory[], id: Accessory): Accessory[] {
  return current.includes(id) ? current.filter((a) => a !== id) : addAccessory(current, id);
}

/** Which accessories actually render after the rules. Hidden items stay in the saved design. */
export function activeAccessories(design: Pick<AvatarDesign, "accessories" | "outer">): Set<Accessory> {
  const keep = new Set<Accessory>(design.accessories.filter((a, index, all) => all.indexOf(a) === index));
  for (const group of [HEADWEAR, EYEWEAR]) {
    const first = group.find((a) => keep.has(a));
    for (const a of group) if (a !== first) keep.delete(a);
  }
  for (const [id, rivals] of Object.entries(RIVALS) as Array<[Accessory, readonly Accessory[]]>) {
    if (keep.has(id) && rivals.some((r) => keep.has(r))) keep.delete(id);
  }
  // An outer layer covers the chain.
  if (design.outer !== "none") keep.delete("chain");
  return keep;
}

export type ResolvedLayers = {
  hair: HairStyle;
  hairHiddenByHat: boolean;
  top: TopStyle;
  hoodUp: boolean;
  baseSleeves: boolean;
  outer: OuterStyle;
  bottom: BottomStyle;
  shoes: ShoeStyle;
  accessories: Accessory[];
};

/**
 * The layering rules in one place. The viewer and the tests both read this.
 *  - A hat hides hair that is marked hatCovered. Long, bob and ponytail stay visible.
 *  - An outer layer with sleeves hides the base top's sleeves.
 *  - A hood folds down under an outer layer.
 *  - An outer layer covers the chain.
 *  - Only one headwear item and one eyewear item show. Headset clips with caps and beanies.
 */
export function resolveLayers(design: AvatarDesign): ResolvedLayers {
  const accessories = activeAccessories(design);
  const hatOn = HATS.some((hat) => accessories.has(hat));
  const hairHiddenByHat = hatOn && Boolean(HAIR_META[design.hair].hatCovered);
  return {
    hair: hairHiddenByHat ? "none" : design.hair,
    hairHiddenByHat,
    top: design.top,
    hoodUp: design.outer === "none",
    baseSleeves: !OUTER_SLEEVES[design.outer],
    outer: design.outer,
    bottom: design.bottom,
    shoes: design.shoes,
    accessories: [...accessories],
  };
}

// ------------------------------------------------------------------ reading saved data

export type DesignFallback = { field: keyof AvatarDesign; value: string };

const MIGRATED_TOP_JACKET = "jacket";

/** Older designs wore the jacket as the base top. It now lives in the outer layer, so the look stays the same. */
function migrateLegacy(input: Record<string, unknown>): Record<string, unknown> {
  if (input.top !== MIGRATED_TOP_JACKET) return input;
  return {
    ...input,
    top: "tee",
    outer: input.outer === undefined || input.outer === "none" ? "jacket" : input.outer,
    outerColor: input.outerColor ?? input.topColor,
  };
}

/**
 * Reads a saved design. Unknown or retired option ids fall back to the default for that field and are
 * reported in `fallbacks`. The input object is never changed, so a stored record stays as saved.
 */
export function readDesign(value: unknown): { design: AvatarDesign; fallbacks: DesignFallback[] } {
  const input = migrateLegacy(value && typeof value === "object" ? (value as Record<string, unknown>) : {});
  const fallbacks: DesignFallback[] = [];
  const pick = <T extends string>(field: keyof AvatarDesign, list: readonly T[], fallback: T): T => {
    const candidate = input[field];
    if (candidate === undefined) return fallback;
    if ((list as readonly string[]).includes(candidate as string)) return candidate as T;
    fallbacks.push({ field, value: String(candidate) });
    return fallback;
  };
  const hex = (field: keyof AvatarDesign, fallback: string) => {
    const candidate = input[field];
    if (candidate === undefined) return fallback;
    if (typeof candidate === "string" && /^#[0-9a-f]{6}$/i.test(candidate)) return candidate;
    fallbacks.push({ field, value: String(candidate) });
    return fallback;
  };

  const accessories: Accessory[] = [];
  if (input.accessories !== undefined) {
    if (!Array.isArray(input.accessories)) {
      fallbacks.push({ field: "accessories", value: String(input.accessories) });
    } else {
      for (const entry of input.accessories) {
        if ((ACCESSORIES as readonly string[]).includes(entry as string)) {
          if (!accessories.includes(entry as Accessory)) accessories.push(entry as Accessory);
        } else {
          fallbacks.push({ field: "accessories", value: String(entry) });
        }
      }
    }
  }

  const design: AvatarDesign = {
    version: 1,
    body: pick("body", BODY_TYPES, DEFAULT_DESIGN.body),
    skin: hex("skin", DEFAULT_DESIGN.skin),
    hair: pick("hair", HAIR_STYLES, DEFAULT_DESIGN.hair),
    hairColor: hex("hairColor", DEFAULT_DESIGN.hairColor),
    eyeColor: hex("eyeColor", DEFAULT_DESIGN.eyeColor),
    eyeStyle: pick("eyeStyle", EYE_STYLES, DEFAULT_DESIGN.eyeStyle),
    top: pick("top", TOPS, DEFAULT_DESIGN.top),
    topColor: hex("topColor", DEFAULT_DESIGN.topColor),
    outer: pick("outer", OUTERWEAR, DEFAULT_DESIGN.outer),
    outerColor: hex("outerColor", DEFAULT_DESIGN.outerColor),
    bottom: pick("bottom", BOTTOMS, DEFAULT_DESIGN.bottom),
    bottomColor: hex("bottomColor", DEFAULT_DESIGN.bottomColor),
    shoes: pick("shoes", SHOES, DEFAULT_DESIGN.shoes),
    shoeColor: hex("shoeColor", DEFAULT_DESIGN.shoeColor),
    accessories,
    accent: hex("accent", DEFAULT_DESIGN.accent),
    metalColor: hex("metalColor", DEFAULT_DESIGN.metalColor),
    darkColor: hex("darkColor", DEFAULT_DESIGN.darkColor),
    material: pick("material", MATERIAL_STYLES, DEFAULT_DESIGN.material),
  };
  return { design, fallbacks };
}

/** Makes a design safe to use: unknown or missing fields fall back to the defaults. */
export function normaliseDesign(value: unknown): AvatarDesign {
  return readDesign(value).design;
}

/** Names the fields of a saved design that could not be read as saved, for a notice in the editor. */
export function describeFallbacks(value: unknown): string[] {
  return readDesign(value).fallbacks.map((item) => `${item.field} (${item.value})`);
}

// ------------------------------------------------------------------ presets and randomising

export type DesignPreset = { id: string; name: string; tagline: string; design: AvatarDesign };

const preset = (id: string, name: string, tagline: string, overrides: Partial<AvatarDesign>): DesignPreset => ({
  id,
  name,
  tagline,
  design: normaliseDesign({ ...DEFAULT_DESIGN, ...overrides }),
});

/**
 * Ready-made starting points. Each is a real design that renders through applyDesign. Presets use
 * free options only, so every account can wear every preset. The server test checks that.
 */
export const DESIGN_PRESETS: DesignPreset[] = [
  preset("neon-cyberpunk", "Neon cyberpunk", "Violet mohawk, glowing jacket trim", {
    body: "slim",
    hair: "mohawk",
    hairColor: "#a855f7",
    eyeColor: "#22d3ee",
    eyeStyle: "sharp",
    top: "hoodie",
    topColor: "#111318",
    outer: "jacket",
    outerColor: "#1e1b4b",
    bottom: "cargo",
    bottomColor: "#1f2937",
    shoes: "hightops",
    shoeColor: "#111318",
    accessories: ["shades"],
    accent: "#22d3ee",
    metalColor: "#e2e8f0",
    darkColor: "#0b1220",
    material: "gloss",
  }),
  preset("dark-streetwear", "Dark streetwear", "Cropped fade, bomber and cargos", {
    body: "athletic",
    hair: "buzz",
    hairColor: "#111318",
    top: "tee",
    topColor: "#0f0f10",
    outer: "bomber",
    outerColor: "#111318",
    bottom: "track",
    bottomColor: "#0f172a",
    shoes: "sneakers",
    shoeColor: "#f8fafc",
    accessories: ["cap"],
    accent: "#f59e0b",
    material: "matte",
  }),
  preset("esports", "Esports", "Team polo, headset and a cap", {
    body: "athletic",
    hair: "spiky",
    hairColor: "#f8fafc",
    top: "polo",
    topColor: "#7f1d1d",
    bottom: "track",
    bottomColor: "#111318",
    shoes: "sneakers",
    shoeColor: "#f8fafc",
    accessories: ["headset"],
    accent: "#f8fafc",
    material: "satin",
  }),
  preset("frost", "Frost", "Pale long hair, glasses and a vest", {
    body: "slim",
    skin: "#f5d0b0",
    hair: "long",
    hairColor: "#e2e8f0",
    eyeColor: "#7dd3fc",
    eyeStyle: "calm",
    top: "longsleeve",
    topColor: "#f8fafc",
    outer: "vest",
    outerColor: "#94a3b8",
    bottom: "jeans",
    bottomColor: "#334155",
    shoes: "boots",
    shoeColor: "#e2e8f0",
    accessories: ["glasses"],
    accent: "#38bdf8",
    metalColor: "#e2e8f0",
    material: "gloss",
  }),
  preset("monochrome", "Monochrome", "Black and white, nothing else", {
    body: "athletic",
    hair: "buzz",
    hairColor: "#111318",
    top: "tee",
    topColor: "#f8fafc",
    outer: "jacket",
    outerColor: "#1b1e26",
    bottom: "jeans",
    bottomColor: "#111318",
    shoes: "sneakers",
    shoeColor: "#f8fafc",
    accessories: ["chain"],
    accent: "#94a3b8",
    metalColor: "#e2e8f0",
    material: "matte",
  }),
];

type RandomSource = () => number;

function pickOne<T>(list: readonly T[], random: RandomSource): T {
  return list[Math.floor(random() * list.length)];
}

/**
 * A random design built only from options the account can wear. Paid parts that the account does
 * not own are never chosen, so a shuffle can never produce a look the server would refuse.
 */
export function randomDesign(owned: ReadonlySet<string> = new Set(), random: RandomSource = Math.random): AvatarDesign {
  const available = <T extends string>(category: PartCategory | null, ids: readonly T[]) =>
    ids.filter((id) => (category ? isPartAvailable(category, id, owned) : true));
  let accessories: Accessory[] = [];
  const pool = available("accessory", ACCESSORIES);
  const picks = Math.floor(random() * 3);
  for (let i = 0; i < picks; i += 1) {
    accessories = addAccessory(accessories, pickOne(pool, random));
  }
  return normaliseDesign({
    version: 1,
    body: pickOne(BODY_TYPES, random),
    skin: pickOne(SKIN_TONES, random),
    hair: pickOne(available("hair", HAIR_STYLES), random),
    hairColor: pickOne(PALETTE, random),
    eyeColor: pickOne(PALETTE, random),
    eyeStyle: pickOne(EYE_STYLES, random),
    top: pickOne(available("top", TOPS), random),
    topColor: pickOne(PALETTE, random),
    outer: pickOne(available("outer", OUTERWEAR), random),
    outerColor: pickOne(PALETTE, random),
    bottom: pickOne(available("bottom", BOTTOMS), random),
    bottomColor: pickOne(PALETTE, random),
    shoes: pickOne(available("shoes", SHOES), random),
    shoeColor: pickOne(PALETTE, random),
    accessories,
    accent: pickOne(PALETTE, random),
    metalColor: pickOne(PALETTE, random),
    darkColor: pickOne(PALETTE, random),
    material: pickOne(MATERIAL_STYLES, random),
  });
}

/** Catalog keys a design needs the account to own. Free options contribute nothing. */
export function paidCatalogKeys(design: AvatarDesign): string[] {
  const keys = [
    catalogKeyFor("hair", design.hair),
    catalogKeyFor("top", design.top),
    catalogKeyFor("outer", design.outer),
    catalogKeyFor("bottom", design.bottom),
    catalogKeyFor("shoes", design.shoes),
    ...design.accessories.map((a) => catalogKeyFor("accessory", a)),
  ];
  return [...new Set(keys.filter((key): key is string => Boolean(key)))];
}

// ------------------------------------------------------------------ applying a design to a model

/** Structural types for a three.js node, so this file needs no runtime import of three. */
type Material = { name: string; color: { set: (hex: string) => unknown }; roughness: number; metalness: number };
type Node = { name: string; visible: boolean; scale: { set: (x: number, y: number, z: number) => unknown }; traverse: (fn: (node: Node & { material?: Material | Material[] }) => void) => void };

const EYE_SCALE: Record<EyeStyle, [number, number, number]> = { round: [1.25, 1.25, 1.25], sharp: [1.1, 0.7, 1], calm: [1, 0.55, 1] };
const FINISHED_SLOTS = ["Suit", "Outer", "Pants", "Shoes"];

/** Whether a Top_ node shows: the base layer's pieces follow its layering rules, the outer layer shows all its pieces. */
function topNodeVisible(option: string, rest: string, layers: ResolvedLayers): boolean {
  if (option === layers.outer) return true;
  if (option !== layers.top) return false;
  if (rest === "hood") return layers.hoodUp;
  if (rest.startsWith("sleeve") || rest.startsWith("cuff")) return layers.baseSleeves;
  return true;
}

/**
 * Makes a loaded character match a design. Works on any three.js object tree built from the
 * base model, so it is cheap to call on every change. Visibility follows resolveLayers.
 */
export function applyDesign(root: Node, design: AvatarDesign) {
  const layers = resolveLayers(design);
  const colourBySlot: Record<string, string> = {};
  for (const entry of COLOUR_FIELDS) colourBySlot[entry.slot] = design[entry.field];
  const finish = MATERIAL_FINISH[design.material];
  const accessories = new Set<string>(layers.accessories);

  root.traverse((node) => {
    const parts = (node.name || "").split("_");
    const kind = parts[0];
    const option = parts[1] ?? "";
    const rest = parts.slice(2).join("_");
    if (kind === "Hair") node.visible = option === layers.hair;
    else if (kind === "Top") node.visible = topNodeVisible(option, rest, layers);
    else if (kind === "Bottom") node.visible = option === layers.bottom;
    else if (kind === "Shoes") node.visible = option === layers.shoes;
    else if (kind === "Acc") node.visible = accessories.has(option);
    else if (kind === "Eye") node.scale.set(...EYE_SCALE[design.eyeStyle]);

    const material = node.material;
    if (!material) return;
    for (const m of Array.isArray(material) ? material : [material]) {
      const hex = colourBySlot[m.name];
      if (hex) m.color.set(hex);
      if (FINISHED_SLOTS.includes(m.name)) {
        m.roughness = finish.roughness;
        m.metalness = finish.metalness;
      }
    }
  });
}
