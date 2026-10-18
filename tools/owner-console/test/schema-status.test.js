"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { classifySchemaSql } = require("../lib/schema-status");

const EMPTY = "-- This is an empty migration.";

test("empty output with a clean exit is not reported as in sync", () => {
  const r = classifySchemaSql("", { exitCode: 0 });
  assert.equal(r.status, "unknown");
  assert.equal(r.additive, false);
});

test("an empty-migration marker with a clean exit is in sync", () => {
  const r = classifySchemaSql(EMPTY, { exitCode: 0 });
  assert.equal(r.status, "in_sync");
  assert.equal(r.additive, true);
});

test("a non-zero exit is never in sync, even when the output looks empty", () => {
  const r = classifySchemaSql(EMPTY, { exitCode: 1 });
  assert.equal(r.status, "unknown");
  assert.equal(r.additive, false);
});

test("a missing exit code is treated as unknown", () => {
  assert.equal(classifySchemaSql(EMPTY).status, "unknown");
});

test("a dry run is never reported as checked", () => {
  const r = classifySchemaSql(EMPTY, { exitCode: 0, dryRun: true });
  assert.equal(r.status, "unknown");
  assert.match(r.verdict, /dry run/i);
});

test("truncated output is unknown, even when the visible part has statements", () => {
  const r = classifySchemaSql("ALTER TABLE \"User\" ADD COLUMN \"x\" TEXT;", { exitCode: 0, truncated: true });
  assert.equal(r.status, "unknown");
});

test("unreadable output with a clean exit is unknown", () => {
  const r = classifySchemaSql("Error: something unexpected happened", { exitCode: 0 });
  assert.equal(r.status, "unknown");
});

test("a pure addition is additive", () => {
  const sql = 'ALTER TABLE "User" ADD COLUMN "nickname" TEXT;\nCREATE TABLE "Thing" ("id" TEXT NOT NULL);';
  const r = classifySchemaSql(sql, { exitCode: 0 });
  assert.equal(r.status, "additive");
  assert.equal(r.additive, true);
  assert.equal(r.drops, 0);
});

test("a DROP statement is destructive", () => {
  const r = classifySchemaSql('DROP TABLE "Old";', { exitCode: 0 });
  assert.equal(r.status, "destructive");
  assert.equal(r.drops, 1);
});

test("a DROP inside an ALTER that also adds a column is still destructive", () => {
  const sql = 'ALTER TABLE "User" DROP COLUMN "legacy", ADD COLUMN "nickname" TEXT;';
  const r = classifySchemaSql(sql, { exitCode: 0 });
  assert.equal(r.status, "destructive");
  assert.equal(r.drops, 1);
  assert.equal(r.additive, false);
});

test("a NOT NULL column without a default needs review", () => {
  const r = classifySchemaSql('ALTER TABLE "User" ADD COLUMN "must" TEXT NOT NULL;', { exitCode: 0 });
  assert.equal(r.status, "not_additive");
});

test("a NOT NULL column with a default is additive", () => {
  const r = classifySchemaSql('ALTER TABLE "User" ADD COLUMN "flag" BOOLEAN NOT NULL DEFAULT false;', { exitCode: 0 });
  assert.equal(r.status, "additive");
});

test("ALTER COLUMN, RENAME and SET NOT NULL need review", () => {
  assert.equal(classifySchemaSql('ALTER TABLE "User" ALTER COLUMN "name" SET NOT NULL;', { exitCode: 0 }).status, "not_additive");
  assert.equal(classifySchemaSql('ALTER TABLE "User" RENAME COLUMN "a" TO "b";', { exitCode: 0 }).status, "not_additive");
});

test("a data statement that is not CREATE or ALTER needs review", () => {
  const r = classifySchemaSql('UPDATE "User" SET "x" = 1;', { exitCode: 0 });
  assert.equal(r.status, "not_additive");
  assert.equal(r.others, 1);
});

test("comment lines are ignored when counting statements", () => {
  const sql = "-- DROP is mentioned only in this comment\n" + 'CREATE TABLE "T" ("id" TEXT);';
  const r = classifySchemaSql(sql, { exitCode: 0 });
  assert.equal(r.status, "additive");
  assert.equal(r.drops, 0);
});
