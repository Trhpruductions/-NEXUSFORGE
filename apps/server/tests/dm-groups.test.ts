import test from "node:test";
import assert from "node:assert/strict";
import { groupMemberProblem, type FriendRelation } from "../src/lib/dm-groups.js";

const me = "me";
const accepted = (a: string, b: string): FriendRelation => ({ senderId: a, receiverId: b, status: "ACCEPTED" });

test("a group of accepted friends is allowed (friendship counts whoever sent the request)", () => {
  assert.equal(groupMemberProblem(me, ["ann", "bob"], [accepted(me, "ann"), accepted("bob", me)]), null);
});

test("someone who isn't an accepted friend can't be added", () => {
  assert.match(groupMemberProblem(me, ["ann", "stranger"], [accepted(me, "ann")]) ?? "", /accepted friends/);
  // A pending request isn't a friendship.
  assert.match(groupMemberProblem(me, ["pat"], [{ senderId: me, receiverId: "pat", status: "PENDING" }]) ?? "", /accepted friends/);
});

test("a block either way stops someone being added, even alongside an old friendship row", () => {
  assert.match(groupMemberProblem(me, ["ann"], [{ senderId: "ann", receiverId: me, status: "BLOCKED" }]) ?? "", /blocked/);
  assert.match(groupMemberProblem(me, ["ann"], [accepted(me, "ann"), { senderId: me, receiverId: "ann", status: "BLOCKED" }]) ?? "", /blocked/);
});

test("relations between other people don't count as the creator's friendships", () => {
  assert.match(groupMemberProblem(me, ["ann", "bob"], [accepted(me, "ann"), accepted("ann", "bob")]) ?? "", /accepted friends/);
});

test("the creator in the list is ignored", () => {
  assert.equal(groupMemberProblem(me, [me, "ann"], [accepted(me, "ann")]), null);
});
