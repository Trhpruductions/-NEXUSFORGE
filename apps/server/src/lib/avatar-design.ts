import { z } from "zod";

/**
 * The saved 3D avatar design (see apps/web/src/components/avatar3d/design.ts). Stored inside the avatar
 * config and the saved looks (AvatarPreset.config.design).
 *
 * The option lists below mirror design.ts. The parity test in apps/server/tests/avatar-design.test.ts
 * reads both and fails when they differ, so change both files together.
 *
 * Two rules on top of the shape:
 *  - Every option id must be on the list. Writes are rejected otherwise.
 *  - A paid option (PAID_PARTS) needs a UserCosmetic row for its catalog item. Writes that use one the
 *    account does not own are refused. Reads of stored looks never refuse: unknown ids fall back to the
 *    default part for that field, and the stored record is left as it was saved.
 */

export const BODY_TYPES = ["slim", "athletic", "broad"] as const;
export const HAIR_STYLES = ["none", "buzz", "spiky", "long", "curls", "bun", "mohawk", "bob", "ponytail", "afro", "fringe", "mullet"] as const;
export const TOPS = ["tee", "longsleeve", "hoodie", "polo", "tank", "jersey", "oversized"] as const;
export const OUTERWEAR = ["none", "jacket", "bomber", "vest", "neon"] as const;
export const BOTTOMS = ["jeans", "shorts", "cargo", "track", "tactical", "armored"] as const;
export const SHOES = ["sneakers", "boots", "hightops", "slides", "chunky", "galaxy"] as const;
export const ACCESSORIES = ["cap", "beanie", "visor", "bandana", "shades", "glasses", "cybershades", "chain", "mask", "headset", "backpack"] as const;
export const EYE_STYLES = ["round", "sharp", "calm"] as const;
export const MATERIAL_STYLES = ["matte", "satin", "gloss", "metallic"] as const;

export type PartCategory = "hair" | "top" | "outer" | "bottom" | "shoes" | "accessory";
export type PaidPart = { category: PartCategory; id: string; label: string; catalogKey: string };

/**
 * Options that cost coins. Each one points at an existing cosmetic catalog item (see cosmetic-catalog.ts).
 * Every other option is free and always available.
 */
export const PAID_PARTS: PaidPart[] = [
  { category: "top", id: "jersey", label: "Esports jersey", catalogKey: "top-esports-jersey" },
  { category: "outer", id: "neon", label: "Neon drift jacket", catalogKey: "top-neon-drift-jacket" },
  { category: "bottom", id: "tactical", label: "Tactical pants", catalogKey: "bottom-tactical-pants" },
  { category: "bottom", id: "armored", label: "Armored legs", catalogKey: "bottom-armored-legs" },
  { category: "shoes", id: "chunky", label: "Gold runners", catalogKey: "shoes-gold-runners" },
  { category: "shoes", id: "galaxy", label: "Galaxy shoes", catalogKey: "shoes-galaxy" },
  { category: "accessory", id: "cybershades", label: "Cyber shades", catalogKey: "face-cyber-shades" },
  { category: "accessory", id: "backpack", label: "Backpack", catalogKey: "back-neon-backpack" },
];

/** Defaults. These must match DEFAULT_DESIGN in design.ts (the parity test checks this). */
const DEFAULTS = {
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
  accent: "#2ea4ff",
  metalColor: "#cbd5e1",
  darkColor: "#0b1220",
  material: "satin",
} as const;

