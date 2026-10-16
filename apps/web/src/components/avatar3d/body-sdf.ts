import type * as THREE from "three";
import { MarchingCubes } from "three/addons/objects/MarchingCubes.js";

/**
 * Organic body parts, built from scratch in code. Each part is a signed distance field: negative inside the body,
 * positive outside. Primitives (ellipsoids and rounded cones) are blended with smooth unions, so joints and muscles
 * flow into each other the way skin does. Each part is then polygonised with marching cubes into a mesh.
 *
 * Parts are defined in the local frame of the joint they hang from (the same frames as base-model.ts), so the existing
 * poses and the naming contract do not change. Units are metres.
 */

export type Vec3 = readonly [number, number, number];
export type Field = (x: number, y: number, z: number) => number;

const clamp01 = (t: number) => Math.min(1, Math.max(0, t));

/** A rounded cone from a to b, its radius easing from ra to rb. */
export function roundCone(a: Vec3, b: Vec3, ra: number, rb: number): Field {
  const abx = b[0] - a[0];
  const aby = b[1] - a[1];
  const abz = b[2] - a[2];
  const len2 = abx * abx + aby * aby + abz * abz || 1e-9;
  return (x, y, z) => {
    const px = x - a[0];
    const py = y - a[1];
    const pz = z - a[2];
    const t = clamp01((px * abx + py * aby + pz * abz) / len2);
    const dx = px - abx * t;
    const dy = py - aby * t;
    const dz = pz - abz * t;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) - (ra + (rb - ra) * t);
  };
}

/** An ellipsoid centred at c with radii r. The distance is the standard bound, which is smooth enough to shade well. */
export function ellipsoid(c: Vec3, r: Vec3): Field {
  return (x, y, z) => {
    const px = (x - c[0]) / r[0];
    const py = (y - c[1]) / r[1];
    const pz = (z - c[2]) / r[2];
    const k0 = Math.sqrt(px * px + py * py + pz * pz);
    const qx = px / r[0];
    const qy = py / r[1];
    const qz = pz / r[2];
    const k1 = Math.sqrt(qx * qx + qy * qy + qz * qz);
    if (k1 < 1e-9) return -Math.min(r[0], r[1], r[2]);
    return (k0 * (k0 - 1)) / k1;
  };
}

/** Smooth minimum: joins two fields with a fillet of width k. */
function smin(a: number, b: number, k: number): number {
  if (k <= 0) return Math.min(a, b);
  const h = clamp01(0.5 + (0.5 * (b - a)) / k);
  return b + (a - b) * h - k * h * (1 - h);
}

/** Smooth union of several fields. */
export function blend(k: number, ...fields: Field[]): Field {
  return (x, y, z) => {
    let value = fields[0](x, y, z);
    for (let i = 1; i < fields.length; i += 1) value = smin(value, fields[i](x, y, z), k);
    return value;
  };
}

/** Carves `cut` out of `base`, with a soft edge of width k. The result is base minus cut: max(base, -cut), smoothed. */
export function carve(base: Field, cut: Field, k: number): Field {
  return (x, y, z) => -smin(-base(x, y, z), cut(x, y, z), k);
}

export type PartSpec = {
  /** The field, in the joint's local frame. */
  sdf: Field;
  /** Centre and half-size of the box the field is sampled in. The box must contain the surface with a margin. */
  center: Vec3;
  half: Vec3;
  /** Grid cells per side. Higher is smoother and slower. */
  resolution: number;
  /** Triangle budget for the mesh. */
  maxTriangles: number;
};

/**
 * The organic parts for one body size. `limb` scales the limbs the same way BODY_SIZES does, so a slim or broad
 * character keeps the proportions of the lathe-built torso.
 */
