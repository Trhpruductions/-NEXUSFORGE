import type * as THREE from "three";
import { humanParts, polygonize, type PartSpec } from "./body-sdf";

/**
 * The customisable Nexus Forge character, built from original geometry written in code.
 *
 * The viewer builds it at runtime with buildAvatarModel, so it always matches the option lists in
 * design.ts. scripts/avatar-renders can still export it to GLB. That script transpiles this file on
 * its own. The skin parts are organic: head, arms, hands and legs come from body-sdf.ts, which blends signed distance
 * fields and polygonises them with marching cubes. Garments, hair and accessories are still lathes and primitives.
 *
 * Naming contract (option ids are listed in design.ts):
 *  - Hair_<id>[_...]        hair styles, children of Head (ponytail has a pivot)
 *  - Top_<id>[_...]         base tops and outer layers, with their sleeves (children of the shoulder joints) and cuffs (elbows)
 *  - Bottom_<id>_<part>_<s> trouser overlays: thighs under the hips, shins under the knees
 *  - Shoes_<id>[_...]_L/_R  footwear, children of the knee joints
 *  - Acc_<id>[_...]         accessories (head, face, chest and back)
 *  - Joints                 Hip_*, Knee_*, Shoulder_*, Elbow_*, Head: pivots for poses
 *  - Skin                   the bare legs and arms under every garment; trousers are overlays
 *  - Materials              Skin, Hair, Eyes, Suit, Outer, Pants, Shoes, Accent, Metal, Dark
 *
 * Units are metres. The figure stands on y = 0 and faces +z. Left is -x (the character's left).
 * Node names must not contain underscores inside an option id, because applyDesign splits on "_".
 *
 * Shapes are smooth solids of revolution (see revolve) and squashed spheres (see blob), so limbs taper,
 * the chest is wider than it is deep, and the face has a brow, a nose and a jaw.
 */

export type Lib = typeof THREE;

export const MATERIAL_SLOTS = ["Skin", "Hair", "Eyes", "Suit", "Outer", "Pants", "Shoes", "Accent", "Metal", "Dark"] as const;
export type MaterialSlot = (typeof MATERIAL_SLOTS)[number];

export const BODY_SIZES = {
  slim: { width: 0.9, limb: 0.9 },
  athletic: { width: 1, limb: 1 },
  broad: { width: 1.14, limb: 1.12 },
} as const;
export type BodySize = keyof typeof BODY_SIZES;

const SLOT_DEFAULTS: Record<MaterialSlot, { color: string; roughness: number; metalness: number }> = {
  Skin: { color: "#d9a577", roughness: 0.5, metalness: 0 },
  Hair: { color: "#22d3ee", roughness: 0.5, metalness: 0 },
  Eyes: { color: "#38bdf8", roughness: 0.3, metalness: 0 },
  Suit: { color: "#1b1e26", roughness: 0.75, metalness: 0 },
  Outer: { color: "#1b1e26", roughness: 0.75, metalness: 0 },
  Pants: { color: "#1d2029", roughness: 0.8, metalness: 0 },
  Shoes: { color: "#111318", roughness: 0.5, metalness: 0 },
  Accent: { color: "#2ea4ff", roughness: 0.4, metalness: 0.2 },
  Metal: { color: "#cbd5e1", roughness: 0.25, metalness: 0.9 },
  Dark: { color: "#0b1220", roughness: 0.3, metalness: 0.3 },
};

/** Cloth takes a soft sheen, so fabric reads as fabric rather than plastic. */
const CLOTH_SLOTS: ReadonlySet<MaterialSlot> = new Set<MaterialSlot>(["Suit", "Outer", "Pants"]);

/** Torso profile in (radius, height) pairs, bottom to top. Shared by the base top and the outer layers. */
const TORSO: Array<[number, number]> = [
  [0.19, 0.0],
  [0.165, 0.1],
  [0.155, 0.22],
  [0.19, 0.34],
  [0.225, 0.44],
  [0.215, 0.52],
  [0.16, 0.58],
];

/** The oversized tee: wider through the chest and hanging lower over the hips. */
const OVERSIZED_TORSO: Array<[number, number]> = [
  [0.2, -0.06],
  [0.205, 0.02],
  [0.2, 0.1],
  [0.19, 0.22],
  [0.222, 0.34],
  [0.25, 0.44],
  [0.245, 0.52],
  [0.19, 0.58],
];

/** The snapback crown, bottom to top. It sits over the hair and stays open at the base. */
const CAP_CROWN: Array<[number, number]> = [
  [0.134, 0.06],
  [0.142, 0.085],
  [0.148, 0.12],
  [0.138, 0.16],
  [0.095, 0.19],
  [0.0, 0.2],
];

