// Nexus Forge Owner Console, desktop window for this PC only.
// It starts the console server (loopback only, token protected), opens the console in its own window,
// and stops the server when the window closes. The access link is read from the server's output in
// memory and is never written to disk or shown outside the window.
const { app, BrowserWindow, dialog, Menu } = require("electron");
const { spawn, execFile } = require("node:child_process");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const CONSOLE_DIR = path.resolve(__dirname, "..");
const PID_FILE = path.join(__dirname, "console-server.pid");
const ICON = path.resolve(__dirname, "..", "..", "..", "apps", "desktop", "assets", "app-icon.ico");
const LINK = /(http:\/\/127\.0\.0\.1:\d+\/\?token=[A-Za-z0-9_-]+)/;
const START_TIMEOUT_MS = 20000;

let server = null;
let win = null;
let stopping = false;

app.setName("Nexus Forge Owner Console");
app.setAppUserModelId("com.nexusforge.owner-console");

// ---- Helpers. Everything from here to startServer is kept together so the tests can load it. ----

// The address of the running console, with its token. Held in memory only; it is used to ask for active jobs.
let consoleUrl = "";
const PM2_WAIT_MS = 30000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function runPowerShell(script) {
  return new Promise((resolve) => {
    execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", script], { windowsHide: true, timeout: 15000 }, (error, stdout) => {
      resolve(error ? null : String(stdout));
    });
  });
}

// Read only. The pm2 clients this server has started right now; null when the check itself fails.
async function pm2ChildrenOf(pid) {
  const out = await runPowerShell(`Get-CimInstance Win32_Process -Filter 'ParentProcessId=${Number(pid)}' | Where-Object { $_.CommandLine -match 'pm2' } | ForEach-Object { $_.ProcessId }`);
  if (out === null) return null;
  return out.split(/\s+/).filter(Boolean);
}

// Read only. Who a process id belongs to right now. Windows reuses ids, so this is checked again before every kill.
//   match     this app's console server: same Electron binary, running server.js with --no-open
//   mismatch  the process exists but is something else
//   gone      no such process
//   unknown   the check itself failed
async function identityOf(pid) {
  const out = await runPowerShell(
    `$p = Get-CimInstance Win32_Process -Filter 'ProcessId=${Number(pid)}'; if ($p) { $p.ExecutablePath; $p.CommandLine } else { 'GONE' }`,
  );
  if (out === null) return "unknown";
  const lines = out.split(/\r?\n/).map((line) => line.trim());
  if (lines[0] === "GONE" || lines.every((line) => line === "")) return "gone";
  const [exe = "", cmd = ""] = lines;
  const ours = exe.toLowerCase() === process.execPath.toLowerCase() && /server\.js/.test(cmd) && /--no-open/.test(cmd);
  return ours ? "match" : "mismatch";
}

function killProcess(pid, { tree }) {
  return new Promise((resolve) => {
    const args = ["/PID", String(pid), "/F"];
    if (tree) args.push("/T");
    execFile("taskkill", args, { windowsHide: true }, () => resolve());
  });
}

// Read only. Jobs the console is running (queued, running, or stuck). null when the console cannot be asked.
function activeJobCount() {
  if (!consoleUrl) return Promise.resolve(null);
  const token = new URL(consoleUrl).searchParams.get("token");
  if (!token) return Promise.resolve(null);
  return new Promise((resolve) => {
    const req = http.get(new URL("/api/jobs", consoleUrl), { headers: { authorization: `Bearer ${token}` }, timeout: 4000 }, (res) => {
      let body = "";
      res.setEncoding("utf8");
      res.on("data", (chunk) => {
        if (body.length < 1000000) body += chunk;
      });
      res.on("end", () => {
        if (res.statusCode !== 200) return resolve(null);
        try {
          const jobs = JSON.parse(body).jobs || [];
          resolve(jobs.filter((job) => job.state === "queued" || job.state === "running" || job.state === "stuck").length);
        } catch {
          resolve(null);
        }
      });
    });
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve(null));
  });
}

async function busyState(pid) {
  const children = await pm2ChildrenOf(pid);
  const jobs = await activeJobCount();
  const pm2 = children ? children.length : 0;
  return { unknown: children === null || jobs === null, pm2, jobs: jobs || 0, count: pm2 + (jobs || 0) };
}

function askToCloseAnyway(busy) {
  const parts = [];
  if (busy.pm2) parts.push(`${busy.pm2} pm2 command(s) still running`);
  if (busy.jobs) parts.push(`${busy.jobs} build, check or schema job(s) still running`);
  const what = parts.length ? parts.join(" and ") : "the console could not confirm whether anything is still running";
  return dialog
    .showMessageBox({
      type: "warning",
      buttons: ["Keep waiting", "Close anyway"],
      defaultId: 0,
      cancelId: 0,
      title: "Owner console",
      message: "Work is still running in the owner console.",
      detail: `${what.charAt(0).toUpperCase()}${what.slice(1)}. Closing now stops it partway through, and a build or schema job can leave files half written. Keep waiting, or close anyway?`,
    })
    .then((result) => result.response === 1);
}

