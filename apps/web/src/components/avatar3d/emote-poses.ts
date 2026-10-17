/**
 * Emote playback for the Avatar Studio figure. An emote is a short timeline of joint angles. The viewer blends it over
 * the chosen pose, holds it, and blends back, so the figure never snaps. Only the arms and knees move, which reads
 * clearly at any size. Times are seconds. Angles are radians, in the same convention as applyPose in avatar-viewer.tsx.
 *
 * Emote ids are the catalog keys of the emote items (apps/server/src/lib/cosmetic-catalog.ts). An unknown id plays nothing.
 */

export const EMOTE_IDS = ["emote-gg", "emote-victory-flex", "emote-drop-in"] as const;
export type EmoteId = (typeof EMOTE_IDS)[number];

export const EMOTE_JOINTS = ["Shoulder_L", "Shoulder_R", "Elbow_L", "Elbow_R", "Knee_L", "Knee_R"] as const;
export type EmoteJoint = (typeof EMOTE_JOINTS)[number];
export type JointAngles = Record<EmoteJoint, { x: number; z: number }>;

/** How long the blend in and out takes, in seconds. */
export const BLEND_SECONDS = 0.35;

/** The relaxed stance. Every key starts from this, so the timeline never needs the chosen pose. */
const REST: JointAngles = {
  Shoulder_L: { x: 0, z: 0.12 },
  Shoulder_R: { x: 0, z: -0.12 },
  Elbow_L: { x: -0.12, z: 0 },
  Elbow_R: { x: -0.12, z: 0 },
  Knee_L: { x: 0, z: 0 },
  Knee_R: { x: 0, z: 0 },
};

type Key = { t: number; joints: JointAngles };

/** Builds a key from REST with only the joints that change. */
const key = (t: number, changes: Partial<JointAngles> = {}): Key => ({ t, joints: { ...REST, ...changes } });

/** Arms out to the sides at shoulder height, with the elbows bent `bend` radians up on the sideways axis. */
const flex = (bend: number): Partial<JointAngles> => ({
  Shoulder_L: { x: 0, z: -1.45 },
  Elbow_L: { x: 0, z: -bend },
  Shoulder_R: { x: 0, z: 1.45 },
  Elbow_R: { x: 0, z: bend },
});

/** Arms spread wide and out, with the knees bent by `knee` radians. */
const spread = (knee: number): Partial<JointAngles> => ({
  Shoulder_L: { x: -0.6, z: -1.3 },
  Shoulder_R: { x: -0.6, z: 1.3 },
  Elbow_L: { x: -0.7, z: 0 },
  Elbow_R: { x: -0.7, z: 0 },
  Knee_L: { x: knee, z: 0 },
  Knee_R: { x: knee, z: 0 },
});

const TIMELINES: Record<EmoteId, { duration: number; keys: Key[] }> = {
  // GG salute: the right hand comes up to the brow, holds, and drops.
  "emote-gg": {
    duration: 2.2,
    keys: [
      key(0),
      key(0.6, { Shoulder_R: { x: -2.05, z: -0.35 }, Elbow_R: { x: -2.3, z: 0 } }),
      key(1.7, { Shoulder_R: { x: -2.05, z: -0.35 }, Elbow_R: { x: -2.3, z: 0 } }),
      key(2.2),
    ],
  },
  // Victory flex: both upper arms out to the sides, forearms bent up on the sideways axis (elbow z), then two flexes.
  "emote-victory-flex": {
    duration: 2.8,
    keys: [
      key(0),
      key(0.5, flex(1.35)),
      key(1.0, flex(1.8)),
      key(1.3, flex(1.35)),
      key(1.6, flex(1.8)),
      key(2.3, flex(1.35)),
      key(2.8),
    ],
  },
  // Drop in: arms spread wide, knees bend a little, as in a skydive landing.
  "emote-drop-in": {
    duration: 3.0,
    keys: [
      key(0),
      key(0.7, spread(0.3)),
      key(2.2, spread(0.3)),
      key(3.0),
    ],
  },
};

export function isEmoteId(value: string): value is EmoteId {
  return (EMOTE_IDS as readonly string[]).includes(value);
}

export function emoteDuration(id: EmoteId): number {
  return TIMELINES[id].duration;
}

/** Smooth in and out between two keys, so the joints ease rather than move at a constant speed. */
const smooth = (t: number) => t * t * (3 - 2 * t);

export type EmoteFrame = { weight: number; joints: JointAngles };

/**
 * The emote's joints at time t, and how much of it to blend in (0 = the chosen pose, 1 = the emote).
 * Returns null once the emote has finished, so the caller can hand the pose back.
 */
export function emoteFrame(id: EmoteId, t: number): EmoteFrame | null {
  const { duration, keys } = TIMELINES[id];
  if (t < 0 || t > duration) return null;

  let index = 0;
  while (index < keys.length - 2 && t > keys[index + 1].t) index += 1;
  const from = keys[index];
  const to = keys[index + 1];
  const span = to.t - from.t || 1;
  const local = smooth(Math.min(1, Math.max(0, (t - from.t) / span)));

  const joints = {} as JointAngles;
  for (const joint of EMOTE_JOINTS) {
    joints[joint] = {
      x: from.joints[joint].x + (to.joints[joint].x - from.joints[joint].x) * local,
      z: from.joints[joint].z + (to.joints[joint].z - from.joints[joint].z) * local,
    };
  }

  const weight = smooth(Math.min(1, t / BLEND_SECONDS, (duration - t) / BLEND_SECONDS));
  return { weight, joints };
}