// Limb profiles are (radius, height) pairs, bottom to top, measured from each joint. The body's limb factor scales them.
const THIGH: Array<[number, number]> = [
  [0.0, -0.46],
  [0.07, -0.44],
  [0.082, -0.4],
  [0.094, -0.3],
  [0.104, -0.16],
  [0.108, -0.05],
  [0.1, 0.0],
  [0.0, 0.03],
];
const SHIN: Array<[number, number]> = [
  [0.0, -0.47],
  [0.04, -0.46],
  [0.058, -0.42],
  [0.066, -0.32],
  [0.074, -0.2],
  [0.072, -0.12],
  [0.068, -0.02],
  [0.07, 0.04],
  [0.0, 0.05],
];
const SHORTS_THIGH: Array<[number, number]> = [
  [0.0, -0.16],
  [0.11, -0.15],
  [0.124, -0.08],
  [0.124, 0.0],
  [0.12, 0.04],
  [0.0, 0.06],
];

/** A smooth solid of revolution through (radius, height) points, listed bottom to top. */
function revolve(T: Lib, points: Array<[number, number]>, segments = 28, phiStart = 0, phiLength = Math.PI * 2): THREE.LatheGeometry {
  const curve = new T.SplineCurve(points.map(([r, y]) => new T.Vector2(r, y)));
  const smooth = curve.getPoints(points.length * 6).map((p) => new T.Vector2(Math.max(0, p.x), p.y));
  return new T.LatheGeometry(smooth, segments, phiStart, phiLength);
}

/** Multiplies the radius of every point in a profile and keeps its height. */
function scaleRadius(points: Array<[number, number]>, factor: number): Array<[number, number]> {
  return points.map(([r, y]): [number, number] => [r * factor, y]);
}

/** A sleeve that starts at its joint and runs `length` down the limb, flaring a little at the hem. */
function sleeveProfile(length: number, radius: number, flare: number): Array<[number, number]> {
  return [
    [0.0, -length - 0.01],
    [radius * flare * 0.9, -length],
    [radius * flare, -length + 0.02],
    [radius * 1.02, -length * 0.4],
    [radius, 0.0],
    [radius * 0.9, 0.02],
    [0.0, 0.035],
  ];
}

