import { test } from "node:test";
import assert from "node:assert/strict";
import { PART_OPTIONS, HEADWEAR } from "../src/components/avatar3d/design";
import { ARMOR_IDS, armorOptions, headwear, onlyHoodies, otherAccessories, remember, topsWithoutHoodies, STUDIO_CATEGORIES } from "../src/components/avatar3d/studio-model";

test("the studio lists the categories in the reference order", () => {
  assert.deepEqual(
    STUDIO_CATEGORIES.map((entry) => entry.id),
    ["body", "skin", "head", "hair", "face", "tops", "hoodies", "jackets", "pants", "shoes", "accessories", "armor", "emotes", "outfits"],
  );
});

test("tops and hoodies together cover every top, with nothing counted twice", () => {
  const all = PART_OPTIONS.top.map((option) => option.id).sort();
  const split = [...topsWithoutHoodies(PART_OPTIONS.top), ...onlyHoodies(PART_OPTIONS.top)].map((option) => option.id).sort();
  assert.deepEqual(split, all);
});

test("head and the other accessories together cover every accessory", () => {
  const all = PART_OPTIONS.accessory.map((option) => option.id).sort();
  const split = [...headwear(PART_OPTIONS.accessory), ...otherAccessories(PART_OPTIONS.accessory)].map((option) => option.id).sort();
  assert.deepEqual(split, all);
});

test("the headwear group is the same set the design uses for hat layering", () => {
  assert.deepEqual(headwear(PART_OPTIONS.accessory).map((option) => option.id).sort(), [...HEADWEAR].sort());
});

test("every armour id exists in the option list it is grouped under", () => {
  for (const [category, ids] of Object.entries(ARMOR_IDS) as Array<[keyof typeof PART_OPTIONS, readonly string[]]>) {
    for (const id of ids) {
      assert.ok(PART_OPTIONS[category].some((option) => option.id === id), `${category}:${id}`);
    }
    assert.equal(armorOptions(category, PART_OPTIONS[category]).length, ids.length, `${category} armour count`);
  }
});

test("recently used keeps the newest first, drops repeats, and caps the list", () => {
  let recent = remember([], { category: "top", id: "tee", label: "Tee" });
  recent = remember(recent, { category: "shoes", id: "sneakers", label: "Sneakers" });
  recent = remember(recent, { category: "top", id: "tee", label: "Tee" });
  assert.deepEqual(recent.map((entry) => entry.id), ["tee", "sneakers"]);
  for (let index = 0; index < 10; index++) recent = remember(recent, { category: "hair", id: `h${index}`, label: `H${index}` });
  assert.equal(recent.length, 6);
});
