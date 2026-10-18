import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import type { Server } from "socket.io";
import { prisma } from "../src/lib/prisma.js";
import { resetIoForTests, setIo } from "../src/lib/realtime.js";
import { liftSuspension, resetSuspensionCacheForTests, suspendAccount } from "../src/lib/account-suspension.js";
import { assertNotLiveDatabase } from "./helpers/live-database-guard.js";

// An app-wide suspension or VAC ban must end the account's live connections (and with them any voice call:
// the gateway's disconnect handler takes the socket out of voice). Writes one user and its suspension rows
// (removed afterwards), so it must never run against the live database.
assertNotLiveDatabase();

const RUN = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const userId = randomUUID();
const actorId = randomUUID();

before(async () => {
  for (const [id, name] of [[userId, "sd_user"], [actorId, "sd_staff"]] as const) {
    await prisma.user.create({
      data: { id, username: `${name}_${RUN}`.slice(0, 32), email: `${name}_${RUN}@example.com`, password: "not-a-login-in-this-test", birthdate: new Date("1990-01-01") },
    });
  }
});

after(async () => {
  resetIoForTests();
  resetSuspensionCacheForTests();
  await prisma.user.deleteMany({ where: { id: { in: [userId, actorId] } } });
  await prisma.$disconnect();
});

test("suspending an account tells its live sockets why and then disconnects them", async () => {
  const calls: string[] = [];
  const io = {
    to: (room: string) => ({ emit: (event: string) => void calls.push(`emit ${event} to ${room}`) }),
    in: (room: string) => ({ disconnectSockets: (close: boolean) => void calls.push(`disconnect ${room} close=${close}`) }),
  };
  setIo(io as unknown as Server);

  const entry = await suspendAccount({ actorId, userId, reason: `test suspension ${RUN}`, days: 1 });
  assert.ok(entry, "the suspension was applied");
  await new Promise((resolve) => setTimeout(resolve, 400));

  assert.deepEqual(calls, [`emit account:suspended to user:${userId}`, `disconnect user:${userId} close=true`]);
  assert.equal(await liftSuspension({ actorId, userId, note: "test over" }), true);
});
