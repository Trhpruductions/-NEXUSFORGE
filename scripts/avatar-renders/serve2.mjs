// Render server: serves the render page, three.js and the shared character code (transpiled from
// TypeScript on the fly), saves each PNG the page posts back, and drives Chrome through the looks.
// Usage: node serve2.mjs <outDir> <look,look,...> [width] [height] [fileSuffix]
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createRequire } from "node:module";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("D:/NEXUSFORGE GAMGING APP/node_modules/typescript");
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = "D:/NEXUSFORGE GAMGING APP";
const THREE_DIR = path.resolve(PROJECT, "node_modules/three");
const SHARED = path.resolve(PROJECT, "apps/web/src/components/avatar/characters-3d.ts");
const OUT_DIR = process.argv[2];
const LOOKS = (process.argv[3] || "cyber").split(",");
const WIDTH = process.argv[4] || "900";
const HEIGHT = process.argv[5] || "1200";
const SUFFIX = process.argv[6] || "";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 5199;
const CDP_PORT = 9600 + Math.floor(Math.random() * 300);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT_DIR, { recursive: true });

const transpile = (file) => ts.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.None },
  fileName: file,
}).outputText;

const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>render</title>
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
</head><body style="margin:0;background:#060a12"><script type="module" src="/render-entry.js"></script></body></html>`;

const types = { ".js": "text/javascript", ".mjs": "text/javascript", ".json": "application/json", ".html": "text/html", ".wasm": "application/wasm" };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (url.pathname === "/" || url.pathname === "/render.html") {
    res.writeHead(200, { "Content-Type": "text/html" });
    return res.end(PAGE);
  }
  if (url.pathname === "/render-entry.js") {
    res.writeHead(200, { "Content-Type": "text/javascript" });
    return res.end(transpile(path.join(HERE, "render-entry.ts")));
  }
  if (url.pathname === "/characters-3d.js") {
    res.writeHead(200, { "Content-Type": "text/javascript" });
    return res.end(transpile(SHARED));
  }
  if (url.pathname.startsWith("/three/")) {
    const file = path.resolve(THREE_DIR, decodeURIComponent(url.pathname.slice("/three/".length)));
    if (!file.startsWith(THREE_DIR) || !fs.existsSync(file)) {
      res.writeHead(404);
      return res.end("missing");
    }
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
    return res.end(fs.readFileSync(file));
  }
  if (url.pathname === "/save") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const name = path.basename(url.searchParams.get("name") || "render.png");
      fs.writeFileSync(path.join(OUT_DIR, name), Buffer.from(body.replace(/^data:image\/png;base64,/, ""), "base64"));
      console.log("saved", name);
      res.writeHead(200);
      res.end("ok");
    });
    return;
  }
  res.writeHead(404);
  res.end("not found");
});

server.listen(PORT, "127.0.0.1", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vx-render-"));
  const proc = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${dir}`, "--no-first-run", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "about:blank"], { stdio: "ignore" });
  let target;
  for (let i = 0; i < 60 && !target; i++) {
    await sleep(250);
    try { target = (await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json()).find((t) => t.type === "page"); } catch {}
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.addEventListener("open", resolve, { once: true }));
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    if (msg.method === "Runtime.exceptionThrown") console.log("PAGE ERROR", (msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text || "").slice(0, 300));
  });
  const send = (method, params = {}) => new Promise((resolve) => { const n = ++id; pending.set(n, resolve); ws.send(JSON.stringify({ id: n, method, params })); });
  const evaluate = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
  await send("Page.enable");
  await send("Runtime.enable");
  for (const look of LOOKS) {
    const started = Date.now();
    const name = `${look}${SUFFIX}.png`;
    await send("Page.navigate", { url: `http://127.0.0.1:${PORT}/render.html?look=${look}&w=${WIDTH}&h=${HEIGHT}&name=${name}` });
    let done = false;
    while (!done && Date.now() - started < 300000) {
      await sleep(1000);
      done = Boolean(await evaluate("window.__done === true"));
    }
    console.log(look, done ? `done in ${Math.round((Date.now() - started) / 1000)}s` : "TIMED OUT");
  }
  try { ws.close(); } catch {}
  proc.kill();
  server.close();
  process.exit(0);
});