/** Builds the whole character, with every option present in the hierarchy. Visibility is set by design.ts. */
export function buildAvatarModel(T: Lib, body: BodySize = "athletic"): THREE.Group {
  const k = BODY_SIZES[body];
  const w = k.width;
  const limb = k.limb;
  const armR = 0.07 * limb;
  const forearmR = 0.056 * limb;
  const materials = {} as Record<MaterialSlot, THREE.MeshStandardMaterial>;
  for (const slot of MATERIAL_SLOTS) {
    const d = SLOT_DEFAULTS[slot];
    const m = CLOTH_SLOTS.has(slot)
      ? new T.MeshPhysicalMaterial({ color: d.color, roughness: d.roughness, metalness: d.metalness, sheen: 0.25, sheenRoughness: 0.6, sheenColor: new T.Color("#64748b") })
      : new T.MeshStandardMaterial({ color: d.color, roughness: d.roughness, metalness: d.metalness });
    m.name = slot;
    // Hair and accent trim are thin, so both faces show: the cap's brim has a visible underside.
    if (slot === "Hair" || slot === "Accent") m.side = T.DoubleSide;
    materials[slot] = m;
  }

  const unitSphere = new T.SphereGeometry(1, 20, 14);
  // The organic parts for this body size. Each is a polygonised field, placed under the joint it belongs to.
  const human = humanParts(limb);
  const skinPart = (name: string, part: PartSpec, parent: THREE.Object3D) => {
    const mc = polygonize(part, materials.Skin);
    mc.name = name;
    parent.add(mc);
    return mc;
  };
  const root = new T.Group();
  root.name = "Avatar";

  const place = <O extends THREE.Object3D>(object: O, name: string, parent: THREE.Object3D, x = 0, y = 0, z = 0) => {
    object.name = name;
    object.position.set(x, y, z);
    parent.add(object);
    return object;
  };
  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, name: string, parent: THREE.Object3D, x = 0, y = 0, z = 0) =>
    place(new T.Mesh(geometry, material), name, parent, x, y, z);
  const group = (name: string, parent: THREE.Object3D, x = 0, y = 0, z = 0) => place(new T.Group(), name, parent, x, y, z);
  /** A squashed sphere: half-sizes rx, ry, rz. Used for feet, hands, the nose and the jaw. */
  const blob = (name: string, material: THREE.Material, parent: THREE.Object3D, rx: number, ry: number, rz: number, x = 0, y = 0, z = 0) => {
    const m = mesh(unitSphere, material, name, parent, x, y, z);
    m.scale.set(rx, ry, rz);
    return m;
  };

  // ----------------------------------------------------------------- legs: bare skin, trousers are overlays
  const hips: THREE.Object3D[] = [];
  const knees: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const s = side < 0 ? "L" : "R";
    const hip = group(`Hip_${s}`, root, side * 0.11 * w, 0.95, 0);
    hips.push(hip);
    skinPart(`Thigh_${s}`, human.thigh, hip);
    const knee = group(`Knee_${s}`, hip, 0, -0.42, 0);
    knees.push(knee);
    skinPart(`Shin_${s}`, human.shin, knee);

    // Footwear, one group per style. Only the chosen style shows. Each foot is a few rounded solids.
    const sneakers = group(`Shoes_sneakers_${s}`, knee);
    blob(`Shoes_sneakers_sole_${s}`, materials.Shoes, sneakers, 0.085 * w, 0.028, 0.16, 0, -0.515, 0.05);
    blob(`Shoes_sneakers_upper_${s}`, materials.Shoes, sneakers, 0.075 * w, 0.06, 0.14, 0, -0.475, 0.035);
    const boots = group(`Shoes_boots_${s}`, knee);
    mesh(revolve(T, [[0.0, -0.5], [0.086, -0.49], [0.09, -0.4], [0.086, -0.33], [0.0, -0.32]], 24), materials.Shoes, `Shoes_boots_shaft_${s}`, boots);
    blob(`Shoes_boots_toe_${s}`, materials.Shoes, boots, 0.085 * w, 0.07, 0.16, 0, -0.47, 0.05);
    const hightops = group(`Shoes_hightops_${s}`, knee);
    blob(`Shoes_hightops_sole_${s}`, materials.Shoes, hightops, 0.075 * w, 0.03, 0.14, 0, -0.5, 0.05);
    mesh(revolve(T, [[0.0, -0.46], [0.078, -0.45], [0.082, -0.38], [0.08, -0.3], [0.0, -0.28]], 24), materials.Shoes, `Shoes_hightops_shaft_${s}`, hightops);
    mesh(new T.BoxGeometry(0.04, 0.1, 0.02), materials.Accent, `Shoes_hightops_lace_${s}`, hightops, 0, -0.38, 0.1);
    const slides = group(`Shoes_slides_${s}`, knee);
    blob(`Shoes_slides_sole_${s}`, materials.Shoes, slides, 0.075 * w, 0.02, 0.13, 0, -0.5, 0.04);
    blob(`Shoes_slides_strap_${s}`, materials.Accent, slides, 0.07 * w, 0.012, 0.03, 0, -0.48, 0.04);
    const chunky = group(`Shoes_chunky_${s}`, knee);
    blob(`Shoes_chunky_sole_${s}`, materials.Accent, chunky, 0.095 * w, 0.06, 0.165, 0, -0.53, 0.04);
    blob(`Shoes_chunky_upper_${s}`, materials.Shoes, chunky, 0.075 * w, 0.06, 0.15, 0, -0.47, 0.04);
    const galaxy = group(`Shoes_galaxy_${s}`, knee);
    blob(`Shoes_galaxy_upper_${s}`, materials.Shoes, galaxy, 0.072 * w, 0.065, 0.15, 0, -0.46, 0.05);
    blob(`Shoes_galaxy_sole_${s}`, materials.Accent, galaxy, 0.077 * w, 0.03, 0.155, 0, -0.5, 0.05);
  }

  // Bottoms: each style is a set of overlays on the hip and knee joints.
  const legOverlay = (id: string, radiusMul: number, material: THREE.Material) => {
    for (let i = 0; i < 2; i += 1) {
      const s = i === 0 ? "L" : "R";
      mesh(revolve(T, scaleRadius(THIGH, limb * radiusMul)), material, `Bottom_${id}_thigh_${s}`, hips[i]);
      mesh(revolve(T, scaleRadius(SHIN, limb * radiusMul)), material, `Bottom_${id}_shin_${s}`, knees[i]);
    }
  };
  legOverlay("jeans", 1.06, materials.Pants);
  // Shorts: a thigh-length overlay only.
  for (let i = 0; i < 2; i += 1) {
    const s = i === 0 ? "L" : "R";
    mesh(revolve(T, scaleRadius(SHORTS_THIGH, limb * 1.08)), materials.Pants, `Bottom_shorts_thigh_${s}`, hips[i]);
  }
  legOverlay("cargo", 1.1, materials.Pants);
  for (let i = 0; i < 2; i += 1) {
    const s = i === 0 ? "L" : "R";
    const side = i === 0 ? -1 : 1;
    mesh(new T.BoxGeometry(0.09, 0.12, 0.02), materials.Pants, `Bottom_cargo_pocket_${s}`, hips[i], side * 0.02, -0.18, 0.124);
    // The webbing straps are the accent trim, as on the reference cargos.
    mesh(new T.BoxGeometry(0.018, 0.28, 0.012), materials.Accent, `Bottom_cargo_strap_${s}`, hips[i], side * 0.06, -0.2, 0.118);
  }
  legOverlay("track", 1.06, materials.Pants);
  for (let i = 0; i < 2; i += 1) {
    const s = i === 0 ? "L" : "R";
    const side = i === 0 ? -1 : 1;
    mesh(new T.BoxGeometry(0.03, 0.36, 0.02), materials.Accent, `Bottom_track_stripe_${s}`, hips[i], side * 0.08, -0.4, 0.1);
  }
  legOverlay("tactical", 1.12, materials.Pants);
  for (let i = 0; i < 2; i += 1) {
    const s = i === 0 ? "L" : "R";
    const side = i === 0 ? -1 : 1;
    mesh(new T.BoxGeometry(0.1, 0.14, 0.04), materials.Pants, `Bottom_tactical_pocket_${s}`, hips[i], side * 0.03, -0.2, 0.13);
    mesh(new T.BoxGeometry(0.03, 0.3, 0.02), materials.Accent, `Bottom_tactical_strap_${s}`, hips[i], side * 0.08, -0.2, 0.12);
  }
  legOverlay("armored", 1.12, materials.Pants);
  for (let i = 0; i < 2; i += 1) {
    const s = i === 0 ? "L" : "R";
    mesh(new T.BoxGeometry(0.09, 0.2, 0.03), materials.Metal, `Bottom_armored_plate_thigh_${s}`, hips[i], 0, -0.2, 0.12);
    mesh(new T.BoxGeometry(0.08, 0.18, 0.03), materials.Metal, `Bottom_armored_plate_shin_${s}`, knees[i], 0, -0.2, 0.1);
  }

  // ----------------------------------------------------------------- torso garments (base tops and outer layers)
  const torso = (scale: number, pts: Array<[number, number]> = TORSO) => revolve(T, scaleRadius(pts, scale * w));
  /** Garments are pressed flatter front to back, so the chest reads as a chest rather than a barrel. */
  const torsoMesh = (scale: number, material: THREE.Material, name: string, pts?: Array<[number, number]>) => {
    const m = mesh(torso(scale, pts), material, name, root, 0, 0.95, 0);
    m.scale.set(1.1, 1, 0.84);
    return m;
  };

  // Arms are built first (below) so the sleeves can attach to the shoulder and elbow joints; the torso
  // garments are added once those joints exist. Torso meshes do not depend on the arms.
  // Base tops:
  torsoMesh(1, materials.Suit, "Top_tee");
  torsoMesh(1.03, materials.Suit, "Top_longsleeve");
  torsoMesh(1.07, materials.Suit, "Top_hoodie");
  const hoodieHood = mesh(new T.SphereGeometry(0.19, 24, 16), materials.Suit, "Top_hoodie_hood", root, 0, 1.6, -0.09);
  hoodieHood.scale.set(1, 0.8, 0.8);
  mesh(new T.BoxGeometry(0.2, 0.12, 0.03), materials.Suit, "Top_hoodie_pocket", root, 0, 1.05, 0.2);
  torsoMesh(1, materials.Suit, "Top_polo");
  mesh(new T.TorusGeometry(0.09 * w, 0.012, 8, 24), materials.Accent, "Top_polo_collar", root, 0, 1.55, 0).rotation.x = Math.PI / 2;
  mesh(new T.BoxGeometry(0.025, 0.12, 0.02), materials.Accent, "Top_polo_placket", root, 0, 1.42, 0.19);
  torsoMesh(0.97, materials.Suit, "Top_tank");
  torsoMesh(1.02, materials.Suit, "Top_jersey");
  for (const side of [-1, 1]) {
    const s = side < 0 ? "L" : "R";
    mesh(new T.BoxGeometry(0.03, 0.5, 0.02), materials.Accent, `Top_jersey_stripe_${s}`, root, side * 0.13 * w, 1.3, 0.18);
  }
  torsoMesh(1, materials.Suit, "Top_oversized", OVERSIZED_TORSO);
  // Flame strokes on the oversized tee, in the accent colour: slim bands, lying on the chest, across its right side.
  for (let i = 0; i < 4; i += 1) {
    mesh(new T.BoxGeometry(0.022, 0.2 - i * 0.02, 0.006), materials.Accent, `Top_oversized_flame_${i}`, root, 0.1 + i * 0.03, 1.0 - i * 0.05, 0.176).rotation.z = -0.6;
  }
  // Outer layers: each covers the base top (larger radius), so they never clip.
  torsoMesh(1.14, materials.Outer, "Top_jacket");
  mesh(new T.BoxGeometry(0.02, 0.5, 0.02), materials.Accent, "Top_jacket_zip", root, 0, 1.1, 0.16);
  torsoMesh(1.12, materials.Outer, "Top_bomber");
  mesh(new T.TorusGeometry(0.17 * w, 0.014, 8, 24), materials.Accent, "Top_bomber_collar", root, 0, 1.52, 0).rotation.x = Math.PI / 2;
  mesh(new T.TorusGeometry(0.21 * w, 0.016, 8, 24), materials.Accent, "Top_bomber_hem", root, 0, 0.99, 0).rotation.x = Math.PI / 2;
  torsoMesh(1.12, materials.Outer, "Top_vest");
  for (const side of [-1, 1]) {
    const s = side < 0 ? "L" : "R";
    mesh(new T.BoxGeometry(0.03, 0.5, 0.02), materials.Accent, `Top_vest_trim_${s}`, root, side * 0.12 * w, 1.2, 0.2);
  }
  torsoMesh(1.13, materials.Outer, "Top_neon");
  mesh(new T.BoxGeometry(0.02, 0.5, 0.02), materials.Accent, "Top_neon_zip", root, 0, 1.1, 0.16);

  // ----------------------------------------------------------------- accessories on the chest
  // The chain is a tube along a path that lies on the chest, close to the skin. The cross hangs from its low point.
  const chainPath = [
    [-0.1, 1.58, 0.1],
    [-0.12, 1.47, 0.19],
    [0, 1.41, 0.205],
    [0.12, 1.47, 0.19],
    [0.1, 1.58, 0.1],
  ].map(([x, y, z]) => new T.Vector3(x * w, y, z * w));
  mesh(new T.TubeGeometry(new T.CatmullRomCurve3(chainPath), 48, 0.009, 8, false), materials.Metal, "Acc_chain", root);
  mesh(new T.BoxGeometry(0.014, 0.06, 0.008), materials.Metal, "Acc_chain_cross_v", root, 0, 1.36, 0.21);
  mesh(new T.BoxGeometry(0.04, 0.014, 0.008), materials.Metal, "Acc_chain_cross_h", root, 0, 1.375, 0.212);
  mesh(new T.CylinderGeometry(0.07 * w, 0.075 * w, 0.16, 20), materials.Skin, "Neck", root, 0, 1.6, 0);
  mesh(new T.BoxGeometry(0.3, 0.42, 0.14), materials.Dark, "Acc_backpack", root, 0, 1.2, -0.22);
  mesh(new T.BoxGeometry(0.31, 0.12, 0.03), materials.Accent, "Acc_backpack_flap", root, 0, 1.36, -0.23);

  // ----------------------------------------------------------------- head, face and hair
  const head = group("Head", root, 0, 1.7, 0);
  skinPart("Skull", human.skull, head);
  for (const side of [-1, 1]) {
    const s = side < 0 ? "L" : "R";
    blob(`Ear_${s}`, materials.Skin, head, 0.015, 0.03, 0.024, side * 0.122, -0.01, 0);
    // Eyes keep their own geometry: applyDesign sets the scale for each eye style.
    mesh(new T.SphereGeometry(0.022, 16, 12), materials.Eyes, `Eye_${s}`, head, side * 0.056, 0.015, 0.124);
    // Brows take the hair colour. The tilt puts the inner ends a little lower.
    mesh(new T.BoxGeometry(0.052, 0.012, 0.02), materials.Hair, `Brow_${s}`, head, side * 0.056, 0.05, 0.116).rotation.z = -side * 0.12;
  }
  blob("Nose", materials.Skin, head, 0.02, 0.034, 0.026, 0, -0.025, 0.128);
  mesh(new T.BoxGeometry(0.044, 0.007, 0.012), materials.Dark, "Mouth", head, 0, -0.07, 0.118);

  const hairShell = (theta: number, name: string, radius = 0.14) => {
    const m = mesh(new T.SphereGeometry(radius, 40, 24, 0, Math.PI * 2, 0, theta), materials.Hair, name, head, 0, 0.005, 0);
    m.scale.set(0.97, 1.13, 1.03);
    return m;
  };
  hairShell(1.15, "Hair_buzz");
  hairShell(1.2, "Hair_spiky");
  for (let i = 0; i < 9; i += 1) {
    const angle = (i / 9) * Math.PI * 2;
    const spike = mesh(new T.ConeGeometry(0.03, 0.2, 8), materials.Hair, `Hair_spiky_${i}`, head, Math.cos(angle) * 0.09, 0.13, Math.sin(angle) * 0.09);
    spike.rotation.set(Math.sin(angle) * 0.45, 0, -Math.cos(angle) * 0.45);
  }
  hairShell(1.5, "Hair_long");
  {
    const longTotal = 0.42;
    const back = new T.CylinderGeometry(0.15, 0.175, longTotal, 28, 6, true, Math.PI - 0.95, 1.9);
    mesh(back, materials.Hair, "Hair_long_back", head, 0, 0.1 - longTotal / 2, -0.005);
    for (const side of [-1, 1]) {
      const centre = side < 0 ? (3 * Math.PI) / 2 : Math.PI / 2;
      mesh(new T.CylinderGeometry(0.155, 0.175, longTotal * 0.9, 24, 6, true, centre - 0.8, 1.6), materials.Hair, `Hair_long_side_${side < 0 ? "L" : "R"}`, head, 0, 0.02 - longTotal * 0.45, 0);
    }
  }
  hairShell(1.2, "Hair_curls");
  for (let i = 0; i < 16; i += 1) {
    const angle = (i / 16) * Math.PI * 2;
    mesh(new T.SphereGeometry(0.05, 12, 10), materials.Hair, `Hair_curls_${i}`, head, Math.cos(angle) * 0.13, i % 2 === 0 ? 0.12 : 0.1, Math.sin(angle) * 0.12);
  }
  hairShell(1.1, "Hair_bun");
  mesh(new T.SphereGeometry(0.065, 20, 16), materials.Hair, "Hair_bun_knot", head, 0, 0.13, -0.11);
  hairShell(1.0, "Hair_mohawk");
  mesh(new T.BoxGeometry(0.04, 0.18, 0.28), materials.Hair, "Hair_mohawk_ridge", head, 0, 0.14, -0.01);
  // Bob: a shell to the ears, then a short band that stops at the jaw.
  hairShell(1.5, "Hair_bob");
  {
    const back = new T.CylinderGeometry(0.15, 0.165, 0.2, 28, 4, true, Math.PI - 0.95, 1.9);
    mesh(back, materials.Hair, "Hair_bob_back", head, 0, -0.03, -0.005);
    for (const side of [-1, 1]) {
      const centre = side < 0 ? (3 * Math.PI) / 2 : Math.PI / 2;
      mesh(new T.CylinderGeometry(0.155, 0.165, 0.18, 24, 4, true, centre - 0.8, 1.6), materials.Hair, `Hair_bob_side_${side < 0 ? "L" : "R"}`, head, 0, -0.02, 0);
    }
  }
  // Ponytail: a shell, a tie and a tail that hangs down the back.
  hairShell(1.2, "Hair_ponytail");
  {
    const pivot = group("Hair_ponytail_pivot", head, 0, 0.04, -0.13);
    pivot.rotation.x = 0.5;
    mesh(new T.CylinderGeometry(0.03, 0.02, 0.3, 12), materials.Hair, "Hair_ponytail_tail", pivot, 0, -0.15, 0);
    mesh(new T.TorusGeometry(0.035, 0.01, 8, 16), materials.Accent, "Hair_ponytail_tie", pivot, 0, 0.0, 0).rotation.x = Math.PI / 2;
  }
  // Afro: a sphere set back from the face so the features stay in front.
  mesh(new T.SphereGeometry(0.2, 32, 24), materials.Hair, "Hair_afro", head, 0, 0.03, -0.07);
  // Side fringe: a swept slab across the forehead above the eyes.
  hairShell(1.2, "Hair_fringe");
  mesh(new T.BoxGeometry(0.2, 0.035, 0.05), materials.Hair, "Hair_fringe_sweep", head, 0.02, 0.058, 0.122).rotation.set(-0.5, 0, -0.25);
  // Mullet: a fuller crown, a back cut in three layers that flares out to the shoulders, side curtains, and a feathered
  // edge of alternating strand lengths.
  hairShell(1.25, "Hair_mullet_top", 0.142).scale.set(1.0, 1.08, 1.04);
  const backLayers: Array<[number, number, number, number]> = [
    [0.13, 0.19, 0.5, -0.12],
    [0.135, 0.205, 0.44, -0.14],
    [0.13, 0.215, 0.36, -0.17],
  ];
  backLayers.forEach(([top, bottom, height, y], index) => {
    mesh(new T.CylinderGeometry(top, bottom, height, 32, 6, true, Math.PI - 1.3 + index * 0.08, 2.6 - index * 0.16), materials.Hair, `Hair_mullet_back_${index}`, head, 0, y, -0.035 - index * 0.006);
  });
  for (const side of [-1, 1]) {
    const centre = side < 0 ? (3 * Math.PI) / 2 : Math.PI / 2;
    mesh(new T.CylinderGeometry(0.14, 0.18, 0.32, 24, 4, true, centre - 0.75, 1.5), materials.Hair, `Hair_mullet_side_${side < 0 ? "L" : "R"}`, head, 0, -0.1, 0);
  }
  for (let i = 0; i < 11; i += 1) {
    const angle = Math.PI - 1.25 + (i / 10) * 2.5;
    const strand = mesh(new T.ConeGeometry(0.02, i % 2 === 0 ? 0.15 : 0.1, 5), materials.Hair, `Hair_mullet_shag_${i}`, head, Math.sin(angle) * 0.2, -0.37, Math.cos(angle) * 0.2 - 0.03);
    strand.rotation.x = Math.PI;
    strand.rotation.z = -Math.sin(angle) * 0.25;
  }

  // ----------------------------------------------------------------- accessories on the head
  // Snapback: a crown that sits over the hair, and a flat brim. The crown takes the top colour; the brim takes the accent,
  // so the underside shows the accent as the reference cap does.
  // The crown is split: the front panels take the top colour, and the back panels are a light mesh, as on the reference.
  const meshPanel = new T.MeshStandardMaterial({ color: "#e5e7eb", roughness: 0.9, metalness: 0 });
  meshPanel.name = "Mesh";
  mesh(revolve(T, CAP_CROWN, 32, Math.PI + 1.1, Math.PI * 2 - 2.2), materials.Suit, "Acc_cap", head, 0, -0.004, 0);
  mesh(revolve(T, CAP_CROWN, 24, Math.PI - 1.1, 2.2), meshPanel, "Acc_cap_mesh", head, 0, -0.004, 0);
  // A flat, solid brim with a thin edge: its underside takes the accent colour.
  const brim = new T.Shape();
  brim.absarc(0, 0, 0.13, Math.PI, 2 * Math.PI, false);
  mesh(new T.ExtrudeGeometry(brim, { depth: 0.008, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2, curveSegments: 28 }), materials.Accent, "Acc_cap_brim", head, 0, 0.078, 0.122).rotation.x = -Math.PI / 2 + 0.1;
  // Beanie: a knit dome with a cuff, in Accent.
  mesh(new T.SphereGeometry(0.165, 32, 16, 0, Math.PI * 2, 0, 1.22), materials.Accent, "Acc_beanie", head, 0, 0.0, 0);
  mesh(new T.TorusGeometry(0.163, 0.018, 8, 32), materials.Accent, "Acc_beanie_cuff", head, 0, 0.04, 0).rotation.x = Math.PI / 2;
  // Visor: a head band with a sports brim, in Accent.
  mesh(new T.TorusGeometry(0.146, 0.016, 8, 40), materials.Accent, "Acc_visor_band", head, 0, 0.085, 0).rotation.x = Math.PI / 2;
  mesh(new T.BoxGeometry(0.24, 0.01, 0.1), materials.Accent, "Acc_visor_brim", head, 0, 0.095, 0.17).rotation.x = -0.3;
  // Shades: two dark lenses and a bridge. The lenses sit just in front of the eyes.
  for (const side of [-1, 1]) mesh(new T.BoxGeometry(0.068, 0.034, 0.012), materials.Dark, `Acc_shades_${side < 0 ? "L" : "R"}`, head, side * 0.058, 0.025, 0.155);
  mesh(new T.BoxGeometry(0.03, 0.01, 0.01), materials.Dark, "Acc_shades_bridge", head, 0, 0.027, 0.157);
  // Round glasses: two rings around the eyes, a bridge and the arms.
  for (const side of [-1, 1]) {
    const s = side < 0 ? "L" : "R";
    mesh(new T.TorusGeometry(0.034, 0.005, 8, 24), materials.Dark, `Acc_glasses_lens_${s}`, head, side * 0.058, 0.015, 0.155);
    mesh(new T.BoxGeometry(0.01, 0.008, 0.13), materials.Dark, `Acc_glasses_arm_${s}`, head, side * 0.095, 0.02, 0.04);
  }
  mesh(new T.BoxGeometry(0.03, 0.006, 0.006), materials.Dark, "Acc_glasses_bridge", head, 0, 0.02, 0.155);
  // Cyber shades: a wraparound lens bar with Accent edges.
  mesh(new T.BoxGeometry(0.2, 0.05, 0.012), materials.Dark, "Acc_cybershades_lens", head, 0, 0.025, 0.158);
  for (const side of [-1, 1]) {
    const s = side < 0 ? "L" : "R";
    mesh(new T.BoxGeometry(0.01, 0.05, 0.03), materials.Accent, `Acc_cybershades_strip_${s}`, head, side * 0.1, 0.025, 0.12);
  }
  // Mask: covers the lower face.
  mesh(new T.BoxGeometry(0.19, 0.09, 0.06), materials.Accent, "Acc_mask", head, 0, -0.06, 0.14);
  // Headset: a band over the head with a boom mic.
  mesh(new T.TorusGeometry(0.15, 0.011, 8, 32, Math.PI), materials.Dark, "Acc_headset", head);
  mesh(new T.CylinderGeometry(0.012, 0.012, 0.08, 10), materials.Dark, "Acc_headset_mic", head, 0.14, -0.07, 0.09).rotation.x = Math.PI / 4;
  // Bandana: a band across the forehead with a tail.
  const bandana = mesh(new T.TorusGeometry(0.146, 0.018, 8, 40), materials.Accent, "Acc_bandana", head, 0, 0.075, 0);
  bandana.rotation.x = Math.PI / 2;
  mesh(new T.BoxGeometry(0.04, 0.06, 0.02), materials.Accent, "Acc_bandana_tail", head, 0.13, 0.04, -0.06);

  // ----------------------------------------------------------------- arms (joints, skin and hands)
  for (const side of [-1, 1]) {
    const s = side < 0 ? "L" : "R";
    const shoulder = group(`Shoulder_${s}`, root, side * 0.27 * w, 1.45, 0);
    shoulder.rotation.z = side * -0.12;
    skinPart(`UpperArm_${s}`, human.upperArm, shoulder);
    const elbow = group(`Elbow_${s}`, shoulder, 0, -0.36, 0);
    elbow.rotation.x = -0.12;
    skinPart(`Forearm_${s}`, human.forearm, elbow);
    skinPart(`Hand_${s}`, human.hand(side as -1 | 1), elbow);
    // Wrist accessories, shown with the watch or bracelet option: a watch on the right wrist, a bracelet on the left.
    if (s === "R") {
      mesh(new T.TorusGeometry(forearmR * 1.1, 0.009, 8, 24), materials.Dark, "Acc_watch_band", elbow, 0, -0.3, 0).rotation.x = Math.PI / 2;
      blob("Acc_watch_face", materials.Dark, elbow, 0.02, 0.022, 0.012, 0, -0.3, forearmR * 1.1);
    } else {
      mesh(new T.TorusGeometry(forearmR * 1.1, 0.008, 8, 24), materials.Metal, "Acc_bracelet_band", elbow, 0, -0.31, 0).rotation.x = Math.PI / 2;
    }
  }
  // Sleeves attach to the joints above, so they are added after the arms exist.
  const addSleeves = (prefix: string, material: THREE.Material, mode: "short" | "wide" | "full", radiusScale = 1.2) => {
    for (const side of [-1, 1]) {
      const s = side < 0 ? "L" : "R";
      const shoulder = root.getObjectByName(`Shoulder_${s}`)!;
      const elbow = shoulder.getObjectByName(`Elbow_${s}`)!;
      if (mode === "full") {
        mesh(revolve(T, sleeveProfile(0.33, armR * radiusScale, 1)), material, `${prefix}_sleeve_${s}`, shoulder);
        mesh(revolve(T, sleeveProfile(0.26, forearmR * 1.2, 1.04)), material, `${prefix}_cuff_${s}`, elbow);
      } else {
        const length = mode === "wide" ? 0.2 : 0.13;
        mesh(revolve(T, sleeveProfile(length, armR * radiusScale, mode === "wide" ? 1.12 : 1)), material, `${prefix}_sleeve_${s}`, shoulder);
      }
    }
  };
  addSleeves("Top_tee", materials.Suit, "short");
  addSleeves("Top_polo", materials.Suit, "short");
  addSleeves("Top_jersey", materials.Suit, "short");
  addSleeves("Top_oversized", materials.Suit, "wide", 1.3);
  addSleeves("Top_longsleeve", materials.Suit, "full");
  addSleeves("Top_hoodie", materials.Suit, "full");
  addSleeves("Top_jacket", materials.Outer, "full");
  addSleeves("Top_bomber", materials.Outer, "full");
  addSleeves("Top_neon", materials.Outer, "full");
  // The vest and the tank have no sleeves, so the arms stay bare under them.
  for (const side of [-1, 1]) {
    const s = side < 0 ? "L" : "R";
    const shoulder = root.getObjectByName(`Shoulder_${s}`)!;
    mesh(new T.CapsuleGeometry(armR * 1.3, 0.04, 8, 16), materials.Accent, `Top_neon_stripe_${s}`, shoulder, 0, -0.28, 0);
    mesh(new T.CapsuleGeometry(armR * 1.27, 0.03, 8, 16), materials.Accent, `Top_jersey_trim_${s}`, shoulder, 0, -0.2, 0);
  }

  return root;
}

/** Releases the GPU buffers and textures of a model built by buildAvatarModel. Call it when the viewer unmounts. */
export function disposeAvatar(root: THREE.Object3D) {
  root.traverse((node) => {
    const object = node as THREE.Mesh;
    if (object.geometry) object.geometry.dispose();
    const material = object.material as THREE.Material | THREE.Material[] | undefined;
    if (!material) return;
    for (const m of Array.isArray(material) ? material : [material]) {
      for (const value of Object.values(m)) {
        if (value && typeof value === "object" && (value as THREE.Texture).isTexture) (value as THREE.Texture).dispose();
      }
      m.dispose();
    }
  });
}

/** Back-compat name used by the first export. */
export const buildBaseModel = buildAvatarModel;
