import test from "node:test";
import assert from "node:assert/strict";
import * as web from "../../web/src/components/avatar3d/design.ts";
import {
  ACCESSORIES,
  BODY_TYPES,
  BOTTOMS,
  EYE_STYLES,
  HAIR_STYLES,
  MATERIAL_STYLES,
  OUTERWEAR,
  PAID_PARTS,
  SHOES,
  TOPS,
  avatarDesignSchema,
  missingPaidParts,
  paidPartsOf,
  readStoredDesign,
  requiredCatalogKeys,
  type AvatarDesignInput,
} from "../src/lib/avatar-design.js";

/**
 * Pure checks for the avatar design: the option lists stay in step with the web builder, writes reject
 * unknown ids, stored looks read back safely, and ownership is enforced for paid parts only.
 * No database is needed. The catalog is imported with a placeholder URL, because the Prisma client
 * only connects when a query runs.
 */

if (!process.env.DATABASE_URL) process.env.DATABASE_URL = "postgresql://avatar-test:avatar-test@127.0.0.1:5432/avatar-test";
const catalog = await import("../src/lib/cosmetic-catalog.js");

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

test("option lists match the web builder, in the same order", () => {
  assert.deepEqual(BODY_TYPES, web.BODY_TYPES);
  assert.deepEqual(HAIR_STYLES, web.HAIR_STYLES);
  assert.deepEqual(TOPS, web.TOPS);
  assert.deepEqual(OUTERWEAR, web.OUTERWEAR);
  assert.deepEqual(BOTTOMS, web.BOTTOMS);
  assert.deepEqual(SHOES, web.SHOES);
  assert.deepEqual(ACCESSORIES, web.ACCESSORIES);
  assert.deepEqual(EYE_STYLES, web.EYE_STYLES);
  assert.deepEqual(MATERIAL_STYLES, web.MATERIAL_STYLES);
});

test("schema defaults match the web default design", () => {
  const parsed = avatarDesignSchema.parse({});
  assert.deepEqual(parsed, web.DEFAULT_DESIGN);
});

test("paid parts match the web option metadata (ids, labels and catalog keys)", () => {
  const webPaid = (Object.keys(web.PART_OPTIONS) as Array<keyof typeof web.PART_OPTIONS>).flatMap((category) =>
    web.PART_OPTIONS[category]
      .filter((option) => option.catalogKey)
      .map((option) => ({ category, id: option.id, label: option.label, catalogKey: option.catalogKey })),
  );
  const serverPaid = PAID_PARTS.map((part) => ({ category: part.category === "accessory" ? "accessory" : part.category, id: part.id, label: part.label, catalogKey: part.catalogKey }));
  assert.equal(serverPaid.length, webPaid.length);
  for (const part of serverPaid) {
    const match = webPaid.find((entry) => entry.category === part.category && entry.id === part.id);
    assert.ok(match, `web is missing paid part ${part.category}:${part.id}`);
    assert.equal(match.label, part.label);
    assert.equal(match.catalogKey, part.catalogKey);
  }
});

test("every paid part points at a catalog item that costs coins", () => {
  for (const part of PAID_PARTS) {
    const item = catalog.cosmeticCatalog.find((entry) => entry.key === part.catalogKey);
    assert.ok(item, `no catalog item ${part.catalogKey}`);
    assert.ok(item.priceCoins > 0, `${part.catalogKey} must be paid`);
  }
});

test("writes reject unknown ids, bad colours and repeated accessories", () => {
  assert.equal(avatarDesignSchema.safeParse({ hair: "fade" }).success, false, "retired hair id");
  assert.equal(avatarDesignSchema.safeParse({ top: "visor" }).success, false, "wrong list");
  assert.equal(avatarDesignSchema.safeParse({ accessories: ["hat-of-doom"] }).success, false, "unknown accessory");
  assert.equal(avatarDesignSchema.safeParse({ accessories: ["cap", "cap"] }).success, false, "repeated accessory");
  assert.equal(avatarDesignSchema.safeParse({ skin: "red" }).success, false, "not a hex colour");
  assert.equal(avatarDesignSchema.safeParse({ metalColor: "#abc" }).success, false, "short hex");
  assert.equal(avatarDesignSchema.safeParse({ hair: "bob", top: "jersey", accessories: ["beanie", "backpack"] }).success, true);
});

