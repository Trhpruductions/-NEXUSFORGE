import test from "node:test";
import assert from "node:assert/strict";
import { createCommands } from "../src/lib/discord-bot.js";

test("discord bot slash commands include social command with required message option", () => {
  const commands = createCommands();
  const socialCommand = commands.find((command) => command.name === "social");

  assert.ok(socialCommand, "Expected social command to be registered");
  assert.equal(socialCommand?.name, "social");
  assert.equal(socialCommand?.description, "Post a message to the configured NexusForge social report channel.");
  assert.ok(Array.isArray(socialCommand?.options), "Expected social command to define options");
  assert.equal(socialCommand?.options?.[0]?.name, "message");
  assert.equal(socialCommand?.options?.[0]?.required, true);
});
