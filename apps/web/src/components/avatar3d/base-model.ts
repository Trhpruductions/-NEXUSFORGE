import type * as THREE from "three";

/**
 * The customisable Nexus Forge character, built from original geometry written in code.
 *
 * The viewer builds it at runtime with buildAvatarModel, so it always matches the option lists in
 * design.ts. scripts/avatar-renders can still export it to GLB. That script transpiles this file on
 * its own, so this file must not import anything at runtime. Keep it self-contained.
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

/** Builds the whole character, with every option present in the hierarchy. Visibility is set by design.ts. */
export function buildAvatarModel(T: Lib, body: BodySize = "athletic"): THREE.Group {
  const k = BODY_SIZES[body];
  const w = k.width;
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

  // ----------------------------------------------------------------- legs: bare skin, trousers are overlays
  const legR = 0.095 * k.limb;
  const shinR = 0.085 * k.limb;
  const hips: THREE.Object3D[] = [];
  const knees: THREE.Object3D[] = [];
  for (const side of [-1, 1]) {
    const s = side < 0 ? "L" : "R";
    const hip = group(`Hip_${s}`, root, side * 0.11 * w, 0.95, 0);
    hips.push(hip);
    mesh(new T.CapsuleGeometry(legR, 0.36, 8, 20), materials.Skin, `Thigh_${s}`, hip, 0, -0.2, 0);
    const knee = group(`Knee_${s}`, hip, 0, -0.42, 0);
    knees.push(knee);
    mesh(new T.CapsuleGeometry(shinR, 0.34, 8, 20), materials.Skin, `Shin_${s}`, knee, 0, -0.2, 0);

    // Footwear, one group per style. Only the chosen style shows.
    const sneakers = group(`Shoes_sneakers_${s}`, knee);
    mesh(new T.BoxGeometry(0.16 * w, 0.08, 0.3), materials.Shoes, `Shoes_sneakers_sole_${s}`, sneakers, 0, -0.5, 0.05);
    const boots = group(`Shoes_boots_${s}`, knee);
    mesh(new T.CylinderGeometry(0.1, 0.11, 0.3, 16), materials.Shoes, `Shoes_boots_shaft_${s}`, boots, 0, -0.33, 0.01);
    mesh(new T.BoxGeometry(0.18 * w, 0.08, 0.32), materials.Shoes, `Shoes_boots_toe_${s}`, boots, 0, -0.5, 0.05);
    const hightops = group(`Shoes_hightops_${s}`, knee);
    mesh(new T.BoxGeometry(0.16 * w, 0.08, 0.3), materials.Shoes, `Shoes_hightops_sole_${s}`, hightops, 0, -0.5, 0.05);
    mesh(new T.CylinderGeometry(0.095, 0.1, 0.2, 16), materials.Shoes, `Shoes_hightops_shaft_${s}`, hightops, 0, -0.36, 0.0);
    mesh(new T.BoxGeometry(0.04, 0.1, 0.02), materials.Accent, `Shoes_hightops_lace_${s}`, hightops, 0, -0.38, 0.1);
    const slides = group(`Shoes_slides_${s}`, knee);
    mesh(new T.BoxGeometry(0.15 * w, 0.04, 0.28), materials.Shoes, `Shoes_slides_sole_${s}`, slides, 0, -0.48, 0.04);
    mesh(new T.BoxGeometry(0.15 * w, 0.035, 0.04), materials.Accent, `Shoes_slides_strap_${s}`, slides, 0, -0.45, 0.04);
    const chunky = group(`Shoes_chunky_${s}`, knee);
    mesh(new T.BoxGeometry(0.2 * w, 0.16, 0.34), materials.Accent, `Shoes_chunky_sole_${s}`, chunky, 0, -0.5, 0.04);
    mesh(new T.BoxGeometry(0.16 * w, 0.08, 0.3), materials.Shoes, `Shoes_chunky_upper_${s}`, chunky, 0, -0.44, 0.04);
    const galaxy = group(`Shoes_galaxy_${s}`, knee);
    mesh(new T.BoxGeometry(0.16 * w, 0.1, 0.3), materials.Shoes, `Shoes_galaxy_upper_${s}`, galaxy, 0, -0.45, 0.05);
    mesh(new T.BoxGeometry(0.165 * w, 0.05, 0.31), materials.Accent, `Shoes_galaxy_sole_${s}`, galaxy, 0, -0.5, 0.05);
  }

  // Bottoms: each style is a set of overlays on the hip and knee joints.
  const legOverlay = (id: string, radius: number, material: THREE.Material, length = 0.36) => {
    for (let i = 0; i < 2; i += 1) {
      const s = i === 0 ? "L" : "R";
      mesh(new T.CapsuleGeometry(legR * radius, length, 8, 20), material, `Bottom_${id}_thigh_${s}`, hips[i], 0, -0.2, 0);
      mesh(new T.CapsuleGeometry(shinR * radius, 0.34, 8, 20), material, `Bottom_${id}_shin_${s}`, knees[i], 0, -0.2, 0);
    }
  };
  legOverlay("jeans", 1.06, materials.Pants);
  // Shorts: a thigh-length overlay only.
  for (let i = 0; i < 2; i += 1) {
    const s = i === 0 ? "L" : "R";
    mesh(new T.CapsuleGeometry(legR * 1.08, 0.16, 8, 20), materials.Pants, `Bottom_shorts_thigh_${s}`, hips[i], 0, -0.12, 0);
  }
  legOverlay("cargo", 1.1, materials.Pants);
  for (let i = 0; i < 2; i += 1) {
    const s = i === 0 ? "L" : "R";
    const side = i === 0 ? -1 : 1;
    mesh(new T.BoxGeometry(0.1, 0.14, 0.04), materials.Pants, `Bottom_cargo_pocket_${s}`, hips[i], side * 0.02, -0.18, 0.12);
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
  const shape = (scale: number, pts?: Array<[number, number]>) => new T.LatheGeometry((pts ?? TORSO).map(([r, y]) => new T.Vector2(r * scale * w, y)), 40);
  const torsoMesh = (scale: number, material: THREE.Material, name: string) => mesh(shape(scale), material, name, root, 0, 0.95, 0);

  /** Sleeves on both arms. "short" stops above the elbow; "full" runs to the wrist with a cuff. */
  const addSleeves = (prefix: string, material: THREE.Material, mode: "short" | "full", radiusScale = 1.22) => {
    for (const side of [-1, 1]) {
      const s = side < 0 ? "L" : "R";
      const shoulder = root.getObjectByName(`Shoulder_${s}`)!;
      const elbow = shoulder.getObjectByName(`Elbow_${s}`)!;
      if (mode === "short") {
        mesh(new T.CapsuleGeometry(armR * radiusScale, 0.12, 8, 16), material, `${prefix}_sleeve_${s}`, shoulder, 0, -0.1, 0);
      } else {
        mesh(new T.CapsuleGeometry(armR * radiusScale, 0.24, 8, 16), material, `${prefix}_sleeve_${s}`, shoulder, 0, -0.19, 0);
        mesh(new T.CapsuleGeometry(forearmR * 1.2, 0.2, 8, 16), material, `${prefix}_cuff_${s}`, elbow, 0, -0.16, 0);
      }
    }
  };
  // Arm radii are needed before the sleeves are added, so they are declared here.
  const armR = 0.068 * k.limb;
  const forearmR = 0.06 * k.limb;

  // Arms are built first (below) so the sleeves can attach to the shoulder and elbow joints; the torso
  // garments are added once those joints exist. Torso meshes do not depend on the arms.
  // Base tops:
  torsoMesh(1, materials.Suit, "Top_tee");
  torsoMesh(1.03, materials.Suit, "Top_longsleeve");
  torsoMesh(1.07, materials.Suit, "Top_hoodie");
  const hoodieHood = mesh(new T.SphereGeometry(0.19, 24, 16), materials.Suit, "Top_hoodie_hood", root, 0, 1.6, -0.09);
  hoodieHood.scale.set(1, 0.8, 0.8);
  mesh(new T.BoxGeometry(0.2, 0.12, 0.03), materials.Suit, "Top_hoodie_pocket", root, 0, 1.05, 0.23);
  torsoMesh(1, materials.Suit, "Top_polo");
  mesh(new T.TorusGeometry(0.09 * w, 0.012, 8, 24), materials.Accent, "Top_polo_collar", root, 0, 1.55, 0).rotation.x = Math.PI / 2;
  mesh(new T.BoxGeometry(0.025, 0.12, 0.02), materials.Accent, "Top_polo_placket", root, 0, 1.42, 0.225);
  torsoMesh(0.97, materials.Suit, "Top_tank");
  torsoMesh(1.02, materials.Suit, "Top_jersey");
  for (const side of [-1, 1]) {
    const s = side < 0 ? "L" : "R";
    mesh(new T.BoxGeometry(0.03, 0.5, 0.02), materials.Accent, `Top_jersey_stripe_${s}`, root, side * 0.13 * w, 1.3, 0.2);
  }
  // Outer layers: each covers the base top (larger radius), so they never clip.
  torsoMesh(1.14, materials.Outer, "Top_jacket");
  mesh(new T.BoxGeometry(0.02, 0.5, 0.02), materials.Accent, "Top_jacket_zip", root, 0, 1.1, 0.19);
  torsoMesh(1.12, materials.Outer, "Top_bomber");
  mesh(new T.TorusGeometry(0.17 * w, 0.014, 8, 24), materials.Accent, "Top_bomber_collar", root, 0, 1.52, 0).rotation.x = Math.PI / 2;
  mesh(new T.TorusGeometry(0.21 * w, 0.016, 8, 24), materials.Accent, "Top_bomber_hem", root, 0, 0.99, 0).rotation.x = Math.PI / 2;
  torsoMesh(1.12, materials.Outer, "Top_vest");
  for (const side of [-1, 1]) {
    const s = side < 0 ? "L" : "R";
    mesh(new T.BoxGeometry(0.03, 0.5, 0.02), materials.Accent, `Top_vest_trim_${s}`, root, side * 0.12 * w, 1.2, 0.23);
  }
  torsoMesh(1.13, materials.Outer, "Top_neon");
  mesh(new T.BoxGeometry(0.02, 0.5, 0.02), materials.Accent, "Top_neon_zip", root, 0, 1.1, 0.19);

  // ----------------------------------------------------------------- accessories on the chest
  // The chain is a tube along a path that lies on the chest, clear of the base top.
  const chainPath = [
    [-0.1, 1.6, 0.06],
    [-0.12, 1.5, 0.21],
    [0, 1.44, 0.25],
    [0.12, 1.5, 0.21],
    [0.1, 1.6, 0.06],
  ].map(([x, y, z]) => new T.Vector3(x * w, y, z * w));
  mesh(new T.TubeGeometry(new T.CatmullRomCurve3(chainPath), 48, 0.009, 8, false), materials.Metal, "Acc_chain", root);
  mesh(new T.CylinderGeometry(0.07 * w, 0.075 * w, 0.16, 20), materials.Skin, "Neck", root, 0, 1.6, 0);
  mesh(new T.BoxGeometry(0.3, 0.42, 0.14), materials.Dark, "Acc_backpack", root, 0, 1.2, -0.22);
  mesh(new T.BoxGeometry(0.31, 0.12, 0.03), materials.Accent, "Acc_backpack_flap", root, 0, 1.36, -0.23);

  // ----------------------------------------------------------------- head, face and hair
  const head = group("Head", root, 0, 1.7, 0);
  const skull = mesh(new T.SphereGeometry(0.13, 32, 24), materials.Skin, "Skull", head);
  skull.scale.set(0.9, 1.08, 0.96);
  for (const side of [-1, 1]) {
    const s = side < 0 ? "L" : "R";
    mesh(new T.SphereGeometry(0.03, 12, 10), materials.Skin, `Ear_${s}`, head, side * 0.122, -0.01, 0).scale.set(0.5, 1, 0.8);
    mesh(new T.SphereGeometry(0.022, 16, 12), materials.Eyes, `Eye_${s}`, head, side * 0.058, 0.015, 0.128);
  }

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

  // ----------------------------------------------------------------- accessories on the head
  // Cap: a dome and brim in Accent.
  const cap = mesh(new T.SphereGeometry(0.152, 32, 16, 0, Math.PI * 2, 0, 0.95), materials.Accent, "Acc_cap", head, 0, 0.012, 0);
  cap.scale.set(0.95, 1.06, 0.98);
  mesh(new T.BoxGeometry(0.25, 0.012, 0.12), materials.Accent, "Acc_cap_brim", head, 0, 0.03, 0.165).rotation.x = -0.22;
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

  // ----------------------------------------------------------------- arms (joints, skin and sleeves)
  for (const side of [-1, 1]) {
    const s = side < 0 ? "L" : "R";
    const shoulder = group(`Shoulder_${s}`, root, side * 0.27 * w, 1.45, 0);
    shoulder.rotation.z = side * -0.12;
    mesh(new T.CapsuleGeometry(armR, 0.24, 8, 16), materials.Skin, `UpperArm_${s}`, shoulder, 0, -0.19, 0);
    const elbow = group(`Elbow_${s}`, shoulder, 0, -0.36, 0);
    elbow.rotation.x = -0.12;
    mesh(new T.CapsuleGeometry(forearmR, 0.2, 8, 16), materials.Skin, `Forearm_${s}`, elbow, 0, -0.16, 0);
    mesh(new T.SphereGeometry(0.07 * k.limb, 16, 12), materials.Skin, `Hand_${s}`, elbow, 0, -0.33, 0).scale.set(0.85, 1.25, 0.9);
  }
  // Sleeves attach to the joints above, so they are added after the arms exist.
  addSleeves("Top_tee", materials.Suit, "short");
  addSleeves("Top_polo", materials.Suit, "short");
  addSleeves("Top_jersey", materials.Suit, "short");
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

/** Torso profile in (radius, height) pairs, shared by the base top and the outer layers. */
const TORSO: Array<[number, number]> = [
  [0.19, 0.0],
  [0.165, 0.1],
  [0.155, 0.22],
  [0.19, 0.34],
  [0.225, 0.44],
  [0.215, 0.52],
  [0.16, 0.58],
];

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
