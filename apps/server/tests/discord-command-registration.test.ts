import test from "node:test";
import assert from "node:assert/strict";
import { createCommands } from "../src/lib/discord-bot.js";

test("discord command registration payload includes social command with required string option", () => {
  const commands = createCommands();
  const socialCommand = commands.find((command) => command.name === "social");

  assert.ok(socialCommand, "Expected social command to be present");
  assert.equal(socialCommand?.name, "social");
  assert.equal(socialCommand?.description, "Post a message to the configured NexusForge social report channel.");
  assert.ok(Array.isArray(socialCommand?.options), "Expected social command to have options array");
  assert.equal(socialCommand?.options?.length, 1, "Expected social command to only have one option");

  const messageOption = socialCommand?.options?.[0];
  assert.equal(messageOption?.name, "message");
  assert.equal(messageOption?.description, "The message to post");
  assert.equal(messageOption?.type, 3, "Expected message option to be a string type");
  assert.equal(messageOption?.required, true);
});

test("discord command registration payload includes ops-summary command", () => {
  const commands = createCommands();
  const opsSummaryCommand = commands.find((command) => command.name === "ops-summary");

  assert.ok(opsSummaryCommand, "Expected ops-summary command to be present");
  assert.equal(opsSummaryCommand?.name, "ops-summary");
  assert.equal(opsSummaryCommand?.description, "Show an executive NexusForge operations snapshot.");
  assert.equal(opsSummaryCommand?.options?.length ?? 0, 1, "Expected ops-summary command to expose one option");
  const publishOption = opsSummaryCommand?.options?.[0];
  assert.equal(publishOption?.name, "publish");
  assert.equal(publishOption?.description, "Also publish this summary to the app-runtime channel.");
  assert.equal(publishOption?.type, 5, "Expected publish option to be a boolean type");
});
