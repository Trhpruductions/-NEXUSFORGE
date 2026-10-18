import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "socket.io";
import { evictUserFromChannels, evictUserFromForge, onVoiceRemoved, resetIoForTests, setIo } from "../src/lib/realtime.js";
import { joinVoice, removeUserFromVoiceChannels, resetVoiceOccupancyForTests, voiceMembers } from "../src/lib/voice-occupancy.js";

// Kicked or banned members used to stay on the server's voice member list, so everyone else kept relaying call
// signalling (and audio/video) to them. These tests drive the realtime helpers through a stand-in for socket.io.

type Call = { kind: "emit"; room: string; event: string; payload: unknown } | { kind: "leave"; room: string; rooms: string[] };

/** Only the parts of socket.io the eviction helpers use: io.to(room).emit() and io.in(room).socketsLeave(). */
function fakeIo() {
  const calls: Call[] = [];
  const io = {
    to(room: string) {
      return { emit: (event: string, payload: unknown) => calls.push({ kind: "emit", room, event, payload }) };
    },
    in(room: string) {
      return { socketsLeave: (rooms: string[]) => calls.push({ kind: "leave", room, rooms }) };
    },
  };
  return { io: io as unknown as Server, calls };
}

function listen() {
  const removed: Array<{ channelId: string; userId: string }> = [];
  onVoiceRemoved((channelId, userId) => removed.push({ channelId, userId }));
  return removed;
}

afterEach(() => {
  resetIoForTests();
  resetVoiceOccupancyForTests();
  onVoiceRemoved(null);
});

test("a kicked member is taken off the voice list on every device, told to hang up, and the forge is told", async () => {
  const { io, calls } = fakeIo();
  setIo(io);
  const removed = listen();
  joinVoice("voice-1", "kicked", "socket-a");
  joinVoice("voice-1", "kicked", "socket-b"); // second device
  joinVoice("voice-1", "stays", "socket-c");

  const left = await evictUserFromForge("forge-1", "kicked", ["text-1", "voice-1", "voice-2"]);

  assert.deepEqual(left, ["voice-1"]);
  assert.deepEqual(voiceMembers("voice-1"), ["stays"], "only the kicked user leaves the call");
  assert.deepEqual(removed, [{ channelId: "voice-1", userId: "kicked" }], "the gateway hears about it once per channel");

  const hangUp = calls.find((call) => call.kind === "emit" && call.event === "voice:force-leave");
  assert.ok(hangUp && hangUp.kind === "emit");
  assert.equal(hangUp.room, "user:kicked");
  assert.deepEqual(hangUp.payload, { channelIds: ["text-1", "voice-1", "voice-2"], reason: "removed" });

  const leave = calls.find((call) => call.kind === "leave");
  assert.ok(leave && leave.kind === "leave");
  assert.equal(leave.room, "user:kicked");
  assert.deepEqual(leave.rooms, ["forge:forge-1", "channel:text-1", "voice:text-1", "channel:voice-1", "voice:voice-1", "channel:voice-2", "voice:voice-2"]);
});

test("the occupancy update is sent after the user has left the forge rooms, so it goes to the people who stay", async () => {
  const { io, calls } = fakeIo();
  setIo(io);
  const order: string[] = [];
  onVoiceRemoved(() => order.push(`listener after ${calls.length} socket.io calls`));
  joinVoice("voice-1", "banned", "socket-a");

  await evictUserFromForge("forge-1", "banned", ["voice-1"], "banned");

  assert.equal(calls.length, 2);
  assert.deepEqual(order, ["listener after 2 socket.io calls"]);
  const hangUp = calls[0];
  assert.ok(hangUp.kind === "emit");
  assert.deepEqual(hangUp.payload, { channelIds: ["voice-1"], reason: "banned" });
});

test("losing access to a channel (role change) removes the user from that call server-side", () => {
  const { io, calls } = fakeIo();
  setIo(io);
  const removed = listen();
  joinVoice("private-voice", "demoted", "socket-a");
  joinVoice("public-voice", "demoted", "socket-b");

  const left = evictUserFromChannels("demoted", ["private-voice"], { reason: "private" });

  assert.deepEqual(left, ["private-voice"]);
  assert.deepEqual(voiceMembers("private-voice"), []);
  assert.deepEqual(voiceMembers("public-voice"), ["demoted"], "other calls are untouched");
  assert.deepEqual(removed, [{ channelId: "private-voice", userId: "demoted" }]);
  const leave = calls.find((call) => call.kind === "leave");
  assert.ok(leave && leave.kind === "leave");
  assert.deepEqual(leave.rooms, ["channel:private-voice", "voice:private-voice"]);
});

test("a voice timeout only leaves the voice rooms", () => {
  const { io, calls } = fakeIo();
  setIo(io);
  joinVoice("voice-1", "timed-out", "socket-a");

  evictUserFromChannels("timed-out", ["voice-1"], { voiceOnly: true, reason: "timeout" });

  assert.deepEqual(voiceMembers("voice-1"), []);
  const leave = calls.find((call) => call.kind === "leave");
  assert.ok(leave && leave.kind === "leave");
  assert.deepEqual(leave.rooms, ["voice:voice-1"]);
});

test("someone who isn't in voice is still told to hang up, but nobody gets an occupancy update", () => {
  const { io, calls } = fakeIo();
  setIo(io);
  const removed = listen();

  assert.deepEqual(evictUserFromChannels("idle", ["voice-1"]), []);
  assert.deepEqual(removed, []);
  assert.equal(calls.filter((call) => call.kind === "emit" && call.event === "voice:force-leave").length, 1);
});

test("a listener that throws doesn't stop the eviction", async () => {
  setIo(fakeIo().io);
  onVoiceRemoved(() => {
    throw new Error("listener broke");
  });
  joinVoice("voice-1", "kicked", "socket-a");
  joinVoice("voice-2", "kicked", "socket-a");
  const originalError = console.error;
  console.error = () => undefined;
  try {
    assert.deepEqual(await evictUserFromForge("forge-1", "kicked", ["voice-1", "voice-2"]), ["voice-1", "voice-2"]);
  } finally {
    console.error = originalError;
  }
  assert.deepEqual(voiceMembers("voice-1"), []);
  assert.deepEqual(voiceMembers("voice-2"), []);
});

test("without a socket server (tests, scripts) eviction is a no-op", async () => {
  joinVoice("voice-1", "user-1", "socket-a");
  assert.deepEqual(await evictUserFromForge("forge-1", "user-1", ["voice-1"]), []);
  assert.deepEqual(evictUserFromChannels("user-1", ["voice-1"]), []);
});

test("removeUserFromVoiceChannels ignores duplicates and unknown channels", () => {
  joinVoice("voice-1", "user-1", "socket-a");
  assert.deepEqual(removeUserFromVoiceChannels("user-1", ["voice-1", "voice-1", "missing"]), ["voice-1"]);
  assert.deepEqual(removeUserFromVoiceChannels("user-1", ["voice-1"]), []);
});
