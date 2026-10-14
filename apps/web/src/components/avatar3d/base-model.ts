import type * as THREE from "three";

/**
 * The base character for the Nexus Forge 3D avatar system.
 *
 * This is original geometry written in code (no third-party model files). It is exported once to
 * a GLB by scripts/avatar-renders (see README there) and loaded by the viewer. Everything the
 * customiser changes is addressed by name:
 *
 *  - Joints (Hips, Head, Shoulder_L, Elbow_L, ...) are pivots for poses.
 *  - Materials (Skin, Suit, Pants, Shoes, Hair, Eyes, Accent) are the colour and finish slots.
 *  - Meshes are the parts; clothing and accessories are added later as named child nodes.
 *
 * Units are metres. The figure stands on y = 0 and faces +z. Left is -x (character's left).
 */

export type Lib = typeof THREE;

export const MATERIAL_SLOTS = ["Skin", "Suit", "Pants", "Shoes", "Hair", "Eyes", "Accent"] as const;
export type MaterialSlot = (typeof MATERIAL_SLOTS)[number];

const DEFAULTS: Record<MaterialSlot, { color: string; roughness: number; metalness: number }> = {
  Skin: { color: "#d9a577", roughness: 0.5, metalness: 0 },
  Suit: { color: "#1b1e26", roughness: 0.75, metalness: 0 },
  Pants: { color: "#1d2029", roughness: 0.8, metalness: 0 },
  Shoes: { color: "#111318", roughness: 0.5, metalness: 0 },
  Hair: { color: "#22d3ee", roughness: 0.5, metalness: 0 },
  Eyes: { color: "#38bdf8", roughness: 0.3, metalness: 0 },
  Accent: { color: "#2ea4ff", roughness: 0.4, metalness: 0.2 },
};

/** Builds the base figure. Pass the three.js namespace; the same code runs in the app and the exporter. */
export function buildBaseModel(T: Lib): THREE.Group {
  const materials = {} as Record<MaterialSlot, THREE.MeshStandardMaterial>;
  for (const slot of MATERIAL_SLOTS) {
    const d = DEFAULTS[slot];
    const m = new T.MeshStandardMaterial({ color: d.color, roughness: d.roughness, metalness: d.metalness });
    m.name = slot;
    materials[slot] = m;
  }

  const root = new T.Group();
  root.name = "Avatar";

  const named = <O extends THREE.Object3D>(object: O, name: string, parent: THREE.Object3D) => {
    object.name = name;
    parent.add(object);
    return object;
  };
  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, name: string, parent: THREE.Object3D, x = 0, y = 0, z = 0) => {
    const m = new T.Mesh(geometry, material);
    m.position.set(x, y, z);
    return named(m, name, parent);
  };
  const joint = (name: string, parent: THREE.Object3D, x = 0, y = 0, z = 0) => {
    const g = new T.Group();
    g.position.set(x, y, z);
    return named(g, name, parent);
  };

  // Legs: hip joint, thigh, knee joint, shin, shoe.
  for (const side of [-1, 1]) {
    const s = side < 0 ? "L" : "R";
    const hip = joint(`Hip_${s}`, root, side * 0.11, 0.95, 0);
    mesh(new T.CapsuleGeometry(0.095, 0.36, 8, 20), materials.Pants, `Thigh_${s}`, hip, 0, -0.2, 0);
    const knee = joint(`Knee_${s}`, hip, 0, -0.42, 0);
    mesh(new T.CapsuleGeometry(0.085, 0.34, 8, 20), materials.Pants, `Shin_${s}`, knee, 0, -0.2, 0);
    mesh(new T.BoxGeometry(0.16, 0.08, 0.3), materials.Shoes, `Shoe_${s}`, knee, 0, -0.5, 0.05);
  }

  // Torso and neck.
  const torsoProfile: Array<[number, number]> = [[0.19, 0.0], [0.165, 0.1], [0.155, 0.22], [0.19, 0.34], [0.225, 0.44], [0.215, 0.52], [0.16, 0.58]];
  mesh(new T.LatheGeometry(torsoProfile.map(([r, y]) => new T.Vector2(r, y)), 40), materials.Suit, "Torso", root, 0, 0.95, 0);
  mesh(new T.CylinderGeometry(0.07, 0.075, 0.16, 20), materials.Skin, "Neck", root, 0, 1.6, 0);

  // Head, with the eyes as children so they follow the head in a pose.
  const head = joint("Head", root, 0, 1.7, 0);
  const skull = mesh(new T.SphereGeometry(0.13, 32, 24), materials.Skin, "Skull", head);
  skull.scale.set(0.9, 1.08, 0.96);
  for (const side of [-1, 1]) {
    const s = side < 0 ? "L" : "R";
    const ear = mesh(new T.SphereGeometry(0.03, 12, 10), materials.Skin, `Ear_${s}`, head, side * 0.122, -0.01, 0);
    ear.scale.set(0.5, 1, 0.8);
    const eye = mesh(new T.SphereGeometry(0.022, 16, 12), materials.Eyes, `Eye_${s}`, head, side * 0.058, 0.015, 0.128);
    void eye;
  }

  // Arms: shoulder joint, upper arm, elbow joint, forearm, hand.
  for (const side of [-1, 1]) {
    const s = side < 0 ? "L" : "R";
    const shoulder = joint(`Shoulder_${s}`, root, side * 0.27, 1.45, 0);
    shoulder.rotation.z = side * -0.12;
    mesh(new T.CapsuleGeometry(0.068, 0.24, 8, 16), materials.Skin, `UpperArm_${s}`, shoulder, 0, -0.19, 0);
    const elbow = joint(`Elbow_${s}`, shoulder, 0, -0.36, 0);
    elbow.rotation.x = -0.12;
    mesh(new T.CapsuleGeometry(0.06, 0.2, 8, 16), materials.Skin, `Forearm_${s}`, elbow, 0, -0.16, 0);
    mesh(new T.SphereGeometry(0.07, 16, 12), materials.Skin, `Hand_${s}`, elbow, 0, -0.33, 0).scale.set(0.85, 1.25, 0.9);
  }

  return root;
}
