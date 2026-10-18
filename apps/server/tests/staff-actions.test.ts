import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { signAccessToken } from "../src/lib/jwt.js";
import { prisma } from "../src/lib/prisma.js";
import { toggleAdminDenial, toggledAdminRole } from "../src/lib/staff-actions.js";
import { adminRouter } from "../src/routes/admin.routes.js";
import { assertNotLiveDatabase } from "./helpers/live-database-guard.js";

// "Toggle admin" used to skip the role hierarchy that "set role" checks, so an admin could remove another admin
// (or themselves), and no role or badge change was audit-logged.
// Writes a few users and audit rows (removed afterwards), so it must never run against the live database.
assertNotLiveDatabase();

const subject = (id: string, appRole: "USER" | "MODERATOR" | "ADMIN" | "EXEC" | "OWNER" | null, isAdmin = false) => ({ id, appRole, isAdmin });

test("toggle admin follows the same hierarchy as set role", () => {
  const admin = subject("admin", "ADMIN", true);
  const exec = subject("exec", "EXEC", true);
  const owner = subject("owner", "OWNER", true);

  assert.equal(toggleAdminDenial(admin, subject("user", "USER")), null, "an admin can promote a user");
  assert.equal(toggleAdminDenial(admin, subject("mod", "MODERATOR")), null, "and a moderator");
  assert.equal(toggleAdminDenial(admin, subject("other-admin", "ADMIN", true))?.error, "Cannot modify users with equal or higher role");
  assert.equal(toggleAdminDenial(admin, subject("legacy-admin", null, true))?.error, "Cannot modify users with equal or higher role", "legacy isAdmin flag counts as ADMIN");
  assert.equal(toggleAdminDenial(admin, admin)?.error, "You can't change your own role");
  assert.equal(toggleAdminDenial(owner, owner)?.error, "You can't change your own role");
  assert.equal(toggleAdminDenial(admin, exec)?.error, "Cannot modify protected higher-up roles");
  assert.equal(toggleAdminDenial(exec, owner)?.error, "Cannot modify protected higher-up roles");
  assert.equal(toggleAdminDenial(exec, subject("a2", "ADMIN", true)), null, "an exec can remove an admin");
  assert.equal(toggleAdminDenial(subject("mod", "MODERATOR"), subject("user", "USER"))?.error, "Admin access required");

  assert.equal(toggledAdminRole(subject("user", "USER")), "ADMIN");
  assert.equal(toggledAdminRole(subject("a", "ADMIN", true)), "USER");
  assert.equal(toggledAdminRole(subject("legacy", null, true)), "USER");
});

const RUN = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const ids = { actor: randomUUID(), peerAdmin: randomUUID(), user: randomUUID(), other: randomUUID() };
const app = express();
app.use(express.json());
app.use("/api/admin", adminRouter);
const server = app.listen(0, "127.0.0.1");
let token = "";

before(async () => {
  await once(server, "listening");
  const make = (id: string, name: string, appRole: "USER" | "ADMIN") =>
    prisma.user.create({
      data: {
        id,
        username: `${name}_${RUN}`.slice(0, 32),
        email: `${name}_${RUN}@example.com`,
        password: "not-a-login-in-this-test",
        birthdate: new Date("1990-01-01"),
        appRole,
        isAdmin: appRole === "ADMIN",
      },
    });
  await make(ids.actor, "sa_actor", "ADMIN");
  await make(ids.peerAdmin, "sa_peer", "ADMIN");
  await make(ids.user, "sa_user", "USER");
  await make(ids.other, "sa_other", "USER");
  token = signAccessToken({ sub: ids.actor, username: `sa_actor_${RUN}`.slice(0, 32), email: `sa_actor_${RUN}@example.com`, appRole: "ADMIN", jti: randomUUID() });
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.auditLog.deleteMany({ where: { resourceId: { in: Object.values(ids) } } });
  await prisma.user.deleteMany({ where: { id: { in: Object.values(ids) } } });
  await prisma.$disconnect();
});

