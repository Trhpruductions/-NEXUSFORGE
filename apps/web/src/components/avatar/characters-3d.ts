import type * as THREE from "three";

/**
 * The six avatar looks from the Nexus Forge mockups, built from three.js primitives.
 * Shared by the live 3D avatar (components/avatar/avatar-3d.tsx) and the offline render
 * page, so a render always matches what members see in the studio.
 *
 * Coordinates: the figure stands on y = 0 and faces +z. Head origin is at y = 1.7.
 */

export type Lib = typeof THREE;
type MatOpts = Partial<THREE.MeshStandardMaterialParameters>;

export const LOOK_IDS = ["cyber", "shadow", "knight", "street", "sorceress", "nomad"] as const;
export type LookId = (typeof LOOK_IDS)[number];

export const LOOKS: Record<LookId, { label: string; tier: string; accent: string; skin: string; hair: "none" | "buzz" | "long" }> = {
  cyber: { label: "Cyber Ops", tier: "Legendary", accent: "#22d3ee", skin: "#d9a577", hair: "none" },
  shadow: { label: "Shadow Hunter", tier: "Epic", accent: "#ef4444", skin: "#c48a5a", hair: "none" },
  knight: { label: "Nexus Knight", tier: "Epic", accent: "#2ea4ff", skin: "#d9a577", hair: "none" },
  street: { label: "Street Icon", tier: "Rare", accent: "#2ea4ff", skin: "#e8b894", hair: "buzz" },
  sorceress: { label: "Void Sorceress", tier: "Epic", accent: "#a855f7", skin: "#f1d3bc", hair: "long" },
  nomad: { label: "Tech Nomad", tier: "Rare", accent: "#f59e0b", skin: "#b0744a", hair: "buzz" },
};

export type CharacterRig = {
  group: THREE.Group;
  /** Torso and head, for the breathing motion. */
  body: THREE.Group;
  head: THREE.Group;
  /** Shoulder pivots: rotate these to raise or lower the arms. */
  armL: THREE.Group;
  armR: THREE.Group;
};

type Ctx = {
  T: Lib;
  root: THREE.Group;
  head: THREE.Group;
  shoulders: THREE.Group[];
  elbows: THREE.Group[];
  accent: string;
  mat: (color: string, o?: MatOpts) => THREE.MeshStandardMaterial;
  metal: (color: string, o?: MatOpts) => THREE.MeshStandardMaterial;
  cloth: (color: string, o?: MatOpts) => THREE.MeshStandardMaterial;
  glow: (color: string, power?: number) => THREE.MeshStandardMaterial;
  put: (parent: THREE.Object3D, geo: THREE.BufferGeometry, material: THREE.Material, x?: number, y?: number, z?: number) => THREE.Mesh;
  grp: (parent: THREE.Object3D, x?: number, y?: number, z?: number) => THREE.Group;
  g: {
    capsule: (r: number, len: number) => THREE.BufferGeometry;
    sphere: (r: number, ws?: number, hs?: number) => THREE.BufferGeometry;
    box: (w: number, h: number, d: number) => THREE.BufferGeometry;
    torus: (r: number, t: number) => THREE.BufferGeometry;
    lathe: (pts: Array<[number, number]>) => THREE.BufferGeometry;
    cyl: (rTop: number, rBottom: number, h: number, seg?: number, open?: boolean, theta?: number, arc?: number) => THREE.BufferGeometry;
    cone: (r: number, h: number) => THREE.BufferGeometry;
    plane: (w: number, h: number, ws: number, hs: number) => THREE.BufferGeometry;
  };
  /** Hair shell over the skull. theta sets how far it reaches down (radians from the top). */
  helmetHair: (m: THREE.Material, theta?: number) => THREE.Mesh;
};

/** Torso outline as [radius, height] pairs, from hips to shoulders. */
const TORSO: Array<[number, number]> = [[0.19, 0.0], [0.165, 0.1], [0.155, 0.22], [0.19, 0.34], [0.225, 0.44], [0.215, 0.52], [0.16, 0.58]];
const scaleTorso = (k: number): Array<[number, number]> => TORSO.map(([r, y]) => [r * k, y]);

