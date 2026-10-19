import { test } from "node:test";
import assert from "node:assert/strict";
import { isSpeaking, levelKeyFor, SPEAKING_LEVEL, useVoiceStore, type VoiceSession } from "../src/store/voice-store";

type State = ReturnType<typeof useVoiceStore.getState>;

/**
 * Counts how often a selector's result changes while the store updates. A component using
 * useVoiceStore(selector) re-renders exactly when this result changes (zustand compares with Object.is).
 */
function watch<T>(selector: (state: State) => T) {
  let previous = selector(useVoiceStore.getState());
  let changes = 0;
  const stop = useVoiceStore.subscribe((state) => {
    const next = selector(state);
    if (!Object.is(next, previous)) {
      changes += 1;
      previous = next;
    }
  });
  return { get changes() { return changes; }, stop };
}

const session = { channelId: "c1", channelName: "General", forgeId: "f1", mode: "mesh" } as unknown as VoiceSession;

test("speaking means above the threshold and not muted", () => {
  assert.equal(isSpeaking(SPEAKING_LEVEL, false), false);
  assert.equal(isSpeaking(SPEAKING_LEVEL + 1, false), true);
  assert.equal(isSpeaking(80, true), false);
  assert.equal(levelKeyFor("u1", true), "self");
  assert.equal(levelKeyFor("u1", false), "u1");
});

test("audio level updates don't change anything the voice room panel reads", () => {
  useVoiceStore.getState().join(session);
  // The fields VoiceRoomPanel selects (it no longer reads `levels`).
  const panelFields = ["session", "flags", "connection", "remote", "localScreen", "localCamera", "error", "pushToTalk", "stage", "peerVolumes"] as const;
  const watchers = panelFields.map((field) => watch((state) => state[field]));
  const { setLevel } = useVoiceStore.getState();
  // 8 meter ticks a second for 3 people over 5 seconds.
  for (let tick = 0; tick < 40; tick += 1) {
    setLevel("self", (tick * 7) % 60);
    setLevel("alice", (tick * 11) % 70);
    setLevel("bob", (tick * 13) % 90);
  }
  watchers.forEach((watcher, index) => {
    assert.equal(watcher.changes, 0, `${panelFields[index]} changed`);
    watcher.stop();
  });
  useVoiceStore.getState().leave();
});

test("a tile's speaking state changes only when that person starts or stops talking", () => {
  useVoiceStore.getState().join(session);
  const { setLevel } = useVoiceStore.getState();
  const aliceTile = watch((state) => isSpeaking(state.levels[levelKeyFor("alice", false)] ?? 0, false));
  const aliceBar = watch((state) => state.levels.alice ?? 0);

  // Bob talking, loudly and often, never touches Alice's tile or bar.
  for (let tick = 0; tick < 40; tick += 1) setLevel("bob", 20 + (tick % 30));
  assert.equal(aliceTile.changes, 0);
  assert.equal(aliceBar.changes, 0);

  // Alice: quiet noise, then talking at varying volume, then silence. The tile re-renders twice (start, stop);
  // only the thin level bar follows each change.
  const alice = [2, 5, 3, 30, 45, 38, 52, 40, 4, 0];
  for (const level of alice) setLevel("alice", level);
  assert.equal(aliceTile.changes, 2);
  assert.equal(aliceBar.changes, alice.length);

  aliceTile.stop();
  aliceBar.stop();
  useVoiceStore.getState().leave();
});
