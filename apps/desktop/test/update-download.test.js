"use strict";

// Local test server on a random port only. Nothing here touches the production manifest or download host.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const download = require("../lib/update-download");

const tempDir = () => fs.mkdtempSync(path.join(os.tmpdir(), "nf-update-download-"));
const leftovers = (dir) => fs.readdirSync(dir);

function serve(handler) {
  return new Promise((resolve) => {
    const server = http.createServer(handler);
    server.listen(0, "127.0.0.1", () => resolve({ server, base: `http://127.0.0.1:${server.address().port}` }));
  });
}

async function stop(server) {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
}

test("a complete download lands at the destination and leaves no partial file", async () => {
  const body = Buffer.alloc(200 * 1024, 7);
  const { server, base } = await serve((req, res) => {
    res.writeHead(200, { "content-type": "application/octet-stream", "content-length": body.length });
    res.end(body);
  });
  try {
    const dir = tempDir();
    const dest = path.join(dir, "Setup 9.9.9.exe");
    const progress = [];
    const result = await download.downloadToFile({ url: `${base}/setup.exe`, destinationPath: dest, onProgress: (received, total) => progress.push([received, total]) });
    assert.equal(result.bytes, body.length);
    assert.deepEqual(fs.readFileSync(dest), body);
    assert.deepEqual(leftovers(dir), ["Setup 9.9.9.exe"]);
    assert.ok(progress.length > 0);
    assert.deepEqual(progress.at(-1), [body.length, body.length]);
  } finally {
    await stop(server);
  }
});

test("an installer announced as larger than the cap is refused before its body is read", async () => {
  let bytesSent = 0;
  const { server, base } = await serve((req, res) => {
    res.writeHead(200, { "content-length": 5000 });
    const chunk = Buffer.alloc(1000);
    bytesSent += chunk.length;
    res.write(chunk);
    // The rest never comes; the download must not wait for it.
  });
  try {
    const dir = tempDir();
    await assert.rejects(
      download.downloadToFile({ url: `${base}/big.exe`, destinationPath: path.join(dir, "big.exe"), maxBytes: 4000 }),
      (error) => error.code === "too-large",
    );
    assert.deepEqual(leftovers(dir), [], "nothing written");
    assert.ok(bytesSent <= 1000);
  } finally {
    await stop(server);
  }
});

test("a body without a size that grows past the cap is cancelled and its partial file removed", async () => {
  const { server, base } = await serve((req, res) => {
    res.writeHead(200, { "content-type": "application/octet-stream" }); // chunked, no content-length
    const timer = setInterval(() => res.write(Buffer.alloc(1024, 1)), 2);
    res.on("close", () => clearInterval(timer));
  });
  try {
    const dir = tempDir();
    await assert.rejects(
      download.downloadToFile({ url: `${base}/endless.exe`, destinationPath: path.join(dir, "endless.exe"), maxBytes: 16 * 1024 }),
      (error) => error.code === "too-large",
    );
    assert.deepEqual(leftovers(dir), [], "partial file removed");
  } finally {
    await stop(server);
  }
});

test("a download that stops receiving bytes is aborted after the stall timeout and cleaned up", async () => {
  const { server, base } = await serve((req, res) => {
    res.writeHead(200, { "content-length": 10000 });
    res.write(Buffer.alloc(2000, 3)); // then silence
  });
  try {
    const dir = tempDir();
    const started = Date.now();
    await assert.rejects(
      download.downloadToFile({ url: `${base}/stall.exe`, destinationPath: path.join(dir, "stall.exe"), stallTimeoutMs: 300 }),
      (error) => error.code === "stalled",
    );
    const elapsed = Date.now() - started;
    assert.ok(elapsed >= 250 && elapsed < 5000, `aborted after about the stall timeout (${elapsed}ms)`);
    assert.deepEqual(leftovers(dir), []);
  } finally {
    await stop(server);
  }
});

