"use strict";

// Tests the desktop wrapper's stop logic. The helpers are loaded from desktop/main.js by text, so the real code runs
// without starting Electron. Every process here is a harmless node process started by the test itself.

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const { spawn, execFile } = require("node:child_process");

const MAIN = path.join(__dirname, "..", "desktop", "main.js");

function loadHelpers({ pidFile, dialog, execPath = process.execPath }) {
  const src = fs.readFileSync(MAIN, "utf8");
  const start = src.indexOf("// ---- Helpers.");
  const end = src.indexOf("// ---- Startup");
  const body = src.slice(start, end).replace("const PM2_WAIT_MS = 30000;", "const PM2_WAIT_MS = 3000;");
  const factory = new Function(
    "execFile",
    "http",
    "fs",
    "PID_FILE",
    "dialog",
    "process",
    `${body}\nreturn { identityOf, stopServer, stopLeftoverServer, activeJobCount, busyState, removePidFile, setConsoleUrl: (u) => { consoleUrl = u; } };`,
  );
  return factory(execFile, http, fs, pidFile, dialog, { execPath });
}

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// A stand-in for the console server: a node process whose command line names server.js and --no-open.
function fakeServer() {
  return spawn(process.execPath, ["-e", "setTimeout(()=>{},60000)", "server.js", "--no-open"], { stdio: "ignore", windowsHide: true });
}
// A process that is not the console server.
function fakeOther() {
  return spawn(process.execPath, ["-e", "setTimeout(()=>{},60000)", "something-else.js"], { stdio: "ignore", windowsHide: true });
}
// A stand-in for a pm2 client: a child of the server whose command line contains "pm2".
function spawnPm2ChildOf(parentCode) {
  return spawn(process.execPath, ["-e", `require('node:child_process').spawn(process.execPath,['-e','setTimeout(()=>{},60000)','pm2-child-test'],{stdio:'ignore'}); ${parentCode}`], {
    stdio: "ignore",
    windowsHide: true,
  });
}

function tempPidFile() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), "console-pid-")), "console-server.pid");
}

function fakeConsoleJobs(jobs, token = "test-token") {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      if (req.url === "/api/jobs" && req.headers.authorization === `Bearer ${token}`) {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify({ jobs }));
      } else {
        res.writeHead(401);
        res.end("{}");
      }
    });
    server.listen(0, "127.0.0.1", () => resolve({ server, url: `http://127.0.0.1:${server.address().port}/?token=${token}` }));
  });
}

test("identity: a console-looking server matches, anything else does not", async () => {
  const h = loadHelpers({ pidFile: tempPidFile(), dialog: null });
  const good = fakeServer();
  const other = fakeOther();
  await sleep(1200);
  try {
    assert.equal(await h.identityOf(good.pid), "match");
    assert.equal(await h.identityOf(other.pid), "mismatch");
  } finally {
    good.kill();
    other.kill();
  }
});

test("identity: a process that has exited is reported as gone", async () => {
  const h = loadHelpers({ pidFile: tempPidFile(), dialog: null });
  const quick = spawn(process.execPath, ["-e", "0"], { stdio: "ignore", windowsHide: true });
  await new Promise((resolve) => quick.on("exit", resolve));
  assert.equal(await h.identityOf(quick.pid), "gone");
});

test("stop: a server with no busy work is stopped, and only after identity is confirmed", async () => {
  let asked = 0;
  const { server, url } = await fakeConsoleJobs([]);
  try {
    const h = loadHelpers({ pidFile: tempPidFile(), dialog: null });
    h.setConsoleUrl(url);
    const srv = fakeServer();
    await sleep(1200);
    const result = await h.stopServer(srv.pid, async () => {
      asked += 1;
      return true;
    });
    await sleep(500);
    assert.equal(result, "stopped");
    assert.equal(asked, 0, "nothing running means no question");
    assert.equal(alive(srv.pid), false);
  } finally {
    server.close();
  }
});

test("stop: a process that is not the console is never killed", async () => {
  const h = loadHelpers({ pidFile: tempPidFile(), dialog: null });
  const other = fakeOther();
  await sleep(1200);
  try {
    const result = await h.stopServer(other.pid, async () => true);
    assert.equal(result, "mismatch");
    assert.equal(alive(other.pid), true);
  } finally {
    other.kill();
  }
});

