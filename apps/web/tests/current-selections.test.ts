import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_DESIGN, catalogKeyFor, type AvatarDesign } from "../src/components/avatar3d/design";
import { selectionRows, unownedCount } from "../src/components/avatar3d/current-selections-model";

const none = new Set<string>();

test("a default look wears only free items, so nothing is flagged", () => {
  const rows = selectionRows(DEFAULT_DESIGN, none);
  assert.ok(rows.length > 0);
  assert.ok(rows.every((row) => row.state === "free"), "default look has no paid items");
  assert.equal(unownedCount(rows), 0);
});

test("a paid top the account does not own is listed as locked and counted", () => {
  const design: AvatarDesign = { ...DEFAULT_DESIGN, top: "jersey" };
  const rows = selectionRows(design, none);
  const top = rows.find((row) => row.slot === "Top");
  assert.equal(top?.state, "locked");
  assert.equal(unownedCount(rows), 1);
});

test("the same paid top shows as owned once its catalog item is owned", () => {
  const key = catalogKeyFor("top", "jersey");
  assert.ok(key, "jersey is a paid top");
  const design: AvatarDesign = { ...DEFAULT_DESIGN, top: "jersey" };
  const rows = selectionRows(design, new Set([key!]));
  assert.equal(rows.find((row) => row.slot === "Top")?.state, "owned");
  assert.equal(unownedCount(rows), 0);
});

test("'none' slots are skipped and every worn accessory is listed", () => {
  const design: AvatarDesign = { ...DEFAULT_DESIGN, outer: "none", accessories: ["cap", "cybershades"] };
  const rows = selectionRows(design, none);
  assert.equal(rows.some((row) => row.slot === "Outerwear"), false);
  const accessories = rows.filter((row) => row.slot === "Accessory");
  assert.deepEqual(accessories.map((row) => row.label).length, 2);
  assert.equal(accessories.find((row) => row.key === "accessory:cybershades")?.state, catalogKeyFor("accessory", "cybershades") ? "locked" : "free");
});

test("slots with a colour carry it so the panel can show a swatch", () => {
  const rows = selectionRows({ ...DEFAULT_DESIGN, hairColor: "#22d3ee" }, none);
  assert.equal(rows.find((row) => row.slot === "Hair")?.colour, "#22d3ee");
});