async function post(path: string, body: unknown = {}) {
  const { port } = server.address() as AddressInfo;
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: (await response.json().catch(() => null)) as Record<string, unknown> | null };
}

const roleOf = async (id: string) => (await prisma.user.findUnique({ where: { id }, select: { appRole: true, isAdmin: true } }))!;
const auditFor = (resourceId: string) => prisma.auditLog.findMany({ where: { resourceId }, orderBy: { createdAt: "asc" } });

test("an admin can't toggle another admin or themselves, and nothing changes", async () => {
  const peer = await post(`/api/admin/users/${ids.peerAdmin}/toggle-admin`);
  assert.equal(peer.status, 403);
  assert.deepEqual(await roleOf(ids.peerAdmin), { appRole: "ADMIN", isAdmin: true });

  const self = await post(`/api/admin/users/${ids.actor}/toggle-admin`);
  assert.equal(self.status, 403);
  assert.deepEqual(await roleOf(ids.actor), { appRole: "ADMIN", isAdmin: true });
  assert.equal((await auditFor(ids.peerAdmin)).length, 0);
});

test("a role change through toggle admin is audit-logged with actor, target, before and after", async () => {
  const response = await post(`/api/admin/users/${ids.user}/toggle-admin`);
  assert.equal(response.status, 200);
  assert.deepEqual(await roleOf(ids.user), { appRole: "ADMIN", isAdmin: true });

  const [entry] = await auditFor(ids.user);
  assert.ok(entry, "an audit row was written");
  assert.equal(entry.actorId, ids.actor);
  assert.equal(entry.resourceType, "User");
  assert.equal(entry.operation, "UPDATE");
  assert.deepEqual(entry.beforeValues, { appRole: "USER", isAdmin: false });
  assert.deepEqual(entry.afterValues, { appRole: "ADMIN", isAdmin: true });
  assert.deepEqual([...entry.changedFields].sort(), ["appRole", "isAdmin"]);
  assert.equal((entry.metadata as Record<string, unknown>).action, "toggle-admin");
  assert.equal(entry.endpoint, `/api/admin/users/${ids.user}/toggle-admin`);
});

test("set role is audit-logged", async () => {
  const response = await post(`/api/admin/users/${ids.other}/set-role`, { role: "MODERATOR" });
  assert.equal(response.status, 200);
  const [entry] = await auditFor(ids.other);
  assert.equal(entry?.actorId, ids.actor);
  assert.deepEqual(entry?.beforeValues, { appRole: "USER", isAdmin: false });
  assert.deepEqual(entry?.afterValues, { appRole: "MODERATOR", isAdmin: false });
  assert.equal((entry?.metadata as Record<string, unknown>).action, "set-role");
});

test("manual badge grants and revokes are audit-logged", async () => {
  assert.equal((await post(`/api/admin/users/${ids.other}/badges/grant`, { badgeKey: "vip" })).status, 200);
  assert.equal((await post(`/api/admin/users/${ids.other}/badges/revoke`, { badgeKey: "vip" })).status, 200);
  const entries = (await auditFor(ids.other)).filter((entry) => String((entry.metadata as Record<string, unknown>).action).includes("badge"));
  assert.equal(entries.length, 2);
  const [grant, revoke] = entries;
  assert.equal(grant.actorId, ids.actor);
  assert.equal((grant.metadata as Record<string, unknown>).action, "grant-profile-badge");
  assert.deepEqual(grant.beforeValues, { badgeKey: "vip", hasBadge: false });
  assert.deepEqual(grant.afterValues, { badgeKey: "vip", hasBadge: true });
  assert.equal((revoke.metadata as Record<string, unknown>).action, "revoke-profile-badge");
  assert.deepEqual(revoke.beforeValues, { badgeKey: "vip", hasBadge: true });
  assert.deepEqual(revoke.afterValues, { badgeKey: "vip", hasBadge: false });
});
