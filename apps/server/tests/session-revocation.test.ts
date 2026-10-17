import test, { afterEach } from "node:test";
import assert from "node:assert/strict";
import type { Server } from "socket.io";
import { disconnectUserSockets, resetIoForTests, setIo, socketsToDisconnect } from "../src/lib/realtime.js";

type FakeSocket = { data: { jti?: string }; events: string[]; disconnected: boolean[]; emit: (event: string) => void; disconnect: (close?: boolean) => void };

function fakeSocket(jti: string): FakeSocket {
  const socket: FakeSocket = {
    data: { jti },
    events: [],
    disconnected: [],
    emit(event: string) {
      socket.events.push(event);
    },
    disconnect(close?: boolean) {
      socket.disconnected.push(close === true);
    },
  };
  return socket;
}

/** Only the part of socket.io that disconnectUserSockets uses: io.in(room).fetchSockets(). */
function fakeIo(sockets: FakeSocket[]) {
  const rooms: string[] = [];
  const io = {
    in(room: string) {
      rooms.push(room);
      return { fetchSockets: async () => sockets };
    },
  };
  return { io: io as unknown as Server, rooms };
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

afterEach(() => {
  resetIoForTests();
});

test("without a socket server running, revocation is a no-op", async () => {
  resetIoForTests();
  assert.equal(await disconnectUserSockets("user-1", { reason: "password_changed" }), 0);
});

test("every socket of the user is told why and then closed", async () => {
  const sockets = [fakeSocket("a"), fakeSocket("b")];
  const { io, rooms } = fakeIo(sockets);
  setIo(io);

  const closed = await disconnectUserSockets("user-1", { reason: "password_changed" });
  await wait(300);

  assert.equal(closed, 2);
  assert.deepEqual(rooms, ["user:user-1"]);
  for (const socket of sockets) {
    assert.deepEqual(socket.events, ["session:revoked"]);
    assert.deepEqual(socket.disconnected, [true]);
  }
});

test("sign out everywhere keeps the socket of the device that asked", async () => {
  const current = fakeSocket("current-token");
  const other = fakeSocket("other-token");
  setIo(fakeIo([current, other]).io);

  const closed = await disconnectUserSockets("user-1", { reason: "signed_out_everywhere", exceptAccessJti: "current-token" });
  await wait(300);

  assert.equal(closed, 1);
  assert.deepEqual(current.events, []);
  assert.deepEqual(current.disconnected, []);
  assert.deepEqual(other.events, ["session:revoked"]);
  assert.deepEqual(other.disconnected, [true]);
});

test("socketsToDisconnect keeps everything when no exception is given", () => {
  const sockets = [fakeSocket("a"), fakeSocket("b")];
  assert.equal(socketsToDisconnect(sockets).length, 2);
  assert.equal(socketsToDisconnect(sockets, "a").length, 1);
  assert.equal(socketsToDisconnect(sockets, "a")[0]?.data.jti, "b");
});
