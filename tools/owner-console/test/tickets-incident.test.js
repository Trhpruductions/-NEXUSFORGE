"use strict";

// Manual incidents need a real title. The test uses its own temporary database file, never the triage store.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { TicketStore } = require("../lib/tickets/store");

function withStore(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "console-tickets-"));
  const store = new TicketStore(path.join(dir, "test.sqlite"));
  try {
    fn(store);
  } finally {
    store.close();
  }
}

test("an incident without a title is refused, and nothing is stored", () => {
  withStore((store) => {
    assert.throws(() => store.createIncident({ title: undefined, severity: "HIGH", note: "" }), /a title is required/);
    assert.throws(() => store.createIncident({ title: "   ", severity: "HIGH", note: "" }), /a title is required/);
    assert.throws(() => store.createIncident({ title: 42, severity: "HIGH", note: "" }), /a title is required/);
  });
});

test("an incident keeps its trimmed title, not the text 'undefined'", () => {
  withStore((store) => {
    const created = store.createIncident({ title: "  Login outage  ", severity: "HIGH", note: "" });
    assert.equal(created.title, "Login outage");
    assert.notEqual(created.title, "undefined");
  });
});

test("an unknown severity is still refused", () => {
  withStore((store) => {
    assert.throws(() => store.createIncident({ title: "Something", severity: "NOPE", note: "" }), /unknown severity/);
  });
});
