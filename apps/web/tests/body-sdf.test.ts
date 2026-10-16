import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { blend, carve, ellipsoid, humanParts, polygonize, roundCone, type PartSpec } from "../src/components/avatar3d/body-sdf";
import { buildAvatarModel } from "../src/components/avatar3d/base-model";

/** The organic body parts: field signs, blending, a real surface per part, margin in each box, and the named nodes. */

test("an ellipsoid is negative inside, zero on its surface, and positive outside", () => {
  const field = ellipsoid([0, 0, 0], [0.1, 0.2, 0.1]);
  assert.ok(field(0, 0, 0) < 0, "centre is inside");
  assert.ok(Math.abs(field(0.1, 0, 0)) < 1e-6, "the side of the ellipsoid is on the surface");
  assert.ok(field(0.3, 0, 0) > 0, "far away is outside");
});

test("a rounded cone is inside along its axis and outside beyond its end", () => {
  const field = roundCone([0, 0, 0], [0, -0.4, 0], 0.08, 0.04);
  assert.ok(field(0, -0.2, 0) < 0);
  assert.ok(field(0, -0.6, 0) > 0);
  assert.ok(field(0.2, -0.2, 0) > 0);
});

test("a smooth union fills the join between two shapes; the plain union leaves a gap", () => {
  const a = ellipsoid([-0.06, 0, 0], [0.04, 0.04, 0.04]);
  const b = ellipsoid([0.06, 0, 0], [0.04, 0.04, 0.04]);
  const plain = Math.min(a(0, 0, 0), b(0, 0, 0));
  const smooth = blend(0.03, a, b)(0, 0, 0);
  assert.ok(smooth <= plain, "the blend adds material between the two shapes");
});

test("carving removes material where the cut is", () => {
  const base = ellipsoid([0, 0, 0], [0.1, 0.1, 0.1]);
  const cut = ellipsoid([0, 0, 0.1], [0.04, 0.04, 0.04]);
  assert.ok(carve(base, cut, 0.01)(0, 0, 0.1) > 0, "the cut point is now outside");
  assert.ok(carve(base, cut, 0.01)(0, 0, -0.05) < 0, "material away from the cut stays");
});

test("every body part polygonises into a real surface", () => {
  const parts = humanParts(1);
  const material = new THREE.MeshStandardMaterial();
  for (const [name, part] of Object.entries({ thigh: parts.thigh, shin: parts.shin, upperArm: parts.upperArm, forearm: parts.forearm, skull: parts.skull, hand: parts.hand(-1) })) {
    const mesh = polygonize(part as PartSpec, material);
    assert.ok(mesh.count > 0, `${name} has vertices`);
    mesh.geometry.dispose();
  }
});

test("each part's box has a margin: the middle of every box face is outside the body, at every body size", () => {
  // A surface that reaches a face of the box is cut flat there, which shows as a seam at the joint. So the middle of
  // each face must be outside the body.
  for (const limb of [0.9, 1, 1.12]) {
    const parts = humanParts(limb);
    const boxes: Array<[string, PartSpec]> = [
      ["thigh", parts.thigh],
      ["shin", parts.shin],
      ["upperArm", parts.upperArm],
      ["forearm", parts.forearm],
      ["skull", parts.skull],
      ["hand-left", parts.hand(-1)],
      ["hand-right", parts.hand(1)],
    ];
    for (const [name, part] of boxes) {
      const [cx, cy, cz] = part.center;
      const [hx, hy, hz] = part.half;
      const faces: Array<[number, number, number]> = [
        [cx + hx, cy, cz],
        [cx - hx, cy, cz],
        [cx, cy + hy, cz],
        [cx, cy - hy, cz],
        [cx, cy, cz + hz],
        [cx, cy, cz - hz],
      ];
      faces.forEach(([x, y, z], index) => {
        assert.ok(part.sdf(x, y, z) > 0, `${name} face ${index} at limb ${limb} is outside the body`);
      });
    }
  }
});

test("the model keeps the named nodes the rest of the app relies on", () => {
  const root = buildAvatarModel(THREE, "athletic");
  for (const name of ["Skull", "Thigh_L", "Shin_R", "UpperArm_L", "Forearm_R", "Hand_L", "Hand_R", "Hip_L", "Knee_R", "Shoulder_R", "Elbow_L"]) {
    assert.ok(root.getObjectByName(name), `the model has ${name}`);
  }
});
