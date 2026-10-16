import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { buildAvatarModel } from "../src/components/avatar3d/base-model";
import { BLEND_SECONDS, EMOTE_IDS, EMOTE_JOINTS, emoteDuration, emoteFrame, isEmoteId } from "../src/components/avatar3d/emote-poses";

/**
 * Checks the emote timelines without a browser: timing, the blend in and out, the held values, and that every joint
 * the viewer drives exists in the figure. How an emote looks is checked by rendering frames, not here.
 */

test("every emote has a positive length and the blend fits inside it", () => {
  for (const id of EMOTE_IDS) {
    assert.ok(emoteDuration(id) > 2 * BLEND_SECONDS, `${id} is longer than its blend in and out`);
  }
});

test("only the catalog emote ids are accepted", () => {
  assert.ok(isEmoteId("emote-gg"));
  assert.ok(isEmoteId("emote-victory-flex"));
  assert.ok(isEmoteId("emote-drop-in"));
  assert.equal(isEmoteId("emote-unknown"), false);
  assert.equal(isEmoteId("top-tee"), false);
});

test("an emote is not playing before it starts or after it ends", () => {
  for (const id of EMOTE_IDS) {
    assert.equal(emoteFrame(id, -0.01), null);
    assert.equal(emoteFrame(id, emoteDuration(id) + 0.01), null);
  }
});

test("the blend starts at zero, reaches full strength, and returns to zero", () => {
  for (const id of EMOTE_IDS) {
    const length = emoteDuration(id);
    assert.equal(emoteFrame(id, 0)?.weight, 0, `${id} starts from the chosen pose`);
    assert.equal(emoteFrame(id, length / 2)?.weight, 1, `${id} is fully on in the middle`);
    const late = emoteFrame(id, length - 0.001);
    assert.ok(late && late.weight < 0.01, `${id} is fully off at the end`);
  }
});

test("a held value is kept for the whole hold, not just at its key", () => {
  // GG salute: the right shoulder is held from 0.6 s to 1.7 s.
  const early = emoteFrame("emote-gg", 0.8)!;
  const late = emoteFrame("emote-gg", 1.5)!;
  assert.ok(Math.abs(early.joints.Shoulder_R.x - -2.05) < 1e-9);
  assert.ok(Math.abs(late.joints.Shoulder_R.x - -2.05) < 1e-9);
});

test("every joint is a finite number at every sampled time", () => {
  for (const id of EMOTE_IDS) {
    for (let t = 0; t <= emoteDuration(id); t += 0.05) {
      const frame = emoteFrame(id, t);
      assert.ok(frame, `${id} at ${t.toFixed(2)} s`);
      for (const joint of EMOTE_JOINTS) {
        assert.ok(Number.isFinite(frame.joints[joint].x) && Number.isFinite(frame.joints[joint].z), `${id} ${joint} at ${t.toFixed(2)} s`);
      }
    }
  }
});

test("every joint an emote drives exists in the figure, so the viewer can move it", () => {
  const root = buildAvatarModel(THREE, "athletic");
  for (const joint of EMOTE_JOINTS) {
    assert.ok(root.getObjectByName(joint), `the figure has ${joint}`);
  }
});