test("a legacy jacket top moves to the outer layer with the same colour", () => {
  const parsed = avatarDesignSchema.parse({ top: "jacket", topColor: "#7f1d1d" });
  assert.equal(parsed.top, "tee");
  assert.equal(parsed.outer, "jacket");
  assert.equal(parsed.outerColor, "#7f1d1d");
  const read = readStoredDesign({ top: "jacket", topColor: "#7f1d1d" });
  assert.equal(read.design.outer, "jacket");
  assert.deepEqual(read.fallbacks, []);
});

test("paid parts need an owned catalog item; free parts never do", () => {
  const free = avatarDesignSchema.parse({ top: "tee", hair: "buzz", accessories: ["cap"] });
  assert.deepEqual(requiredCatalogKeys(free), []);
  assert.deepEqual(missingPaidParts(free, new Set()), []);

  const paid = avatarDesignSchema.parse({ top: "jersey", accessories: ["cybershades"] });
  assert.deepEqual(requiredCatalogKeys(paid).sort(), ["face-cyber-shades", "top-esports-jersey"]);
  assert.deepEqual(missingPaidParts(paid, new Set()).map((part) => part.id).sort(), ["cybershades", "jersey"]);
  assert.deepEqual(missingPaidParts(paid, new Set(["top-esports-jersey"])).map((part) => part.id), ["cybershades"]);
  assert.deepEqual(missingPaidParts(paid, new Set(["top-esports-jersey", "face-cyber-shades"])), []);
});

test("a stored look with retired ids reads back with defaults and is not changed", () => {
  const stored = { hair: "fade", top: "tee", accessories: ["cap", "retired-hat", "cap"], skin: "#zzzzzz", galaxy: true };
  const before = clone(stored);
  const read = readStoredDesign(stored);
  assert.deepEqual(stored, before, "the stored record must not change");
  assert.equal(read.design.hair, "spiky", "retired hair falls back to the default for that field");
  assert.equal(read.design.skin, web.DEFAULT_DESIGN.skin);
  assert.deepEqual(read.design.accessories, ["cap"], "unknown accessory dropped, duplicate merged");
  assert.deepEqual(read.fallbacks.map((item) => item.field).sort(), ["accessories", "hair", "skin"]);
});

test("every ready-made preset is a valid design with no paid parts", () => {
  assert.ok(web.DESIGN_PRESETS.length >= 5);
  for (const entry of web.DESIGN_PRESETS) {
    const parsed = avatarDesignSchema.parse(clone(entry.design));
    assert.deepEqual(paidPartsOf(parsed), [], `${entry.id} uses a paid part`);
    assert.deepEqual(parsed, entry.design, `${entry.id} must round-trip unchanged`);
  }
});

test("random designs never pick a paid part the account does not own", () => {
  let seed = 42;
  const random = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < 300; i += 1) {
    const design = web.randomDesign(new Set(), random);
    const parsed = avatarDesignSchema.parse(clone(design)) as AvatarDesignInput;
    assert.deepEqual(paidPartsOf(parsed), []);
  }
  // With the paid parts owned, they can appear.
  const everything = new Set(PAID_PARTS.map((part) => part.catalogKey));
  let sawPaid = false;
  for (let i = 0; i < 300; i += 1) {
    if (paidPartsOf(avatarDesignSchema.parse(clone(web.randomDesign(everything, random)))).length) sawPaid = true;
  }
  assert.ok(sawPaid, "owned paid parts should be eligible");
});

