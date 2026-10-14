import type * as THREE from "three";

/**
 * The customisable Nexus Forge character, built from original geometry written in code.
 *
 * It is exported to GLB (one file per body size) by scripts/avatar-renders, and the viewer
 * switches parts on and off by node name and recolours material slots by name. Nothing here is
 * a third-party model.
 *
 * Naming contract (see catalog.ts for the option ids):
 *  - Hair_<id>            hair styles, children of Head
 *  - Top_<id>[_...]       tops and their sleeves, children of the torso or the arm joints
 *  - Bottom_<id>[_...]    trousers overlays, children of the hips
 *  - Shoes_<id>_L/_R      footwear, children of the knee joints
 *  - Acc_<id>             accessories (cap, chain, shades, mask, headset, bandana)
 *  - Joints               Hip_*, Knee_*, Shoulder_*, Elbow_*, Head: pivots for poses
 *  - Materials            Skin, Hair, Eyes, Suit, Pants, Shoes, Accent, Metal, Dark
 *
 * Units are metres. The figure stands on y = 0 and faces +z. Left is -x (the character's left).
 */

export type Lib = typeof THREE;

export const MATERIAL_SLOTS = ["Skin", "Hair", "Eyes", "Suit", "Pants", "Shoes", "Accent", "Metal", "Dark"] as const;
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
  Pants: { color: "#1d2029", roughness: 0.8, metalness: 0 },
  Shoes: { color: "#111318", roughness: 0.5, metalness: 0 },
  Accent: { color: "#2ea4ff", roughness: 0.4, metalness: 0.2 },
  Metal: { color: "#cbd5e1", roughness: 0.25, metalness: 0.9 },
  Dark: { color: "#0b1220", roughness: 0.3, metalness: 0.3 },
};

