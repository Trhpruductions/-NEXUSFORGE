import test from "node:test";
import assert from "node:assert/strict";
import { resetStagesForTests, stageJoin, stageRaise, stageSetSpeaker, stageSnapshot, stageSync } from "../src/lib/stage.js";

test("moderators join on stage, everyone else in the audience", () => {
  resetStagesForTests();
  stageJoin("s", "mod", true);
  stageJoin("s", "fan", false);
  assert.deepEqual(stageSnapshot("s").speakers, ["mod"]);
});

test("raise hand, get invited up, step back down", () => {
  resetStagesForTests();
  stageJoin("s", "mod", true);
  stageJoin("s", "fan", false);
  assert.equal(stageRaise("s", "fan", true), true);
  assert.deepEqual(stageSnapshot("s").raised, ["fan"]);
  assert.equal(stageSetSpeaker("s", "fan", "fan", true), false, "audience can't put themselves on stage");
  assert.equal(stageSetSpeaker("s", "mod", "fan", true), true);
  assert.deepEqual(stageSnapshot("s").raised, [], "inviting clears the raised hand");
  assert.ok(stageSnapshot("s").speakers.includes("fan"));
  assert.equal(stageRaise("s", "fan", true), false, "speakers don't raise hands");
  assert.equal(stageSetSpeaker("s", "fan", "fan", false), true, "anyone can step down");
  assert.ok(!stageSnapshot("s").speakers.includes("fan"));
});

test("audience can't move speakers, and moderators can't be pulled off by others", () => {
  resetStagesForTests();
  stageJoin("s", "mod1", true);
  stageJoin("s", "mod2", true);
  stageJoin("s", "fan", false);
  assert.equal(stageSetSpeaker("s", "fan", "mod1", false), false);
  assert.equal(stageSetSpeaker("s", "mod2", "mod1", false), false);
  assert.equal(stageSetSpeaker("s", "mod1", "mod1", false), true, "but they can step down themselves");
});

test("leaving clears you from the stage; an empty stage is forgotten", () => {
  resetStagesForTests();
  stageJoin("s", "mod", true);
  stageJoin("s", "fan", false);
  stageRaise("s", "fan", true);
  stageSync("s", ["mod"]);
  assert.deepEqual(stageSnapshot("s").raised, []);
  stageSync("s", []);
  assert.deepEqual(stageSnapshot("s"), { speakers: [], raised: [], moderators: [] });
});
