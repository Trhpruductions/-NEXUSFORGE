import "./helpers/email-env.js";
import test from "node:test";
import assert from "node:assert/strict";
import { confirmEmailChange, EMAIL_CHANGE_SENT_MESSAGE, requestEmailChange, type EmailChangeDeps } from "../src/lib/email-change.js";

/**
 * A stub of the database and the code helpers. It records what the flow asked for, so the tests can
 * check the order of steps and what was (and was not) written.
 */
function stubDeps(overrides: Partial<EmailChangeDeps> = {}) {
  const accounts = new Map([["user-1", { id: "user-1", username: "Sam", email: "sam@nexus.example.org" }]]);
  const taken = new Set<string>(["taken@nexus.example.org"]);
  const issued: Array<{ userId: string; target: string }> = [];
  const applied: Array<{ userId: string; email: string }> = [];
  const notices: Array<{ to: string; newEmailMasked: string }> = [];
  let activeCode: { target: string; code: string; attemptsLeft: number } | null = null;

  const deps: EmailChangeDeps = {
    findAccount: async (userId) => accounts.get(userId) ?? null,
    isEmailTaken: async (email) => taken.has(email),
    cooldownSeconds: async () => 0,
    issueCode: async (input) => {
      issued.push(input);
      activeCode = { target: input.target, code: "654321", attemptsLeft: 5 };
      return { ok: true };
    },
    checkCode: async ({ code }) => {
      if (!activeCode || code !== activeCode.code) {
        if (activeCode) activeCode.attemptsLeft -= 1;
        return { ok: false, error: "That code is not right.", attemptsLeft: activeCode?.attemptsLeft ?? 0 };
      }
      return { ok: true, target: activeCode.target };
    },
    applyEmail: async (input) => {
      applied.push(input);
      return { ok: true };
    },
    notifyOldAddress: ({ to, newEmailMasked }) => {
      notices.push({ to, newEmailMasked });
    },
    now: () => new Date("2026-10-14T12:00:00Z"),
    ...overrides,
  };
  return { deps, issued, applied, notices, accounts };
}

test("requesting a change sends a code to the NEW address, and changes nothing yet", async () => {
  const { deps, issued, applied } = stubDeps();
  const result = await requestEmailChange(deps, { userId: "user-1", newEmail: "  New.Address@Nexus.Example.org " });
  assert.equal(result.status, 200);
  assert.equal(result.body.message, EMAIL_CHANGE_SENT_MESSAGE);
  assert.deepEqual(issued, [{ userId: "user-1", target: "new.address@nexus.example.org" }]);
  assert.equal(applied.length, 0, "the account email is untouched until the code is confirmed");
});

test("asking for a taken address and asking for the current one get the same answer, and no code is sent", async () => {
  const { deps, issued } = stubDeps();
  const taken = await requestEmailChange(deps, { userId: "user-1", newEmail: "taken@nexus.example.org" });
  const same = await requestEmailChange(deps, { userId: "user-1", newEmail: "sam@nexus.example.org" });
  const free = await requestEmailChange(deps, { userId: "user-1", newEmail: "free@nexus.example.org" });
  assert.equal(taken.status, 200);
  assert.equal(same.status, 200);
  assert.deepEqual(taken.body, same.body, "the taken answer does not differ from the same-address answer");
  assert.deepEqual(taken.body, free.body, "nor from a free address, so nothing is revealed");
  assert.equal(issued.length, 1, "only the free address received a code");
});

test("a cooldown is reported as a 429 with the wait, whatever address was asked for", async () => {
  const { deps, issued } = stubDeps({ cooldownSeconds: async () => 30 });
  const free = await requestEmailChange(deps, { userId: "user-1", newEmail: "free@nexus.example.org" });
  const taken = await requestEmailChange(deps, { userId: "user-1", newEmail: "taken@nexus.example.org" });
  assert.equal(free.status, 429);
  assert.equal(free.body.retryAfterSeconds, 30);
  assert.deepEqual(taken, free, "a taken address gets the same cooldown answer, so the cooldown reveals nothing");
  assert.equal(issued.length, 0);
});

test("a delivery failure after the answer is logged, and the requester still sees the same answer", async () => {
  const { deps } = stubDeps({ issueCode: async () => Promise.reject(new Error("SMTP 535 Invalid login for sam@x")) });
  const result = await requestEmailChange(deps, { userId: "user-1", newEmail: "free@nexus.example.org" });
  assert.equal(result.status, 200);
  assert.equal(result.body.message, EMAIL_CHANGE_SENT_MESSAGE);
  assert.doesNotMatch(JSON.stringify(result.body), /SMTP|535|Invalid login/);
});

test("confirming with the right code switches the address and tells the OLD address", async () => {
  const { deps, issued, applied, notices } = stubDeps();
  await requestEmailChange(deps, { userId: "user-1", newEmail: "free@nexus.example.org" });
  const result = await confirmEmailChange(deps, { userId: "user-1", code: "654321" });

  assert.equal(result.status, 200);
  assert.equal(result.body.emailVerified, true, "the code proved control of the new address");
  assert.deepEqual(applied, [{ userId: "user-1", email: "free@nexus.example.org" }]);
  assert.equal(issued.length, 1);
  assert.equal(notices.length, 1);
  assert.equal(notices[0].to, "sam@nexus.example.org", "the security notice goes to the old address");
  assert.doesNotMatch(notices[0].newEmailMasked, /^free@/, "the new address is masked in the notice");
});

test("a wrong code changes nothing, reports the attempts left, and sends no notice", async () => {
  const { deps, applied, notices } = stubDeps();
  await requestEmailChange(deps, { userId: "user-1", newEmail: "free@nexus.example.org" });
  const result = await confirmEmailChange(deps, { userId: "user-1", code: "000000" });
  assert.equal(result.status, 400);
  assert.equal(result.body.attemptsLeft, 4);
  assert.equal(applied.length, 0);
  assert.equal(notices.length, 0);
});

test("when a concurrent request takes the address first (unique-constraint race), the confirm is refused cleanly", async () => {
  const { deps, applied, notices } = stubDeps({ applyEmail: async () => ({ ok: false, reason: "taken" }) });
  await requestEmailChange(deps, { userId: "user-1", newEmail: "free@nexus.example.org" });
  const result = await confirmEmailChange(deps, { userId: "user-1", code: "654321" });
  assert.equal(result.status, 409);
  assert.equal(result.body.error, "That email is already in use");
  assert.equal(applied.length, 0, "nothing was applied");
  assert.equal(notices.length, 0, "no notice for a change that did not happen");
});

test("an unknown or deleted account is refused", async () => {
  const { deps } = stubDeps();
  assert.equal((await requestEmailChange(deps, { userId: "ghost", newEmail: "a@nexus.example.org" })).status, 404);
  assert.equal((await confirmEmailChange(deps, { userId: "ghost", code: "654321" })).status, 404);
});
