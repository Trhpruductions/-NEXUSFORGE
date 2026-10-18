import { test } from "node:test";
import assert from "node:assert/strict";
import { fitGrid } from "../../src/lib/layout/fit-grid";

test("nothing to lay out, or no room measured yet: no fixed size", () => {
  assert.deepEqual(fitGrid(0, 800, 600), { columns: 1, tileWidth: 0 });
  assert.deepEqual(fitGrid(2, 0, 0), { columns: 1, tileWidth: 0 });
});

test("two people in a small room both fit without scrolling, as big as possible", () => {
  // The 1310px window from the screenshot: about 640x430 for the tiles. Before, each tile was 640 wide (360 tall)
  // and the second one was cut off behind a scrollbar.
  const fit = fitGrid(2, 640, 430);
  const rows = Math.ceil(2 / fit.columns);
  const height = rows * (fit.tileWidth * 9) / 16 + (rows - 1) * 12;
  assert.ok(height <= 430, `grid is ${height}px tall`);
  assert.ok(fit.columns * fit.tileWidth + (fit.columns - 1) * 12 <= 640);
  assert.equal(fit.tileWidth, 371);
  // In a wide room the two sit side by side, even when stacking would be a few pixels bigger (1300x744: 644 vs 650).
  assert.equal(fitGrid(2, 1300, 430).columns, 2);
  assert.equal(fitGrid(2, 1300, 744).columns, 2);
});

test("one person gets one big tile that still fits the height", () => {
  const fit = fitGrid(1, 1400, 600);
  assert.equal(fit.columns, 1);
  assert.equal(fit.tileWidth, Math.floor(600 * (16 / 9)));
});

test("a tall room stacks tiles when that makes them bigger", () => {
  assert.equal(fitGrid(2, 500, 900).columns, 1);
});

test("larger groups pick the column count that gives the biggest tiles", () => {
  assert.equal(fitGrid(9, 1500, 860).columns, 3);
  assert.equal(fitGrid(4, 1500, 860).columns, 2);
});

test("too many people for the space: tiles keep a readable size and the area scrolls", () => {
  const fit = fitGrid(30, 900, 400);
  assert.equal(fit.tileWidth, 200);
  assert.equal(fit.columns, 4);
});