test("a slow trickle that keeps sending bytes is not treated as stalled", async () => {
  const { server, base } = await serve((req, res) => {
    res.writeHead(200, { "content-length": 10 });
    let sent = 0;
    const timer = setInterval(() => {
      res.write(Buffer.from([sent]));
      sent += 1;
      if (sent === 10) {
        clearInterval(timer);
        res.end();
      }
    }, 60);
  });
  try {
    const dir = tempDir();
    const result = await download.downloadToFile({ url: `${base}/slow.exe`, destinationPath: path.join(dir, "slow.exe"), stallTimeoutMs: 400 });
    assert.equal(result.bytes, 10);
  } finally {
    await stop(server);
  }
});

test("a server that never answers is given up on", async () => {
  const { server, base } = await serve(() => {
    // Never responds.
  });
  try {
    const dir = tempDir();
    await assert.rejects(
      download.downloadToFile({ url: `${base}/silent.exe`, destinationPath: path.join(dir, "silent.exe"), responseTimeoutMs: 300 }),
      (error) => error.code === "no-response",
    );
    assert.deepEqual(leftovers(dir), []);
  } finally {
    await stop(server);
  }
});

test("a connection that ends before the announced size is refused and cleaned up", async () => {
  const { server, base } = await serve((req, res) => {
    res.writeHead(200, { "content-length": 4000 });
    res.write(Buffer.alloc(1000, 9), () => res.socket.destroy());
  });
  try {
    const dir = tempDir();
    await assert.rejects(
      download.downloadToFile({ url: `${base}/cut.exe`, destinationPath: path.join(dir, "cut.exe") }),
      (error) => error.code === "incomplete" || error.code === "failed",
    );
    assert.deepEqual(leftovers(dir), []);
  } finally {
    await stop(server);
  }
});

test("an error status is refused without writing anything", async () => {
  const { server, base } = await serve((req, res) => {
    res.writeHead(404);
    res.end("missing");
  });
  try {
    const dir = tempDir();
    await assert.rejects(download.downloadToFile({ url: `${base}/missing.exe`, destinationPath: path.join(dir, "missing.exe") }), (error) => error.code === "http-status");
    assert.deepEqual(leftovers(dir), []);
  } finally {
    await stop(server);
  }
});

test("partial files from an earlier run are removed; finished installers are kept", () => {
  const dir = tempDir();
  fs.writeFileSync(path.join(dir, "Setup 1.0.17.exe.download"), "partial");
  fs.writeFileSync(path.join(dir, "Setup 1.0.16.exe"), "done");
  assert.equal(download.removeStalePartialDownloads(dir), 1);
  assert.deepEqual(leftovers(dir), ["Setup 1.0.16.exe"]);
  assert.equal(download.removeStalePartialDownloads(path.join(dir, "missing")), 0);
});

test("the packaged app downloads over https only", () => {
  assert.equal(download.isAcceptableDownloadUrl("https://trhpruductions.github.io/-NEXUSFORGE/Setup.exe", { isPackaged: true }), true);
  assert.equal(download.isAcceptableDownloadUrl("http://example.com/Setup.exe", { isPackaged: true }), false);
  assert.equal(download.isAcceptableDownloadUrl("http://127.0.0.2:3310/Setup.exe", { isPackaged: false }), true);
  assert.equal(download.isAcceptableDownloadUrl("file:///C:/Setup.exe", { isPackaged: false }), false);
  assert.equal(download.isAcceptableDownloadUrl("not a url", { isPackaged: false }), false);
});

test("announced sizes are read strictly", () => {
  assert.equal(download.parseContentLength("1234"), 1234);
  assert.equal(download.parseContentLength(" 0 "), 0);
  for (const value of [null, undefined, "", "-1", "12abc", "1e9", "99999999999999999"]) {
    assert.equal(download.parseContentLength(value), null, String(value));
  }
  assert.equal(download.MAX_INSTALLER_BYTES, 300 * 1024 * 1024);
  assert.equal(download.STALL_TIMEOUT_MS, 60 * 1000);
});