const hex = z.string().regex(/^#[0-9a-f]{6}$/i, "Use a colour like #22d3ee");

const designObject = z.object({
  version: z.literal(1).default(1),
  body: z.enum(BODY_TYPES).default(DEFAULTS.body),
  skin: hex.default(DEFAULTS.skin),
  hair: z.enum(HAIR_STYLES).default(DEFAULTS.hair),
  hairColor: hex.default(DEFAULTS.hairColor),
  eyeColor: hex.default(DEFAULTS.eyeColor),
  eyeStyle: z.enum(EYE_STYLES).default(DEFAULTS.eyeStyle),
  top: z.enum(TOPS).default(DEFAULTS.top),
  topColor: hex.default(DEFAULTS.topColor),
  outer: z.enum(OUTERWEAR).default(DEFAULTS.outer),
  outerColor: hex.default(DEFAULTS.outerColor),
  bottom: z.enum(BOTTOMS).default(DEFAULTS.bottom),
  bottomColor: hex.default(DEFAULTS.bottomColor),
  shoes: z.enum(SHOES).default(DEFAULTS.shoes),
  shoeColor: hex.default(DEFAULTS.shoeColor),
  accessories: z
    .array(z.enum(ACCESSORIES))
    .max(ACCESSORIES.length)
    .refine((list) => new Set(list).size === list.length, "Each accessory can be worn once")
    .default([]),
  accent: hex.default(DEFAULTS.accent),
  metalColor: hex.default(DEFAULTS.metalColor),
  darkColor: hex.default(DEFAULTS.darkColor),
  material: z.enum(MATERIAL_STYLES).default(DEFAULTS.material),
});

/** Older designs wore the jacket as the base top. It now sits in the outer layer, so the look stays the same. */
function migrateLegacy(value: unknown): unknown {
  if (!value || typeof value !== "object") return value;
  const input = value as Record<string, unknown>;
  if (input.top !== "jacket") return value;
  return {
    ...input,
    top: "tee",
    outer: input.outer === undefined || input.outer === "none" ? "jacket" : input.outer,
    outerColor: input.outerColor ?? input.topColor,
  };
}

/** Strict schema for writes: unknown ids, bad colours and repeated accessories are rejected. */
export const avatarDesignSchema = z.preprocess(migrateLegacy, designObject);

export type AvatarDesignInput = z.infer<typeof avatarDesignSchema>;

/** A preview is either a page-relative upload path or an https link (the storage bucket). */
export const previewUrlSchema = z
  .string()
  .max(500)
  .refine((value) => value.startsWith("/uploads/") || /^https:\/\//.test(value), "Preview must be an uploaded image");

export type DesignFallback = { field: string; value: string };

/**
 * Reads a stored design for display or for applying. Unknown or retired ids become the default for that
 * field and are reported in `fallbacks`. The input is never changed, so the saved record stays as it was.
 */
export function readStoredDesign(raw: unknown): { design: AvatarDesignInput; fallbacks: DesignFallback[] } {
  const input = (migrateLegacy(raw && typeof raw === "object" ? raw : {}) ?? {}) as Record<string, unknown>;
  const fallbacks: DesignFallback[] = [];
  const out: Record<string, unknown> = {};
  for (const [field, fieldSchema] of Object.entries(designObject.shape)) {
    if (field === "accessories") {
      const value = input.accessories;
      const kept: string[] = [];
      if (value !== undefined && !Array.isArray(value)) {
        fallbacks.push({ field, value: String(value) });
      } else if (Array.isArray(value)) {
        for (const entry of value) {
          const valid = (ACCESSORIES as readonly string[]).includes(entry as string);
          if (!valid) fallbacks.push({ field: "accessories", value: String(entry) });
          else if (!kept.includes(entry as string)) kept.push(entry as string);
        }
      }
      out.accessories = kept;
      continue;
    }
    const value = input[field];
    const parsed = (fieldSchema as z.ZodType).safeParse(value);
    if (parsed.success) {
      out[field] = parsed.data;
    } else {
      fallbacks.push({ field, value: String(value) });
      out[field] = (fieldSchema as z.ZodType).parse(undefined);
    }
  }
  return { design: out as AvatarDesignInput, fallbacks };
}

/** Paid parts a design uses. Free options never appear here. */
export function paidPartsOf(design: AvatarDesignInput): PaidPart[] {
  const picks: Array<[PartCategory, string]> = [
    ["hair", design.hair],
    ["top", design.top],
    ["outer", design.outer],
    ["bottom", design.bottom],
    ["shoes", design.shoes],
    ...design.accessories.map((a): [PartCategory, string] => ["accessory", a]),
  ];
  const found: PaidPart[] = [];
  for (const [category, id] of picks) {
    const part = PAID_PARTS.find((entry) => entry.category === category && entry.id === id);
    if (part && !found.includes(part)) found.push(part);
  }
  return found;
}

/** Catalog keys to look up for the account before a write or an apply. */
export function requiredCatalogKeys(design: AvatarDesignInput): string[] {
  return [...new Set(paidPartsOf(design).map((part) => part.catalogKey))];
}

/** The paid parts the account does not own. An empty list means the design may be saved or worn. */
export function missingPaidParts(design: AvatarDesignInput, ownedKeys: ReadonlySet<string>): PaidPart[] {
  return paidPartsOf(design).filter((part) => !ownedKeys.has(part.catalogKey));
}
