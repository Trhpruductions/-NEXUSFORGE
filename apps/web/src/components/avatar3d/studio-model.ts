import { PART_OPTIONS, type PartCategory, type PartOption } from "@/components/avatar3d/design";

/**
 * The Avatar Studio's categories, in the order of the reference. Each one maps onto a part of the design
 * that already exists; nothing here adds a new wearable.
 */
export type StudioCategory =
  | "body"
  | "skin"
  | "head"
  | "hair"
  | "face"
  | "tops"
  | "hoodies"
  | "jackets"
  | "pants"
  | "shoes"
  | "accessories"
  | "armor"
  | "emotes"
  | "outfits";

export const STUDIO_CATEGORIES: ReadonlyArray<{ id: StudioCategory; label: string }> = [
  { id: "body", label: "Body" },
  { id: "skin", label: "Skin tone" },
  { id: "head", label: "Head" },
  { id: "hair", label: "Hair" },
  { id: "face", label: "Face" },
  { id: "tops", label: "Tops" },
  { id: "hoodies", label: "Hoodies" },
  { id: "jackets", label: "Jackets" },
  { id: "pants", label: "Pants" },
  { id: "shoes", label: "Shoes" },
  { id: "accessories", label: "Accessories" },
  { id: "armor", label: "Armor" },
  { id: "emotes", label: "Emotes" },
  { id: "outfits", label: "Saved outfits" },
];

/** Futuristic and armoured parts, grouped by the slot they fit. All of these are paid, so they stay locked until owned. */
export const ARMOR_IDS: Partial<Record<PartCategory, readonly string[]>> = {
  outer: ["neon"],
  bottom: ["tactical", "armored"],
  shoes: ["chunky", "galaxy"],
  accessory: ["cybershades"],
};

/** Hoodies are their own category, so the tops list leaves them out. */
export function topsWithoutHoodies(options: readonly PartOption[]): PartOption[] {
  return options.filter((option) => option.id !== "hoodie");
}

export function onlyHoodies(options: readonly PartOption[]): PartOption[] {
  return options.filter((option) => option.id === "hoodie");
}

/** Hats and head coverings. */
export function headwear(options: readonly PartOption[]): PartOption[] {
  return options.filter((option) => option.group === "headwear");
}

/** Eyewear, face and body accessories: everything that is not headwear. */
export function otherAccessories(options: readonly PartOption[]): PartOption[] {
  return options.filter((option) => option.group !== "headwear");
}

export function armorOptions(category: PartCategory, options: readonly PartOption[]): PartOption[] {
  const ids = ARMOR_IDS[category] ?? [];
  return options.filter((option) => ids.includes(option.id));
}

/** A worn item the Recently used strip can show and re-apply. */
export type RecentPick = { category: PartCategory; id: string; label: string };

export function remember(recent: readonly RecentPick[], pick: RecentPick, limit = 6): RecentPick[] {
  const rest = recent.filter((entry) => !(entry.category === pick.category && entry.id === pick.id));
  return [pick, ...rest].slice(0, limit);
}

/** Every part option in one list, used by the owned-inventory mapping. */
export const ALL_PART_OPTIONS: ReadonlyArray<{ category: PartCategory; option: PartOption }> = (Object.keys(PART_OPTIONS) as PartCategory[]).flatMap((category) =>
  PART_OPTIONS[category].map((option) => ({ category, option })),
);