test("layering: a hat hides hairstyles it covers, not long, bob or ponytail", () => {
  const base = { ...web.DEFAULT_DESIGN, accessories: ["cap"] as web.Accessory[] };
  assert.equal(web.resolveLayers({ ...base, hair: "spiky" }).hair, "none");
  assert.equal(web.resolveLayers({ ...base, hair: "bun" }).hair, "none");
  assert.equal(web.resolveLayers({ ...base, hair: "long" }).hair, "long");
  assert.equal(web.resolveLayers({ ...base, hair: "bob" }).hair, "bob");
  assert.equal(web.resolveLayers({ ...base, hair: "ponytail" }).hair, "ponytail");
  assert.equal(web.resolveLayers({ ...web.DEFAULT_DESIGN, hair: "spiky" }).hair, "spiky", "no hat, no hiding");
});

test("layering: an outer jacket covers the chain, hides the base sleeves and folds the hood", () => {
  const hoodie = { ...web.DEFAULT_DESIGN, top: "hoodie" as const, accessories: ["chain"] as web.Accessory[] };
  const open = web.resolveLayers(hoodie);
  assert.equal(open.hoodUp, true);
  assert.equal(open.baseSleeves, true);
  assert.ok(open.accessories.includes("chain"));

  const jacketed = web.resolveLayers({ ...hoodie, outer: "jacket" });
  assert.equal(jacketed.hoodUp, false, "hood folds down under the jacket");
  assert.equal(jacketed.baseSleeves, false, "jacket sleeves replace the base sleeves");
  assert.ok(!jacketed.accessories.includes("chain"), "jacket covers the chain");

  const vested = web.resolveLayers({ ...hoodie, outer: "vest" });
  assert.equal(vested.baseSleeves, true, "a vest has no sleeves, so base sleeves stay");
});

test("layering: one headwear and one eyewear item show; headset clips with caps", () => {
  const twoHeadwear = web.resolveLayers({ ...web.DEFAULT_DESIGN, accessories: ["bandana", "visor"] });
  assert.deepEqual(twoHeadwear.accessories.filter((a) => ["bandana", "visor", "cap", "beanie"].includes(a)), ["visor"]);

  const twoEyewear = web.resolveLayers({ ...web.DEFAULT_DESIGN, accessories: ["glasses", "shades"] });
  assert.deepEqual(twoEyewear.accessories.filter((a) => ["glasses", "shades", "cybershades"].includes(a)), ["shades"]);

  const headsetWithCap = web.resolveLayers({ ...web.DEFAULT_DESIGN, accessories: ["cap", "headset"] });
  assert.ok(headsetWithCap.accessories.includes("cap"));
  assert.ok(!headsetWithCap.accessories.includes("headset"));
});

test("toggling an accessory keeps the single-choice groups clean", () => {
  let list: web.Accessory[] = [];
  list = web.toggleAccessory(list, "cap");
  list = web.toggleAccessory(list, "beanie");
  assert.deepEqual(list, ["beanie"], "beanie replaces the cap");
  list = web.toggleAccessory(list, "beanie");
  assert.deepEqual(list, []);
});

test("option counts for the editor and the report", () => {
  const counts = Object.fromEntries(
    (Object.keys(web.PART_COUNTS) as Array<keyof typeof web.PART_COUNTS>).map((category) => [category, web.PART_COUNTS[category]]),
  );
  assert.deepEqual(counts, {
    hair: { total: HAIR_STYLES.length, paid: 0 },
    top: { total: TOPS.length, paid: 1 },
    outer: { total: OUTERWEAR.length, paid: 1 },
    bottom: { total: BOTTOMS.length, paid: 2 },
    shoes: { total: SHOES.length, paid: 2 },
    accessory: { total: ACCESSORIES.length, paid: 2 },
  });
});

test("ownership of a catalog item comes from the record alone", () => {
  const paid = { priceCoins: 600 };
  const free = { priceCoins: 0 };
  assert.equal(catalog.isCatalogItemAvailable(paid, false), false, "paid and not owned");
  assert.equal(catalog.isCatalogItemAvailable(paid, true), true, "paid and owned");
  assert.equal(catalog.isCatalogItemAvailable(free, false), true, "free items stay available");
});
