import test from "node:test";
import assert from "node:assert/strict";
import { poseJoints, type ViewerPose } from "../src/components/avatar3d/pose-joints";
import { EMOTE_JOINTS } from "../src/components/avatar3d/emote-poses";

/** The stances the Studio offers. Each one sets every arm and knee joint, so the figure never keeps a stale pose. */
const POSES: ViewerPose[] = ["relaxed", "victory", "showcase", "pockets"];

test("every stance sets all six joints the viewer drives", () => {
  for (const pose of POSES) {
    const joints = poseJoints(pose);
    for (const joint of EMOTE_JOINTS) {
      assert.ok(joints[joint], `${pose} sets ${joint}`);
      assert.ok(Number.isFinite(joints[joint].x) && Number.isFinite(joints[joint].z), `${pose} ${joint} is a number`);
    }
  }
});

test("knees stay straight in every stance except where an emote bends them", () => {
  for (const pose of POSES) {
    const joints = poseJoints(pose);
    assert.deepEqual([joints.Knee_L.x, joints.Knee_L.z, joints.Knee_R.x, joints.Knee_R.z], [0, 0, 0, 0], pose);
  }
});

test("hands in pockets brings the forearms in and down, unlike the relaxed stance", () => {
  const relaxed = poseJoints("relaxed");
  const pockets = poseJoints("pockets");
  assert.ok(pockets.Elbow_L.x < relaxed.Elbow_L.x, "the left elbow folds further");
  assert.ok(pockets.Elbow_R.x < relaxed.Elbow_R.x, "the right elbow folds further");
  // A larger z on the left arm and a smaller z on the right swing both arms inward, toward the body.
  assert.ok(pockets.Shoulder_L.z > relaxed.Shoulder_L.z, "the left arm comes in toward the body");
  assert.ok(pockets.Shoulder_R.z < relaxed.Shoulder_R.z, "the right arm comes in toward the body");
});

test("the relaxed stance is unchanged", () => {
  const relaxed = poseJoints("relaxed");
  assert.deepEqual(relaxed.Shoulder_L, { x: 0, z: 0.12 });
  assert.deepEqual(relaxed.Shoulder_R, { x: 0, z: -0.12 });
  assert.deepEqual(relaxed.Elbow_L, { x: -0.12, z: 0 });
  assert.deepEqual(relaxed.Elbow_R, { x: -0.12, z: 0 });
});