export function humanParts(limb: number) {
  const L = limb;
  const thigh: PartSpec = {
    sdf: blend(0.03, roundCone([0, 0.03, 0], [0, -0.44, 0], 0.11 * L, 0.076 * L), ellipsoid([0, -0.1, 0], [0.1 * L, 0.14, 0.105 * L])),
    center: [0, -0.2, 0],
    half: [0.16, 0.36, 0.16],
    resolution: 48,
    maxTriangles: 16000,
  };
  const shin: PartSpec = {
    sdf: blend(0.03, roundCone([0, 0.03, 0], [0, -0.44, 0], 0.07 * L, 0.04 * L), ellipsoid([0, -0.16, -0.012], [0.075 * L, 0.13, 0.07 * L])),
    center: [0, -0.2, 0],
    half: [0.14, 0.32, 0.14],
    resolution: 48,
    maxTriangles: 16000,
  };
  const upperArm: PartSpec = {
    sdf: blend(0.03, roundCone([0, 0.04, 0], [0, -0.36, 0], 0.068 * L, 0.05 * L), ellipsoid([0, -0.02, 0], [0.085 * L, 0.085 * L, 0.08 * L])),
    center: [0, -0.17, 0],
    half: [0.13, 0.31, 0.13],
    resolution: 48,
    maxTriangles: 14000,
  };
  const forearm: PartSpec = {
    sdf: blend(0.02, roundCone([0, 0.02, 0], [0, -0.34, 0], 0.052 * L, 0.034 * L), ellipsoid([0, -0.1, -0.01], [0.05 * L, 0.1, 0.045 * L])),
    center: [0, -0.15, 0],
    half: [0.12, 0.26, 0.12],
    resolution: 48,
    maxTriangles: 14000,
  };
  /** A hand: a palm with four fingers as one mass, and a thumb on the side it belongs to. */
  const hand = (side: -1 | 1): PartSpec => ({
    sdf: blend(
      0.02,
      ellipsoid([0, -0.4, 0.005], [0.042 * L, 0.065, 0.024]),
      ellipsoid([0, -0.46, 0], [0.038 * L, 0.035, 0.021]),
      roundCone([side * 0.03 * L, -0.36, 0.01], [side * 0.05 * L, -0.43, 0.02], 0.016 * L, 0.012 * L),
    ),
    center: [0, -0.41, 0],
    half: [0.09, 0.13, 0.06],
    resolution: 40,
    maxTriangles: 8000,
  });
  /**
   * The head, centred on the head joint. Cranium, jaw, chin, cheeks, brow ridge, nose and lips are blended together,
   * and the eye sockets are carved so the eyes sit in them.
   */
  const skull: PartSpec = {
    sdf: carve(
      blend(
        0.02,
        ellipsoid([0, 0.01, 0], [0.112, 0.13, 0.118]),
        ellipsoid([0, -0.075, 0.005], [0.09, 0.065, 0.1]),
        ellipsoid([0, -0.1, 0.07], [0.03, 0.02, 0.03]),
        ellipsoid([-0.06, -0.02, 0.07], [0.035, 0.04, 0.04]),
        ellipsoid([0.06, -0.02, 0.07], [0.035, 0.04, 0.04]),
        ellipsoid([0, -0.02, 0.122], [0.017, 0.035, 0.024]),
        roundCone([-0.05, 0.04, 0.1], [0.05, 0.04, 0.1], 0.012, 0.012),
        ellipsoid([0, -0.06, 0.1], [0.03, 0.012, 0.012]),
      ),
      blend(0.01, ellipsoid([-0.056, 0.02, 0.112], [0.03, 0.02, 0.03]), ellipsoid([0.056, 0.02, 0.112], [0.03, 0.02, 0.03])),
      0.01,
    ),
    center: [0, 0, 0],
    half: [0.13, 0.17, 0.155],
    resolution: 60,
    maxTriangles: 26000,
  };
  return { thigh, shin, upperArm, forearm, hand, skull };
}

/** Polygonises a part into a mesh that sits at the joint, with the material given. */
export function polygonize(part: PartSpec, material: THREE.Material): MarchingCubes {
  const mesh = new MarchingCubes(part.resolution, material, false, false, part.maxTriangles);
  // The field is positive inside, so the surface is where it crosses zero.
  mesh.isolation = 0;
  const n = part.resolution;
  const half = n / 2;
  const [cx, cy, cz] = part.center;
  const [hx, hy, hz] = part.half;
  const field = mesh.field;
  for (let z = 0; z < n; z += 1) {
    const fz = (z - half) / half;
    for (let y = 0; y < n; y += 1) {
      const fy = (y - half) / half;
      for (let x = 0; x < n; x += 1) {
        const fx = (x - half) / half;
        field[z * n * n + y * n + x] = -part.sdf(cx + hx * fx, cy + hy * fy, cz + hz * fz);
      }
    }
  }
  mesh.position.set(cx, cy, cz);
  mesh.scale.set(hx, hy, hz);
  mesh.update();
  return mesh;
}