/** Builds the whole character, with every option present in the hierarchy. */
export function buildAvatarModel(T: Lib, body: BodySize = "athletic"): THREE.Group {
  const k = BODY_SIZES[body];
  const materials = {} as Record<MaterialSlot, THREE.MeshStandardMaterial>;
  for (const slot of MATERIAL_SLOTS) {
    const d = SLOT_DEFAULTS[slot];
    const m = new T.MeshStandardMaterial({ color: d.color, roughness: d.roughness, metalness: d.metalness });
    m.name = slot;
    if (slot === "Hair") m.side = T.DoubleSide;
    materials[slot] = m;
  }

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

  // ----------------------------------------------------------------- legs (joints + base trousers)
  const legR = 0.095 * k.limb;
  const shinR = 0.085 * k.limb;
  for (const side of [-1, 1]) {
    const s = side < 0 ? "L" : "R";
    const hip = group(`Hip_${s}`, root, side * 0.11 * k.width, 0.95, 0);
    mesh(new T.CapsuleGeometry(legR, 0.36, 8, 20), materials.Pants, `Thigh_${s}`, hip, 0, -0.2, 0);
    const bottomCargo = group(`Bottom_cargo_${s}`, hip);
    mesh(new T.CapsuleGeometry(legR * 1.1, 0.36, 8, 20), materials.Pants, `Bottom_cargo_leg_${s}`, bottomCargo, 0, -0.2, 0);
    mesh(new T.BoxGeometry(0.1, 0.14, 0.04), materials.Pants, `Bottom_cargo_pocket_${s}`, bottomCargo, side * 0.02, -0.18, 0.12);
    const bottomTrack = group(`Bottom_track_${s}`, hip);
    mesh(new T.BoxGeometry(0.03, 0.36, 0.02), materials.Accent, `Bottom_track_stripe_${s}`, bottomTrack, side * 0.08, -0.4, 0.1);

    const knee = group(`Knee_${s}`, hip, 0, -0.42, 0);
    mesh(new T.CapsuleGeometry(shinR, 0.34, 8, 20), materials.Pants, `Shin_${s}`, knee, 0, -0.2, 0);
    const sneakers = group(`Shoes_sneakers_${s}`, knee);
    mesh(new T.BoxGeometry(0.16 * k.width, 0.08, 0.3), materials.Shoes, `Shoes_sneakers_sole_${s}`, sneakers, 0, -0.5, 0.05);
    const boots = group(`Shoes_boots_${s}`, knee);
    mesh(new T.CylinderGeometry(0.1, 0.11, 0.3, 16), materials.Shoes, `Shoes_boots_shaft_${s}`, boots, 0, -0.33, 0.01);
    mesh(new T.BoxGeometry(0.18 * k.width, 0.08, 0.32), materials.Shoes, `Shoes_boots_toe_${s}`, boots, 0, -0.5, 0.05);
  }

  // ----------------------------------------------------------------- torso (the base tee) and chain
  const profile: Array<[number, number]> = [[0.19, 0.0], [0.165, 0.1], [0.155, 0.22], [0.19, 0.34], [0.225, 0.44], [0.215, 0.52], [0.16, 0.58]];
  const shape = (scale: number, pts = profile) => new T.LatheGeometry(pts.map(([r, y]) => new T.Vector2(r * scale * k.width, y)), 40);
  mesh(shape(1), materials.Suit, "Top_tee", root, 0, 0.95, 0);
  mesh(shape(1.07), materials.Suit, "Top_hoodie", root, 0, 0.95, 0);
  const hoodieHood = mesh(new T.SphereGeometry(0.19, 24, 16), materials.Suit, "Top_hoodie_hood", root, 0, 1.6, -0.09);
  hoodieHood.scale.set(1, 0.8, 0.8);
  mesh(new T.BoxGeometry(0.2, 0.12, 0.03), materials.Suit, "Top_hoodie_pocket", root, 0, 1.05, 0.23);
  mesh(shape(1.08), materials.Suit, "Top_jacket", root, 0, 0.95, 0);
  mesh(new T.BoxGeometry(0.02, 0.5, 0.02), materials.Accent, "Top_jacket_zip", root, 0, 1.1, 0.24);
  mesh(new T.TorusGeometry(0.105, 0.011, 8, 32), materials.Metal, "Acc_chain", root, 0, 1.5, 0.05).rotation.x = Math.PI / 2 - 0.35;
  mesh(new T.CylinderGeometry(0.07 * k.width, 0.075 * k.width, 0.16, 20), materials.Skin, "Neck", root, 0, 1.6, 0);

  // ----------------------------------------------------------------- head, face and hair
  const head = group("Head", root, 0, 1.7, 0);
  const skull = mesh(new T.SphereGeometry(0.13, 32, 24), materials.Skin, "Skull", head);
  skull.scale.set(0.9, 1.08, 0.96);
  for (const side of [-1, 1]) {
    const s = side < 0 ? "L" : "R";
    mesh(new T.SphereGeometry(0.03, 12, 10), materials.Skin, `Ear_${s}`, head, side * 0.122, -0.01, 0).scale.set(0.5, 1, 0.8);
    mesh(new T.SphereGeometry(0.022, 16, 12), materials.Eyes, `Eye_${s}`, head, side * 0.058, 0.015, 0.128);
  }

  const hairShell = (theta: number, name: string) => {
    const m = mesh(new T.SphereGeometry(0.14, 40, 24, 0, Math.PI * 2, 0, theta), materials.Hair, name, head, 0, 0.005, 0);
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
  const longTotal = 0.42;
  const back = new T.CylinderGeometry(0.15, 0.175, longTotal, 28, 6, true, Math.PI - 0.95, 1.9);
  mesh(back, materials.Hair, "Hair_long_back", head, 0, 0.1 - longTotal / 2, -0.005);
  for (const side of [-1, 1]) {
    const centre = side < 0 ? (3 * Math.PI) / 2 : Math.PI / 2;
    mesh(new T.CylinderGeometry(0.155, 0.175, longTotal * 0.9, 24, 6, true, centre - 0.8, 1.6), materials.Hair, `Hair_long_side_${side < 0 ? "L" : "R"}`, head, 0, 0.02 - longTotal * 0.45, 0);
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

  // ----------------------------------------------------------------- accessories on the head
  // Cap: a dome and brim in Accent.
  const cap = mesh(new T.SphereGeometry(0.152, 32, 16, 0, Math.PI * 2, 0, 0.95), materials.Accent, "Acc_cap", head, 0, 0.012, 0);
  cap.scale.set(0.95, 1.06, 0.98);
  mesh(new T.BoxGeometry(0.25, 0.012, 0.12), materials.Accent, "Acc_cap_brim", head, 0, 0.03, 0.165).rotation.x = -0.22;
  // Shades: two dark lenses and a bridge.
  for (const side of [-1, 1]) mesh(new T.BoxGeometry(0.068, 0.034, 0.012), materials.Dark, `Acc_shades_${side < 0 ? "L" : "R"}`, head, side * 0.058, 0.025, 0.143);
  mesh(new T.BoxGeometry(0.03, 0.01, 0.01), materials.Dark, "Acc_shades_bridge", head, 0, 0.027, 0.145);
  // Mask: covers the lower face.
  mesh(new T.BoxGeometry(0.19, 0.09, 0.06), materials.Accent, "Acc_mask", head, 0, -0.06, 0.14);
  // Headset: a band over the head with a boom mic.
  mesh(new T.TorusGeometry(0.15, 0.011, 8, 32, Math.PI), materials.Dark, "Acc_headset", head);
  mesh(new T.CylinderGeometry(0.012, 0.012, 0.08, 10), materials.Dark, "Acc_headset_mic", head, 0.14, -0.07, 0.09).rotation.x = Math.PI / 4;
  // Bandana: a band across the forehead with a tail.
  const bandana = mesh(new T.TorusGeometry(0.146, 0.018, 8, 40), materials.Accent, "Acc_bandana", head, 0, 0.075, 0);
  bandana.rotation.x = Math.PI / 2;
  mesh(new T.BoxGeometry(0.04, 0.06, 0.02), materials.Accent, "Acc_bandana_tail", head, 0.13, 0.04, -0.06);

  // ----------------------------------------------------------------- arms (joints + sleeves)
  const armR = 0.068 * k.limb;
  const forearmR = 0.06 * k.limb;
  for (const side of [-1, 1]) {
    const s = side < 0 ? "L" : "R";
    const shoulder = group(`Shoulder_${s}`, root, side * 0.27 * k.width, 1.45, 0);
    shoulder.rotation.z = side * -0.12;
    mesh(new T.CapsuleGeometry(armR, 0.24, 8, 16), materials.Skin, `UpperArm_${s}`, shoulder, 0, -0.19, 0);
    mesh(new T.CapsuleGeometry(armR * 1.22, 0.1, 8, 16), materials.Suit, `Top_hoodie_sleeve_${s}`, shoulder, 0, -0.1, 0);
    mesh(new T.CapsuleGeometry(armR * 1.22, 0.12, 8, 16), materials.Suit, `Top_tee_sleeve_${s}`, shoulder, 0, -0.1, 0);
    const elbow = group(`Elbow_${s}`, shoulder, 0, -0.36, 0);
    elbow.rotation.x = -0.12;
    mesh(new T.CapsuleGeometry(forearmR, 0.2, 8, 16), materials.Skin, `Forearm_${s}`, elbow, 0, -0.16, 0);
    mesh(new T.CapsuleGeometry(forearmR * 1.2, 0.2, 8, 16), materials.Suit, `Top_hoodie_cuff_${s}`, elbow, 0, -0.16, 0);
    mesh(new T.SphereGeometry(0.07 * k.limb, 16, 12), materials.Skin, `Hand_${s}`, elbow, 0, -0.33, 0).scale.set(0.85, 1.25, 0.9);
  }

  return root;
}

/** Back-compat name used by the first export. */
export const buildBaseModel = buildAvatarModel;
