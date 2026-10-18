import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { buildAvatarModel, disposeAvatar, MATERIAL_SLOTS } from "../src/components/avatar3d/base-model";
import { ACCESSORIES, BOTTOMS, DEFAULT_DESIGN, DESIGN_PRESETS, HAIR_STYLES, OUTERWEAR, PART_OPTIONS, SHOES, TOPS, applyDesign, type AvatarDesign } from "../src/components/avatar3d/design";

/**
 * Builds the real procedural figure with three.js (no browser) and checks the naming contract and the
 * layering rules against the node tree. This does not check how it looks: that needs a visual check.
 */

type Named = THREE.Object3D & { material?: THREE.Material | THREE.Material[] };

const nodes = (root: THREE.Object3D): Named[] => {
  const all: Named[] = [];
  root.traverse((node) => all.push(node as Named));
  return all;
};

/** A node shows only if it and every parent are visible. */
const shown = (node: THREE.Object3D): boolean => {
  for (let current: THREE.Object3D | null = node; current; current = current.parent) {
    if (!current.visible) return false;
  }
  return true;
};

const find = (root: THREE.Object3D, name: string) => {
  const found = nodes(root).filter((node) => node.name === name);
  assert.ok(found.length >= 1, `missing node ${name}`);
  return found[0];
};

const withDesign = (overrides: Partial<AvatarDesign>): AvatarDesign => ({ ...DEFAULT_DESIGN, ...overrides });

test("every option has a matching node in the model (naming contract)", () => {
  const root = buildAvatarModel(THREE, "athletic");
  const names = nodes(root).map((node) => node.name);
  const prefixOf: Record<string, string> = { hair: "Hair", top: "Top", outer: "Top", bottom: "Bottom", shoes: "Shoes", accessory: "Acc" };
  for (const category of Object.keys(prefixOf) as Array<keyof typeof prefixOf>) {
    for (const option of PART_OPTIONS[category as keyof typeof PART_OPTIONS]) {
      if (option.id === "none") continue;
      const prefix = prefixOf[category];
      const matched = names.some((name) => name.split("_")[0] === prefix && name.split("_")[1] === option.id);
      assert.ok(matched, `no node for ${prefix}_${option.id}`);
    }
  }
});

test("every Hair_, Top_, Bottom_, Shoes_ and Acc_ node belongs to a listed option", () => {
  const root = buildAvatarModel(THREE, "athletic");
  const known: Record<string, Set<string>> = {
    Hair: new Set(HAIR_STYLES),
    Top: new Set([...TOPS, ...OUTERWEAR]),
    Bottom: new Set(BOTTOMS),
    Shoes: new Set(SHOES),
    Acc: new Set(ACCESSORIES),
  };
  for (const node of nodes(root)) {
    const [kind, option] = node.name.split("_");
    if (!known[kind]) continue;
    assert.ok(known[kind].has(option), `${node.name} uses an option id that is not listed (${option})`);
  }
});

