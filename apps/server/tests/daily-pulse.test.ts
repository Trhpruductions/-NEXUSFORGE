import { test } from "node:test";
import assert from "node:assert/strict";
import { composePulse, type PulseStats } from "../src/lib/daily-pulse-format.js";

const quiet: PulseStats = {
  newUsers: 0,
  newVerified: 0,
  totalUsers: 98,
  activeUsers: 4,
  messages: 12,
  directMessages: 3,
  newForges: 0,
  totalForges: 12,
  payments: 0,
  paymentCents: 0,
  paidActive: 1,
  lifetime: 1,
  problemNew: 0,
  problemOpen: 0,
  ticketsNew: 0,
  ticketsWaiting: 0,
  errorGroups: 0,
  errorHits: 0,
};

test("a quiet day says so instead of listing empty queues", () => {
  const body = composePulse(quiet, "https://nfgcord.com/");
  assert.match(body, /Sign-ups: 0 \(0 verified\) · 98 accounts in total/);
  assert.match(body, /nothing, all quiet/);
  assert.doesNotMatch(body, /admin\/errors/);
  assert.ok(body.length < 1024, "fits in one Discord embed field");
});

test("open work gets links to the staff pages", () => {
  const body = composePulse({ ...quiet, newUsers: 3, newVerified: 2, payments: 2, paymentCents: 1998, problemNew: 1, problemOpen: 2, ticketsWaiting: 1, errorGroups: 1, errorHits: 3 }, "https://nfgcord.com");
  assert.match(body, /Sign-ups: 3 \(2 verified\)/);
  assert.match(body, /2 payments \(\$19\.98\)/);
  assert.match(body, /Problem reports: 1 new · 2 open → https:\/\/nfgcord\.com\/admin\/problem-reports/);
  assert.match(body, /Support tickets: 0 new · 1 waiting on staff → https:\/\/nfgcord\.com\/app\/support/);
  assert.match(body, /Server errors: 1 kind · 3 hits → https:\/\/nfgcord\.com\/admin\/errors/);
  assert.match(body, /\*\*Needs a look\*\*/);
});