/** Wobbles a sheet of cloth so it reads as fabric rather than a flat tube. */
function wave(geo: THREE.BufferGeometry, amp: number, freq: number, phase = 0, axis: "x" | "z" = "z") {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i += 1) {
    const off = Math.sin(p.getY(i) * freq + phase) * amp;
    if (axis === "z") p.setZ(i, p.getZ(i) + off);
    else p.setX(i, p.getX(i) + off);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Hair curtains down the back and both sides, reaching the shoulders. Two-sided, so the sides show from the front. */
function longHair(c: Ctx, material: THREE.Material, len: number) {
  c.helmetHair(material, 1.5);
  const total = 0.22 + 0.24 * len;
  c.put(c.head, wave(c.g.cyl(0.15, 0.175, total, 28, true, Math.PI - 0.95, 1.9), 0.012, 6), material, 0, 0.1 - total / 2, -0.005);
  for (const side of [-1, 1]) {
    const centre = side < 0 ? (3 * Math.PI) / 2 : Math.PI / 2;
    c.put(c.head, wave(c.g.cyl(0.155, 0.175, total * 0.9, 24, true, centre - 0.8, 1.6), 0.01, 7, side * 1.3), material, 0, 0.02 - total * 0.45, 0);
  }
}

/** Short buzzed hair. */
function buzzHair(c: Ctx, material: THREE.Material) {
  c.helmetHair(material, 1.15);
}

// --------------------------------------------------------------------------- outfits

const OUTFITS: Record<LookId, (c: Ctx) => void> = {
  cyber(c) {
    // Dark bodysuit, armoured helmet with a glowing visor, chest plate and glowing boots.
    c.put(c.root, c.g.lathe(scaleTorso(1.035)), c.mat("#0d1117", { roughness: 0.5, metalness: 0.3 }), 0, 0.95, 0);
    c.put(c.head, c.g.sphere(0.165, 40, 28), c.metal("#111827"), 0, 0.01, 0).scale.set(0.95, 1.1, 0.98);
    c.put(c.head, c.g.box(0.22, 0.07, 0.05), c.glow(c.accent, 1.6), 0, 0.02, 0.14);
    c.put(c.head, c.g.box(0.03, 0.09, 0.22), c.metal("#1f2937"), 0, 0.17, 0);
    for (const s of c.shoulders) {
      c.put(s, c.g.sphere(0.13), c.metal("#1f2937"), 0, 0.02, 0).scale.set(1.1, 0.6, 1.1);
      c.put(s, c.g.torus(0.12, 0.008), c.glow(c.accent, 1.4), 0, 0.07, 0).rotation.x = Math.PI / 2;
    }
    c.put(c.root, c.g.box(0.3, 0.22, 0.06), c.metal("#1f2937"), 0, 1.23, 0.22);
    for (const x of [-0.09, 0.09]) c.put(c.root, c.g.box(0.012, 0.18, 0.012), c.glow(c.accent, 1.6), x, 1.23, 0.25);
    c.put(c.root, c.g.torus(0.205, 0.02), c.glow(c.accent, 1.2), 0, 0.97, 0).rotation.x = Math.PI / 2;
    for (const e of c.elbows) c.put(e, c.g.capsule(0.072, 0.12), c.metal("#1f2937"), 0, -0.2, 0);
    for (const x of [-0.11, 0.11]) {
      c.put(c.root, c.g.box(0.17, 0.22, 0.3), c.metal("#111827"), x, 0.1, 0.04);
      c.put(c.root, c.g.box(0.18, 0.02, 0.3), c.glow(c.accent, 1.2), x, 0.0, 0.04);
    }
  },

  shadow(c) {
    // Hooded dark jacket, face mask, red trim and cargo pants.
    c.put(c.head, c.g.sphere(0.175, 40, 28), c.cloth("#15161c"), 0, 0.0, -0.02).scale.set(0.95, 1.1, 0.98);
    c.put(c.head, c.g.cyl(0.25, 0.27, 0.4, 28, true, Math.PI - 0.9, 1.8), c.cloth("#15161c"), 0, -0.22, -0.08);
    c.put(c.head, c.g.box(0.19, 0.13, 0.07), c.cloth("#0b0b0e"), 0, -0.04, 0.12);
    for (const x of [-0.05, 0.05]) c.put(c.head, c.g.box(0.04, 0.012, 0.01), c.glow(c.accent, 1.8), x, 0.02, 0.135);
    c.put(c.root, c.g.lathe(scaleTorso(1.05)), c.cloth("#17181f"), 0, 0.95, 0);
    c.put(c.root, c.g.box(0.12, 0.2, 0.02), c.cloth("#7f1d1d", { emissive: "#7f1d1d", emissiveIntensity: 0.4 }), 0, 1.3, 0.22);
    for (const x of [-0.13, 0.13]) c.put(c.root, c.g.box(0.02, 0.5, 0.01), c.glow(c.accent, 1.0), x, 1.1, 0.23);
    for (const e of c.elbows) c.put(e, c.g.capsule(0.075, 0.14), c.cloth("#101116"), 0, -0.2, 0);
    for (const x of [-0.12, 0.12]) c.put(c.root, c.g.box(0.07, 0.16, 0.05), c.cloth("#1b1d24"), x, 0.6, 0.12);
    for (const x of [-0.11, 0.11]) c.put(c.root, c.g.box(0.18, 0.2, 0.3), c.cloth("#0b0b0e", { roughness: 0.5 }), x, 0.1, 0.04);
  },

  knight(c) {
    // Full plate armour, crested helmet, layered shoulder plates and a blue cape.
    const steel = c.metal("#cbd5e1", { roughness: 0.22 });
    const dark = c.metal("#334155", { roughness: 0.35 });
    c.put(c.head, c.g.sphere(0.17, 40, 28), steel, 0, 0.0, 0).scale.set(0.95, 1.1, 1.0);
    c.put(c.head, c.g.box(0.2, 0.025, 0.04), c.mat("#0b1220"), 0, 0.02, 0.15);
    for (const x of [-0.05, 0.05]) c.put(c.head, c.g.box(0.03, 0.012, 0.01), c.glow(c.accent, 1.8), x, 0.02, 0.155);
    c.put(c.head, c.g.cone(0.05, 0.3), c.metal(c.accent, { roughness: 0.3 }), 0, 0.22, 0);
    c.put(c.root, c.g.torus(0.13, 0.03), steel, 0, 1.56, 0).rotation.x = Math.PI / 2;
    c.put(c.root, c.g.lathe(scaleTorso(1.07)), steel, 0, 0.95, 0);
    c.put(c.root, c.g.box(0.1, 0.12, 0.02), c.glow(c.accent, 1.5), 0, 1.25, 0.25);
    c.put(c.root, c.g.box(0.02, 0.5, 0.02), dark, 0, 1.08, 0.24);
    for (const s of c.shoulders) {
      c.put(s, c.g.sphere(0.13), steel, 0, 0.02, 0).scale.set(1.1, 0.55, 1.1);
      c.put(s, c.g.sphere(0.11), steel, 0, 0.1, 0).scale.set(1.1, 0.6, 1.1);
      c.put(s, c.g.capsule(0.08, 0.2), steel, 0, -0.2, 0);
    }
    for (const e of c.elbows) c.put(e, c.g.capsule(0.08, 0.2), dark, 0, -0.16, 0);
    for (const x of [-0.11, 0.11]) {
      c.put(c.root, c.g.capsule(0.1, 0.34), steel, x, 0.72, 0);
      c.put(c.root, c.g.sphere(0.1), steel, x, 0.52, 0.04);
      c.put(c.root, c.g.box(0.18, 0.2, 0.3), dark, x, 0.1, 0.04);
    }
    const cape = c.put(c.root, wave(c.g.plane(0.62, 1.2, 14, 22), 0.05, 4.5), c.cloth("#1e40af", { roughness: 0.8 }), 0, 1.0, -0.2);
    cape.rotation.x = -0.05;
  },

  street(c) {
    // Hoodie, cargo pants, a snapback cap, a mask and white sneakers.
    c.put(c.head, c.g.sphere(0.152, 40, 24), c.cloth("#0b0c10"), 0, 0.012, 0).scale.set(0.95, 1.06, 0.98);
    c.put(c.head, c.g.box(0.11, 0.085, 0.01), c.mat("#f8fafc", { roughness: 0.5 }), 0, 0.075, 0.145);
    c.put(c.head, c.g.box(0.25, 0.012, 0.12), c.cloth("#0b0c10"), 0, 0.03, 0.165).rotation.x = -0.22;
    c.put(c.head, c.g.box(0.19, 0.12, 0.07), c.cloth("#0b0c10"), 0, -0.07, 0.12);
    c.put(c.root, c.g.lathe(scaleTorso(1.05)), c.cloth("#0f1115", { roughness: 0.92 }), 0, 0.95, 0);
    c.put(c.root, c.g.box(0.24, 0.1, 0.03), c.cloth("#14161b"), 0, 1.12, 0.24);
    c.put(c.root, c.g.torus(0.1, 0.012), c.metal("#cbd5e1"), 0, 1.56, 0.05).rotation.x = Math.PI / 2 - 0.3;
    for (const e of c.elbows) c.put(e, c.g.capsule(0.075, 0.12), c.cloth("#0f1115"), 0, -0.2, 0);
    for (const s of c.shoulders) c.put(s, c.g.capsule(0.075, 0.24), c.cloth("#0f1115"), 0, -0.2, 0);
    for (const x of [-0.11, 0.11]) {
      c.put(c.root, c.g.capsule(0.102, 0.36), c.cloth("#16181e"), x, 0.72, 0);
      c.put(c.root, c.g.capsule(0.09, 0.34), c.cloth("#16181e"), x, 0.32, 0.02);
      c.put(c.root, c.g.box(0.1, 0.14, 0.04), c.cloth("#1b1e25"), x * 1.35, 0.66, 0.1);
      c.put(c.root, c.g.box(0.17, 0.1, 0.3), c.mat("#e5e7eb", { roughness: 0.4 }), x, 0.06, 0.05);
      c.put(c.root, c.g.box(0.175, 0.02, 0.3), c.glow(c.accent, 1.0), x, 0.02, 0.05);
    }
  },

  sorceress(c) {
    // Long white hair, a purple bodice with glowing trim, a flowing gown and horns.
    const hair = c.cloth("#e5e7eb", { roughness: 0.45, metalness: 0.05 });
    longHair(c, hair, 1.0);
    c.put(c.head, c.g.box(0.19, 0.11, 0.06), c.mat("#3b0764", { roughness: 0.5 }), 0, -0.04, 0.12);
    for (const x of [-0.05, 0.05]) c.put(c.head, c.g.box(0.035, 0.012, 0.01), c.glow(c.accent, 2.0), x, 0.03, 0.135);
    for (const x of [-0.1, 0.1]) c.put(c.head, c.g.cone(0.025, 0.2), c.glow(c.accent, 1.6), x, 0.16, -0.02).rotation.z = -x * 4;
    c.put(c.root, c.g.lathe(scaleTorso(1.02)), c.mat("#1e1033", { roughness: 0.55 }), 0, 0.95, 0);
    c.put(c.root, c.g.torus(0.2, 0.012), c.glow(c.accent, 1.6), 0, 1.0, 0).rotation.x = Math.PI / 2;
    c.put(c.root, c.g.torus(0.12, 0.01), c.glow(c.accent, 1.6), 0, 1.56, 0.02).rotation.x = Math.PI / 2;
    for (const e of c.elbows) c.put(e, c.g.capsule(0.072, 0.14), c.mat("#1e1033", { roughness: 0.6 }), 0, -0.2, 0);
    for (const s of c.shoulders) c.put(s, c.g.torus(0.08, 0.01), c.glow(c.accent, 1.6), 0, -0.1, 0).rotation.x = Math.PI / 2;
    // A gown that is narrow at the waist, flares over the hips and pools at the floor.
    const gown = c.g.lathe([[0.2, 0.95], [0.2, 0.8], [0.24, 0.62], [0.3, 0.4], [0.37, 0.18], [0.44, 0.0]]);
    c.put(c.root, wave(gown, 0.015, 4, 0.6), c.cloth("#1a1030", { roughness: 0.85 }), 0, 0, 0);
    c.put(c.root, c.g.torus(0.44, 0.012), c.glow(c.accent, 1.8), 0, 0.02, 0).rotation.x = Math.PI / 2;
  },

  nomad(c) {
    // Hood and mask with goggles, a long grey duster that leaves the arms free, and a backpack.
    c.put(c.head, c.g.sphere(0.175, 40, 28), c.cloth("#2b2f37"), 0, 0.0, -0.02).scale.set(0.97, 1.08, 1.0);
    c.put(c.head, c.g.cyl(0.24, 0.26, 0.36, 28, true, Math.PI - 0.9, 1.8), c.cloth("#2b2f37"), 0, -0.2, -0.08);
    c.put(c.head, c.g.box(0.19, 0.12, 0.06), c.cloth("#474c57"), 0, -0.05, 0.12);
    c.put(c.head, c.g.box(0.2, 0.05, 0.04), c.glow(c.accent, 1.4), 0, 0.03, 0.14);
    // The duster is a tapered shell from the shoulders to the knees, clear of the arm pivots.
    const duster = c.g.lathe([[0.2, 1.5], [0.25, 1.35], [0.3, 1.1], [0.33, 0.85], [0.37, 0.6], [0.4, 0.5]]);
    c.put(c.root, wave(duster, 0.02, 3.5), c.cloth("#1f242c", { roughness: 0.9 }), 0, 0, 0);
    c.put(c.root, c.g.torus(0.18, 0.035), c.cloth("#1f242c"), 0, 1.5, 0).rotation.x = Math.PI / 2;
    for (const x of [-0.08, 0.08]) c.put(c.root, c.g.box(0.03, 0.42, 0.02), c.cloth("#101216"), x, 1.2, 0.23).rotation.z = x * 3;
    c.put(c.root, c.g.box(0.3, 0.42, 0.14), c.cloth("#2a2e36"), 0, 1.2, -0.25);
    for (const e of c.elbows) c.put(e, c.g.capsule(0.075, 0.14), c.cloth("#101216"), 0, -0.2, 0);
    for (const x of [-0.11, 0.11]) {
      c.put(c.root, c.g.capsule(0.1, 0.34), c.cloth("#2a2f38"), x, 0.72, 0);
      c.put(c.root, c.g.capsule(0.09, 0.32), c.cloth("#2a2f38"), x, 0.32, 0.02);
      c.put(c.root, c.g.box(0.18, 0.24, 0.3), c.cloth("#0b0d10", { roughness: 0.5 }), x, 0.1, 0.04);
      c.put(c.root, c.g.box(0.185, 0.02, 0.3), c.glow(c.accent, 1.0), x, 0.0, 0.04);
    }
  },
};

/** Builds one look. Pass the three.js namespace (the same module the live viewer uses). */
export function buildCharacter(T: Lib, look: LookId, options: { skin?: string } = {}): CharacterRig {
  const kit = LOOKS[look];
  const skin = options.skin || kit.skin;
  const accent = kit.accent;

  const mat = (color: string, o: MatOpts = {}) => new T.MeshStandardMaterial({ color, roughness: 0.62, metalness: 0.05, ...o });
  const metal = (color: string, o: MatOpts = {}) => new T.MeshStandardMaterial({ color, roughness: 0.26, metalness: 0.88, ...o });
  const cloth = (color: string, o: MatOpts = {}) => new T.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, side: T.DoubleSide, ...o });
  const glow = (color: string, power = 1.6) => new T.MeshStandardMaterial({ color: "#000000", emissive: new T.Color(color), emissiveIntensity: power, roughness: 0.4 });
  const put = (parent: THREE.Object3D, geo: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) => {
    const m = new T.Mesh(geo, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  };
  const grp = (parent: THREE.Object3D, x = 0, y = 0, z = 0) => {
    const g = new T.Group();
    g.position.set(x, y, z);
    parent.add(g);
    return g;
  };
  const g = {
    capsule: (r: number, len: number) => new T.CapsuleGeometry(r, len, 8, 20),
    sphere: (r: number, ws = 32, hs = 24) => new T.SphereGeometry(r, ws, hs),
    box: (w: number, h: number, d: number) => new T.BoxGeometry(w, h, d),
    torus: (r: number, t: number) => new T.TorusGeometry(r, t, 12, 48),
    lathe: (pts: Array<[number, number]>) => new T.LatheGeometry(pts.map(([r, y]) => new T.Vector2(r, y)), 40),
    cyl: (rTop: number, rBottom: number, h: number, seg = 24, open = false, theta = 0, arc = Math.PI * 2) => new T.CylinderGeometry(rTop, rBottom, h, seg, 6, open, theta, arc),
    cone: (r: number, h: number) => new T.ConeGeometry(r, h, 16),
    plane: (w: number, h: number, ws: number, hs: number) => new T.PlaneGeometry(w, h, ws, hs),
  };

  const root = new T.Group();
  const body = new T.Group();
  const head = new T.Group();
  root.add(body);
  body.add(head);
  head.position.set(0, 1.7, 0);

  const skinMat = mat(skin, { roughness: 0.5 });
  const pants = mat("#1d2029", { roughness: 0.8 });
  const shoe = mat("#111318", { roughness: 0.5 });
  const shoulders: THREE.Group[] = [];
  const elbows: THREE.Group[] = [];

  // Legs with knee pivots, feet, then arms with elbow pivots (both shoulders at x = ±0.27).
  for (const side of [-1, 1]) {
    const hip = grp(root, side * 0.11, 0.95, 0);
    put(hip, g.capsule(0.095, 0.36), pants, 0, -0.2, 0);
    const knee = grp(hip, 0, -0.42, 0);
    put(knee, g.capsule(0.085, 0.34), pants, 0, -0.2, 0);
    put(knee, g.box(0.16, 0.08, 0.3), shoe, 0, -0.5, 0.05);
    const shoulder = grp(body, side * 0.27, 1.45, 0);
    shoulder.rotation.z = side * -0.12;
    put(shoulder, g.capsule(0.068, 0.24), skinMat, 0, -0.19, 0);
    const elbow = grp(shoulder, 0, -0.36, 0);
    elbow.rotation.x = -0.12;
    put(elbow, g.capsule(0.06, 0.2), skinMat, 0, -0.16, 0);
    put(elbow, g.sphere(0.07), skinMat, 0, -0.33, 0).scale.set(0.85, 1.25, 0.9);
    shoulders.push(shoulder);
    elbows.push(elbow);
  }
  put(body, g.lathe(TORSO), mat("#1b1e26", { roughness: 0.75 }), 0, 0.95, 0);
  put(body, new T.CylinderGeometry(0.07, 0.075, 0.16, 20), skinMat, 0, 1.6, 0);
  put(head, g.sphere(0.13), skinMat, 0, 0, 0).scale.set(0.9, 1.08, 0.96);
  for (const side of [-1, 1]) put(head, g.sphere(0.03, 12, 10), skinMat, side * 0.122, -0.01, 0).scale.set(0.5, 1, 0.8);

  const helmetHair = (m: THREE.Material, theta = 1.2) => {
    const mesh = put(head, new T.SphereGeometry(0.14, 40, 24, 0, Math.PI * 2, 0, theta), m, 0, 0.005, 0);
    mesh.scale.set(0.97, 1.13, 1.03);
    return mesh;
  };

  const ctx: Ctx = { T, root, head, shoulders, elbows, accent, mat, metal, cloth, glow, put, grp, g, helmetHair };
  OUTFITS[look](ctx);
  if (kit.hair === "buzz") buzzHair(ctx, mat("#1b1b1f", { roughness: 0.6 }));

  return { group: root, body, head, armL: shoulders[0], armR: shoulders[1] };
}

/** Frees the geometry and materials of a built character. */
export function disposeCharacter(group: THREE.Object3D) {
  group.traverse((node) => {
    const mesh = node as THREE.Mesh;
    if (mesh.geometry) mesh.geometry.dispose();
    if (mesh.material) {
      const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      list.forEach((item) => item.dispose());
    }
  });
}