test("the model has one node for every material slot, and every slot is used", () => {
  const root = buildAvatarModel(THREE, "athletic");
  const used = new Set<string>();
  for (const node of nodes(root)) {
    const material = (node as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined;
    if (!material) continue;
    for (const m of Array.isArray(material) ? material : [material]) used.add(m.name);
  }
  for (const slot of MATERIAL_SLOTS) assert.ok(used.has(slot), `slot ${slot} is not used by any node`);
});

test("default design: the base layers show and the other options stay hidden", () => {
  const root = buildAvatarModel(THREE, "athletic");
  applyDesign(root as unknown as Parameters<typeof applyDesign>[0], DEFAULT_DESIGN);
  assert.ok(shown(find(root, "Top_tee")));
  assert.ok(!shown(find(root, "Top_jacket")));
  assert.ok(shown(find(root, "Bottom_jeans_thigh_L")));
  assert.ok(!shown(find(root, "Bottom_cargo_thigh_L")));
  assert.ok(shown(find(root, "Hair_spiky")));
  assert.ok(!shown(find(root, "Hair_buzz")));
  assert.ok(shown(find(root, "Shoes_sneakers_L")));
  assert.ok(!shown(find(root, "Shoes_boots_L")));
  assert.ok(!shown(find(root, "Acc_cap")));
  assert.ok(shown(find(root, "Thigh_L")), "bare thigh under the jeans overlay still exists");
});

test("a hat hides the hairstyles it covers, and not long hair", () => {
  const root = buildAvatarModel(THREE, "athletic");
  applyDesign(root as unknown as Parameters<typeof applyDesign>[0], withDesign({ hair: "spiky", accessories: ["cap"] }));
  assert.ok(!shown(find(root, "Hair_spiky")), "cap hides spiky hair");
  assert.ok(shown(find(root, "Acc_cap")));

  applyDesign(root as unknown as Parameters<typeof applyDesign>[0], withDesign({ hair: "long", accessories: ["cap"] }));
  assert.ok(shown(find(root, "Hair_long_back")), "long hair comes out from under a cap");
});

test("an outer jacket covers the base sleeves, folds the hood and hides the chain", () => {
  const root = buildAvatarModel(THREE, "athletic");
  applyDesign(root as unknown as Parameters<typeof applyDesign>[0], withDesign({ top: "hoodie", accessories: ["chain"] }));
  assert.ok(shown(find(root, "Top_hoodie_hood")), "hood is up without an outer layer");
  assert.ok(shown(find(root, "Top_hoodie_sleeve_L")), "hoodie sleeves show without an outer layer");
  assert.ok(shown(find(root, "Acc_chain")));

  applyDesign(root as unknown as Parameters<typeof applyDesign>[0], withDesign({ top: "hoodie", outer: "jacket", accessories: ["chain"] }));
  assert.ok(shown(find(root, "Top_jacket")), "jacket torso shows");
  assert.ok(shown(find(root, "Top_jacket_sleeve_L")), "jacket sleeves show");
  assert.ok(!shown(find(root, "Top_hoodie_hood")), "hood folds down under the jacket");
  assert.ok(!shown(find(root, "Top_hoodie_sleeve_L")), "hoodie sleeves are covered by the jacket");
  assert.ok(!shown(find(root, "Acc_chain")), "chain is covered by the jacket");
});

test("a vest keeps the base sleeves, because it has none", () => {
  const root = buildAvatarModel(THREE, "athletic");
  applyDesign(root as unknown as Parameters<typeof applyDesign>[0], withDesign({ top: "longsleeve", outer: "vest" }));
  assert.ok(shown(find(root, "Top_vest")));
  assert.ok(shown(find(root, "Top_longsleeve_sleeve_L")));
});

test("a colour reaches its own material slot and no other", () => {
  const root = buildAvatarModel(THREE, "athletic");
  applyDesign(root as unknown as Parameters<typeof applyDesign>[0], withDesign({ topColor: "#ff0000", outerColor: "#00ff00", metalColor: "#0000ff", darkColor: "#ffff00" }));
  const colourOf = (slot: string) => {
    const hit = nodes(root).find((node) => {
      const material = (node as THREE.Mesh).material as THREE.Material | undefined;
      return material?.name === slot;
    });
    return ((hit as THREE.Mesh).material as THREE.MeshStandardMaterial).color.getHexString();
  };
  assert.equal(colourOf("Suit"), "ff0000");
  assert.equal(colourOf("Outer"), "00ff00");
  assert.equal(colourOf("Metal"), "0000ff");
  assert.equal(colourOf("Dark"), "ffff00");
});

test("eye style scales the eyes", () => {
  const root = buildAvatarModel(THREE, "athletic");
  applyDesign(root as unknown as Parameters<typeof applyDesign>[0], withDesign({ eyeStyle: "sharp" }));
  const eye = find(root, "Eye_L");
  assert.deepEqual([eye.scale.x, eye.scale.y, eye.scale.z], [1.1, 0.7, 1]);
});

test("every ready-made preset applies to the model", () => {
  for (const entry of DESIGN_PRESETS) {
    const root = buildAvatarModel(THREE, entry.design.body);
    assert.doesNotThrow(() => applyDesign(root as unknown as Parameters<typeof applyDesign>[0], entry.design));
    assert.ok(nodes(root).some((node) => shown(node) && node.name.startsWith("Top_")), `${entry.id} shows a top`);
  }
});

test("disposing a model frees its geometry and materials without error", () => {
  const root = buildAvatarModel(THREE, "broad");
  let disposed = 0;
  root.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.addEventListener("dispose", () => (disposed += 1));
  });
  assert.doesNotThrow(() => disposeAvatar(root));
  assert.ok(disposed > 50, `expected many geometries to dispose, got ${disposed}`);
});
