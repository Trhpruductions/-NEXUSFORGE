import type { JointAngles } from "@/components/avatar3d/emote-poses";

/** The stances the viewer can hold. Relaxed is the default; the others are on the Studio's pose buttons. */
export type ViewerPose = "relaxed" | "victory" | "showcase" | "pockets";

/**
 * The arm angles a pose sets, in radians, in the same convention as the emote timelines. Knees, and any joint a pose
 * leaves out, stay at zero. This module has no React and no three.js, so the viewer and the offline render harness
 * read the same numbers.
 */
export function poseJoints(pose: ViewerPose): JointAngles {
  const joints: JointAngles = {
    Shoulder_L: { x: 0, z: 0 },
    Shoulder_R: { x: 0, z: 0 },
    Elbow_L: { x: 0, z: 0 },
    Elbow_R: { x: 0, z: 0 },
    Knee_L: { x: 0, z: 0 },
    Knee_R: { x: 0, z: 0 },
  };
  if (pose === "victory") {
    joints.Shoulder_L = { x: 0, z: -2.6 };
    joints.Shoulder_R = { x: 0, z: 2.6 };
  } else if (pose === "showcase") {
    joints.Shoulder_L = { x: 0, z: 0.12 };
    joints.Elbow_L = { x: -0.12, z: 0 };
    joints.Shoulder_R = { x: -2.2, z: -0.12 };
    joints.Elbow_R = { x: -0.9, z: 0 };
  } else if (pose === "pockets") {
    // Hands in trouser pockets: the arms stay close to the body and the forearms fold down to the hips.
    joints.Shoulder_L = { x: -0.1, z: 0.14 };
    joints.Shoulder_R = { x: -0.1, z: -0.14 };
    joints.Elbow_L = { x: -0.7, z: 0 };
    joints.Elbow_R = { x: -0.7, z: 0 };
  } else {
    joints.Shoulder_L = { x: 0, z: 0.12 };
    joints.Shoulder_R = { x: 0, z: -0.12 };
    joints.Elbow_L = { x: -0.12, z: 0 };
    joints.Elbow_R = { x: -0.12, z: 0 };
  }
  return joints;
}
