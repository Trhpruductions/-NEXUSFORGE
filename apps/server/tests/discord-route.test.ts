import test from "node:test";
import assert from "node:assert/strict";
import { PermissionFlagsBits } from "discord.js";
import { processDiscordCommand, setDiscordOpsSummaryReporter, setDiscordSocialReporter } from "../src/routes/discord.routes.js";

test("processDiscordCommand posts social message when permissions are valid", async () => {
  let called = false;
  setDiscordSocialReporter(async (message) => {
    called = true;
    assert.equal(message, "hello world");
  });

  const response = await processDiscordCommand({
    type: 2,
    data: { name: "social", options: [{ name: "message", value: "hello world" }] },
    member: { permissions: String(PermissionFlagsBits.ManageGuild) },
    user: { id: "123", username: "tester" },
  });

  assert.equal(called, true);
  assert.equal(response.data?.content, "Social message posted.");
});

test("processDiscordCommand rejects social command without Manage Guild permission", async () => {
  setDiscordSocialReporter(async () => {
    throw new Error("should not be called");
  });

  const response = await processDiscordCommand({
    type: 2,
    data: { name: "social", options: [{ name: "message", value: "hello world" }] },
    member: { permissions: String(0) },
    user: { id: "123", username: "tester" },
  });

  assert.equal(response.data?.content, "You need Manage Server permission to use this command.");
});

test("processDiscordCommand rejects ops-summary without Manage Guild permission", async () => {
  const response = await processDiscordCommand({
    type: 2,
    data: { name: "ops-summary", options: [] },
    member: { permissions: String(0) },
    user: { id: "123", username: "tester" },
  });

  assert.equal(response.data?.content, "You need Manage Server permission to use this command.");
});

test("processDiscordCommand returns ops-summary with Manage Guild permission", async () => {
  setDiscordOpsSummaryReporter(async () => {});

  const response = await processDiscordCommand({
    type: 2,
    data: { name: "ops-summary", options: [] },
    member: { permissions: String(PermissionFlagsBits.ManageGuild) },
    user: { id: "123", username: "tester" },
  });

  assert.equal(typeof response.data?.content, "string");
  assert.equal(response.data?.content?.includes("NexusForge API: online"), true);
  assert.equal(Array.isArray(response.data?.embeds), true);
  assert.equal(response.data?.embeds?.[0]?.title, "NexusForge Operations Summary");
});

test("processDiscordCommand can publish ops-summary with Manage Guild permission", async () => {
  let called = false;
  setDiscordOpsSummaryReporter(async () => {
    called = true;
  });

  const response = await processDiscordCommand({
    type: 2,
    data: { name: "ops-summary", options: [{ name: "publish", value: true }] },
    member: { permissions: String(PermissionFlagsBits.ManageGuild) },
    user: { id: "123", username: "tester" },
  });

  assert.equal(called, true);
  assert.equal(response.data?.content?.includes("Published to app-runtime."), true);
});

test("processDiscordCommand returns embedded snapshot for status", async () => {
  const response = await processDiscordCommand({
    type: 2,
    data: { name: "status", options: [] },
    member: { permissions: String(0) },
    user: { id: "123", username: "tester" },
  });

  assert.equal(typeof response.data?.content, "string");
  assert.equal(response.data?.content?.includes("NexusForge API: online"), true);
  assert.equal(Array.isArray(response.data?.embeds), true);
  assert.equal(response.data?.embeds?.[0]?.title, "NexusForge Operations Summary");
});