test("stop: a running pm2 client is waited for, then the owner is asked, then close-anyway stops everything", async () => {
  const questions = [];
  const { server, url } = await fakeConsoleJobs([]);
  try {
    const h = loadHelpers({ pidFile: tempPidFile(), dialog: null });
    h.setConsoleUrl(url);
    const srv = spawn(process.execPath, ["-e", "require('node:child_process').spawn(process.execPath,['-e','setTimeout(()=>{},60000)','pm2-child-test'],{stdio:'ignore'}); setTimeout(()=>{},60000)", "server.js", "--no-open"], {
      stdio: "ignore",
      windowsHide: true,
    });
    await sleep(1500);
    const result = await h.stopServer(srv.pid, async (busy) => {
      questions.push(busy);
      return questions.length === 2; // keep waiting once, then close anyway
    });
    await sleep(500);
    assert.equal(result, "stopped");
    assert.equal(questions.length, 2);
    assert.equal(questions[0].pm2, 1);
    assert.equal(alive(srv.pid), false);
  } finally {
    server.close();
  }
});

test("stop: active console jobs count as busy work", async () => {
  const { server, url } = await fakeConsoleJobs([
    { id: "a", state: "running" },
    { id: "b", state: "stuck" },
    { id: "c", state: "passed" },
  ]);
  try {
    const h = loadHelpers({ pidFile: tempPidFile(), dialog: null });
    h.setConsoleUrl(url);
    assert.equal(await h.activeJobCount(), 2);
    const srv = fakeServer();
    await sleep(1200);
    const seen = [];
    const result = await h.stopServer(srv.pid, async (busy) => {
      seen.push(busy);
      return true;
    });
    await sleep(500);
    assert.equal(result, "stopped");
    assert.equal(seen[0].jobs, 2);
    assert.equal(alive(srv.pid), false);
  } finally {
    server.close();
  }
});

test("stop: a console that refuses the token gives an unknown count, which asks the owner", async () => {
  const { server, url } = await fakeConsoleJobs([], "the-right-token");
  try {
    const h = loadHelpers({ pidFile: tempPidFile(), dialog: null });
    h.setConsoleUrl(url.replace("the-right-token", "wrong-token"));
    assert.equal(await h.activeJobCount(), null);
    const state = await h.busyState(process.pid);
    assert.equal(state.unknown, true);
  } finally {
    server.close();
  }
});

test("leftover: a recorded id that now belongs to another process is dropped, and that process is left alone", async () => {
  const pidFile = tempPidFile();
  const other = fakeOther();
  await sleep(1200);
  try {
    fs.writeFileSync(pidFile, String(other.pid));
    const h = loadHelpers({ pidFile, dialog: null });
    assert.equal(await h.stopLeftoverServer(), "clear");
    assert.equal(fs.existsSync(pidFile), false);
    assert.equal(alive(other.pid), true);
  } finally {
    other.kill();
  }
});

test("leftover: a recorded id of a console server is stopped and its record removed", async () => {
  const pidFile = tempPidFile();
  const srv = fakeServer();
  await sleep(1200);
  fs.writeFileSync(pidFile, String(srv.pid));
  const h = loadHelpers({ pidFile, dialog: { showMessageBox: async () => ({ response: 1 }) } });
  assert.equal(await h.stopLeftoverServer(), "clear");
  await sleep(500);
  assert.equal(alive(srv.pid), false);
  assert.equal(fs.existsSync(pidFile), false);
});

test("leftover: a record whose process is gone is removed", async () => {
  const pidFile = tempPidFile();
  const quick = spawn(process.execPath, ["-e", "0"], { stdio: "ignore", windowsHide: true });
  await new Promise((resolve) => quick.on("exit", resolve));
  fs.writeFileSync(pidFile, String(quick.pid));
  const h = loadHelpers({ pidFile, dialog: null });
  assert.equal(await h.stopLeftoverServer(), "clear");
  assert.equal(fs.existsSync(pidFile), false);
});

test("leftover: an empty or non-numeric record is removed without touching anything", async () => {
  const pidFile = tempPidFile();
  fs.writeFileSync(pidFile, "not-a-pid");
  const h = loadHelpers({ pidFile, dialog: null });
  assert.equal(await h.stopLeftoverServer(), "clear");
  assert.equal(fs.existsSync(pidFile), false);
});
