import test from "node:test";
import assert from "node:assert/strict";
import { buildPollOptions, isPollOpen, tallyPoll, validateVote, type PollOption } from "../src/lib/polls.js";

test("poll answers are trimmed, de-duplicated and counted", () => {
  const built = buildPollOptions(["  Rust ", "rust", "", "GTA   RP", "Minecraft"]);
  assert.ok(Array.isArray(built));
  assert.deepEqual(built.map((option) => option.text), ["Rust", "GTA RP", "Minecraft"]);
  assert.equal(new Set(built.map((option) => option.id)).size, 3, "each answer gets its own id");
  assert.deepEqual(buildPollOptions(["Only one", "only one"]), { error: "A poll needs at least 2 different answers" });
  assert.ok("error" in (buildPollOptions(["a", "x".repeat(56)]) as object));
  assert.ok("error" in (buildPollOptions(Array.from({ length: 11 }, (_, i) => `Answer ${i}`)) as object));
});

test("a poll is open until it ends or is ended early", () => {
  const now = new Date("2026-10-12T12:00:00Z");
  assert.equal(isPollOpen({ endsAt: new Date("2026-10-12T13:00:00Z"), closedAt: null }, now), true);
  assert.equal(isPollOpen({ endsAt: new Date("2026-10-12T11:00:00Z"), closedAt: null }, now), false);
  assert.equal(isPollOpen({ endsAt: new Date("2026-10-12T13:00:00Z"), closedAt: now }, now), false);
});

const options: PollOption[] = [{ id: "a", text: "A" }, { id: "b", text: "B" }, { id: "c", text: "C" }];

test("votes must be real answers, and single-choice polls take one", () => {
  assert.deepEqual(validateVote({ options, allowMultiple: false }, ["a"]), ["a"]);
  assert.deepEqual(validateVote({ options, allowMultiple: false }, []), [], "empty removes your vote");
  assert.ok("error" in (validateVote({ options, allowMultiple: false }, ["a", "b"]) as object));
  assert.deepEqual(validateVote({ options, allowMultiple: true }, ["a", "b", "a"]), ["a", "b"]);
  assert.ok("error" in (validateVote({ options, allowMultiple: true }, ["z"]) as object));
});

test("tally counts votes per answer and distinct voters", () => {
  const result = tallyPoll(options, [
    { optionId: "a", userId: "u1" },
    { optionId: "b", userId: "u1" },
    { optionId: "a", userId: "u2" },
    { optionId: "gone", userId: "u3" },
  ]);
  assert.deepEqual(result.counts, { a: 2, b: 1, c: 0 });
  assert.equal(result.voters, 2);
});