// Stops the console server and returns what happened: "stopped", "gone", "mismatch", or "unknown".
// Nothing is terminated unless the identity is confirmed as this app's server, immediately before the kill.
// Before the server is stopped, any pm2 command or job it is running is waited for, up to PM2_WAIT_MS. After that,
// the owner decides: keep waiting, or close anyway.
async function stopServer(pid, askAnyway) {
  let identity = await identityOf(pid);
  if (identity !== "match") return identity;
  for (;;) {
    const deadline = Date.now() + PM2_WAIT_MS;
    let busy = await busyState(pid);
    while ((busy.unknown || busy.count > 0) && Date.now() < deadline) {
      await sleep(2000);
      busy = await busyState(pid);
    }
    if (!busy.unknown && busy.count === 0) break;
    if (await askAnyway(busy)) break;
    identity = await identityOf(pid);
    if (identity !== "match") return identity;
  }
  // Checked once more, right before the kill: the server may have exited and its id been reused during the wait.
  identity = await identityOf(pid);
  if (identity !== "match") return identity;
  await killProcess(pid, { tree: true });
  return "stopped";
}

// A server left running by an earlier launch is handled before a new one starts. Its record is kept unless it is
// stopped or proven gone. If its identity cannot be verified, startup is refused rather than starting a second copy.
async function stopLeftoverServer() {
  let pid = 0;
  try {
    pid = Number(fs.readFileSync(PID_FILE, "utf8").trim());
  } catch {
    return "clear";
  }
  if (!(pid > 0)) {
    removePidFile();
    return "clear";
  }
  const identity = await identityOf(pid);
  if (identity === "gone" || identity === "mismatch") {
    removePidFile();
    return "clear";
  }
  if (identity === "unknown") return "blocked";
  const result = await stopServer(pid, askToCloseAnyway);
  if (result === "stopped" || result === "gone") {
    removePidFile();
    return "clear";
  }
  return result === "mismatch" ? "clear" : "blocked";
}

function removePidFile() {
  try {
    fs.unlinkSync(PID_FILE);
  } catch {
    /* already gone */
  }
}

// ---- Startup, window, and shutdown. ----

function startServer() {
  return new Promise((resolve, reject) => {
    // ELECTRON_RUN_AS_NODE lets this Electron binary run the console's plain Node server, so no separate Node install is needed.
    const child = spawn(process.execPath, ["server.js", "--no-open"], {
      cwd: CONSOLE_DIR,
      windowsHide: true,
      env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    server = child;
    fs.writeFileSync(PID_FILE, String(child.pid));

    let buffer = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error("The owner console did not start within 20 seconds."));
      }
    }, START_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      if (settled) return;
      buffer += chunk.toString("utf8");
      const match = buffer.match(LINK);
      if (match) {
        settled = true;
        clearTimeout(timer);
        consoleUrl = match[1];
        resolve(match[1]);
      }
    });
    child.stderr.resume();

    child.on("exit", () => {
      server = null;
      consoleUrl = "";
      removePidFile();
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        reject(new Error("The owner console stopped before it could open. Check that the console files are in place."));
      } else if (!stopping) {
        dialog.showErrorBox("Owner console", "The console server stopped unexpectedly. Open the app again to restart it.");
        shutdown();
      }
    });
  });
}

function openWindow(url) {
  win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 980,
    minHeight: 620,
    backgroundColor: "#070a10",
    title: "Nexus Forge Owner Console",
    icon: ICON,
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  const origin = new URL(url).origin;
  win.setMenuBarVisibility(false);
  win.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  win.webContents.on("will-navigate", (event, target) => {
    if (!target.startsWith(origin + "/")) event.preventDefault();
  });
  win.on("closed", () => {
    win = null;
    shutdown();
  });
  win.loadURL(url);
}

// Every way out goes through here: closing the window, quitting, a failed start, or a server that stops on its own.
// The PID record is removed only when the server is confirmed stopped or gone. Otherwise it is kept, so the next launch
// can check again rather than losing track of a server that may still be running.
async function shutdown() {
  if (stopping) return;
  stopping = true;
  let result = "gone";
  if (server && server.pid) result = await stopServer(server.pid, askToCloseAnyway);
  if (result === "stopped" || result === "gone") removePidFile();
  consoleUrl = "";
  app.quit();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  // Quitting from the menu, the tray, or the system (logoff, shutdown) also waits for busy work and records the outcome.
  app.on("before-quit", (event) => {
    if (stopping) return;
    event.preventDefault();
    shutdown();
  });

  app.whenReady().then(async () => {
    Menu.setApplicationMenu(null);
    try {
      const leftover = await stopLeftoverServer();
      if (leftover === "blocked") {
        dialog.showErrorBox(
          "Owner console",
          "Another owner console may still be running, and it could not be verified. It was not stopped, and a second copy was not started.",
        );
        stopping = true;
        app.quit();
        return;
      }
      const url = await startServer();
      openWindow(url);
    } catch (error) {
      dialog.showErrorBox("Owner console", error.message);
      shutdown();
    }
  });

  app.on("window-all-closed", () => {
    shutdown();
  });
}
