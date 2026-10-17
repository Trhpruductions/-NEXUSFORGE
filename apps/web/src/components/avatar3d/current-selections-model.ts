import { PART_OPTIONS, catalogKeyFor, type AvatarDesign, type PartCategory } from "@/components/avatar3d/design";

/** Free options need no catalog item. A paid option counts as owned only when its catalog key is owned. */
export type SelectionState = "free" | "owned" | "locked";

export type SelectionRow = {
  /** Stable key for React lists: slot plus item id. */
  key: string;
  slot: string;
  label: string;
  state: SelectionState;
  /** Colour the item is worn in, when the slot has a colour. */
  colour?: string;
};

function stateOf(category: PartCategory, id: string, owned: ReadonlySet<string>): SelectionState {
  const key = catalogKeyFor(category, id);
  if (!key) return "free";
  return owned.has(key) ? "owned" : "locked";
}

function labelOf(category: PartCategory, id: string): string {
  return PART_OPTIONS[category].find((option) => option.id === id)?.label ?? id;
}

/**
 * The items the draft is wearing, slot by slot, in the order a person dresses. "none" entries are skipped.
 * This is the list the Currently wearing panel shows, so it must agree with what the preview renders.
 */
export function selectionRows(design: AvatarDesign, owned: ReadonlySet<string>): SelectionRow[] {
  const rows: SelectionRow[] = [];
  const add = (slot: string, category: PartCategory, id: string, colour?: string) => {
    if (id === "none") return;
    rows.push({ key: `${category}:${id}`, slot, label: labelOf(category, id), state: stateOf(category, id, owned), colour });
  };
  add("Hair", "hair", design.hair, design.hairColor);
  add("Top", "top", design.top, design.topColor);
  add("Outerwear", "outer", design.outer, design.outerColor);
  add("Bottoms", "bottom", design.bottom, design.bottomColor);
  add("Shoes", "shoes", design.shoes, design.shoeColor);
  for (const accessory of design.accessories) add("Accessory", "accessory", accessory);
  return rows;
}

/** How many worn items the account does not own, so saving would be refused. */
export function unownedCount(rows: readonly SelectionRow[]): number {
  return rows.filter((row) => row.state === "locked").length;
}
