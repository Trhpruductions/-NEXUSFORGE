import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import type { AddressInfo } from "node:net";
import { prisma } from "../src/lib/prisma.js";
import { publicDevelopersRouter } from "../src/routes/public-developers.routes.js";
import { assertNotLiveDatabase } from "./helpers/live-database-guard.js";

// Writes test rows (one user, two bots, two updates), so it must never run against the live database.
assertNotLiveDatabase();

const RUN = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const ownerId = randomUUID();
const publicBotName = `Pub Bot ${RUN}`;
const privateBotName = `Priv Bot ${RUN}`;
const publishedTitle = `Published ${RUN}`;
const draftTitle = `Draft ${RUN}`;

const app = express();
app.use(express.json());
app.use("/api/public/developers", publicDevelopersRouter);
const server = app.listen(0, "127.0.0.1");

before(async () => {
  await once(server, "listening");
  await prisma.user.create({
    data: {
      id: ownerId,
      username: `pd_${RUN}`.slice(0, 32),
      email: `pd_${RUN}@example.com`,
      password: "not-a-login-in-this-test",
      birthdate: new Date("1990-01-01"),
    },
  });
  await prisma.botApp.create({
    data: { ownerId, name: publicBotName, description: `public ${RUN}`, inviteCode: `pub-${RUN}`, isPublic: true },
  });
  await prisma.botApp.create({
    data: { ownerId, name: privateBotName, description: `private ${RUN}`, inviteCode: `priv-${RUN}`, isPublic: false },
  });
  await prisma.appUpdate.create({
    data: { title: publishedTitle, body: "Published body", version: "1.2.3", publishedAt: new Date(), createdById: ownerId },
  });
  await prisma.appUpdate.create({
    data: { title: draftTitle, body: "Draft body", createdById: ownerId },
  });
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await prisma.user.deleteMany({ where: { id: ownerId } });
  await prisma.$disconnect();
});

function url(path: string): string {
  const { port } = server.address() as AddressInfo;
  return `http://127.0.0.1:${port}${path}`;
}

test("anyone can read published updates, and drafts are never shown", async () => {
  const response = await fetch(url("/api/public/developers/updates"));
  assert.equal(response.status, 200);
  const body = (await response.json()) as { updates: { title: string; version: string | null; publishedAt: string }[] };
  const titles = body.updates.map((update) => update.title);
  assert.ok(titles.includes(publishedTitle));
  assert.ok(!titles.includes(draftTitle), "a draft must not be public");
  const published = body.updates.find((update) => update.title === publishedTitle);
  assert.equal(published?.version, "1.2.3");
});

test("update responses carry only the public fields", async () => {
  const body = (await (await fetch(url("/api/public/developers/updates"))).json()) as { updates: Record<string, unknown>[] };
  for (const update of body.updates) {
    assert.deepEqual(Object.keys(update).sort(), ["body", "id", "publishedAt", "title", "version"]);
  }
});

test("anyone can see public bots, and private bots are not shown", async () => {
  const body = (await (await fetch(url("/api/public/developers/bots"))).json()) as { bots: { name: string }[] };
  const names = body.bots.map((bot) => bot.name);
  assert.ok(names.includes(publicBotName));
  assert.ok(!names.includes(privateBotName), "a private bot must not be public");
});

test("bot responses never include invite codes or owner ids", async () => {
  const body = (await (await fetch(url("/api/public/developers/bots?q=" + encodeURIComponent(RUN)))).json()) as {
    bots: Record<string, unknown>[];
  };
  assert.ok(body.bots.length >= 1);
  for (const bot of body.bots) {
    assert.equal("inviteCode" in bot, false);
    assert.equal("ownerId" in bot, false);
    assert.equal("intents" in bot, false);
  }
});

test("the bot search narrows the public list", async () => {
  const body = (await (await fetch(url("/api/public/developers/bots?q=" + encodeURIComponent(`Pub Bot ${RUN}`)))).json()) as {
    bots: { name: string }[];
  };
  assert.deepEqual(body.bots.map((bot) => bot.name), [publicBotName]);
});
