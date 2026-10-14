// GLB exporter: serves the export page and three.js, transpiles the app's model code on the fly,
// saves the GLB the page posts back, and drives Chrome. Usage: node serve-export.mjs <outDir> <file.glb>
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
const MODEL_SRC = path.resolve(PROJECT, "apps/web/src/components/avatar3d/base-model.ts");
const OUT_DIR = process.argv[2];
const FILE = process.argv[3] || "base-athletic.glb";
const CHROME = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const PORT = 5299;
const CDP_PORT = 9400 + Math.floor(Math.random() * 300);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(OUT_DIR, { recursive: true });

const transpile = (file) => ts.transpileModule(fs.readFileSync(file, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  fileName: file,
}).outputText;
const PAGE = `<!doctype html><html><head><meta charset="utf-8"><title>export</title>
<script type="importmap">{"imports":{"three":"/three/build/three.module.js","three/addons/":"/three/examples/jsm/"}}</script>
</head><body><script type="module" src="/export-entry.js"></script></body></html>`;
const types = { ".js": "text/javascript", ".json": "application/json", ".html": "text/html" };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (url.pathname === "/") { res.writeHead(200, { "Content-Type": "text/html" }); return res.end(PAGE); }
  if (url.pathname === "/export-entry.js") { res.writeHead(200, { "Content-Type": "text/javascript" }); return res.end(transpile(path.join(HERE, "export-entry.ts"))); }
  if (url.pathname === "/base-model.js") { res.writeHead(200, { "Content-Type": "text/javascript" }); return res.end(transpile(MODEL_SRC)); }
  if (url.pathname.startsWith("/three/")) {
    const file = path.resolve(THREE_DIR, decodeURIComponent(url.pathname.slice("/three/".length)));
    if (!file.startsWith(THREE_DIR) || !fs.existsSync(file)) { res.writeHead(404); return res.end("missing"); }
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
    return res.end(fs.readFileSync(file));
  }
  if (url.pathname === "/save") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const name = path.basename(url.searchParams.get("name") || "out.glb");
      fs.writeFileSync(path.join(OUT_DIR, name), Buffer.from(body, "base64"));
      console.log("saved", name);
      res.writeHead(200); res.end("ok");
    });
    return;
  }
  res.writeHead(404); res.end("not found");
});

server.listen(PORT, "127.0.0.1", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vx-export-"));
  const proc = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${dir}`, "--no-first-run", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "about:blank"], { stdio: "ignore" });
  let target;
  for (let i = 0; i < 60 && !target; i++) { await sleep(250); try { target = (await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json()).find((t) => t.type === "page"); } catch {} }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener("open", r, { once: true }));
  let id = 0; const pending = new Map();
  ws.addEventListener("message", (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    if (msg.method === "Runtime.exceptionThrown") console.log("PAGE ERROR", (msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text || "").slice(0, 300));
  });
  const send = (method, params = {}) => new Promise((r) => { const n = ++id; pending.set(n, r); ws.send(JSON.stringify({ id: n, method, params })); });
  const evaluate = async (expr) => (await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
  await send("Page.enable"); await send("Runtime.enable");
  const started = Date.now();
  await send("Page.navigate", { url: `http://127.0.0.1:${PORT}/?name=${encodeURIComponent(FILE)}` });
  let done = false;
  while (!done && Date.now() - started < 120000) { await sleep(500); done = Boolean(await evaluate("window.__done === true")); }
  const error = await evaluate("window.__error || null");
  console.log(done ? `exported ${FILE} in ${Math.round((Date.now() - started) / 1000)}s` : "TIMED OUT", error ? `ERROR ${error}` : "");
  try { ws.close(); } catch {}
  proc.kill(); server.close(); process.exit(0);
});
