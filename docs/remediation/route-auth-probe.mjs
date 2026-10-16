// Probes every API route WITHOUT credentials and reports which ones answer as if they were open.
// Read-only against the source tree. Requests go only to the base URL given on the command line,
// which must be the TEST API (nexusforge_test), never production.
//
// Usage: node route-auth-probe.mjs <repo-root> <base-url>
import fs from "node:fs";
import path from "node:path";

const [repoRoot, baseUrl] = process.argv.slice(2);
if (!repoRoot || !baseUrl) throw new Error("usage: node route-auth-probe.mjs <repo-root> <base-url>");
if (/:4001\b|nfgcord\.com/.test(baseUrl)) throw new Error("refusing to probe production");

const serverSrc = path.join(repoRoot, "apps", "server", "src");
const indexSrc = fs.readFileSync(path.join(serverSrc, "index.ts"), "utf8");

// routerVar -> route file, from the imports in index.ts
const routerFile = new Map();
for (const m of indexSrc.matchAll(/import\s*\{\s*(\w+)\s*\}\s*from\s*"\.\/routes\/([^"]+)\.js"/g)) routerFile.set(m[1], m[2]);

// Mounts: prefix, middleware names, router variable
const mounts = [];
for (const m of indexSrc.matchAll(/app\.use\(\s*"(\/api[^"]*)"\s*,([^;]*?)\)\s*;/g)) {
  const args = m[2].split(",").map((s) => s.trim()).filter(Boolean);
  const routerVar = args.pop();
  mounts.push({ prefix: m[1], middleware: args, routerVar });
}

const METHODS = ["get", "post", "put", "patch", "delete"];
const UUID = "00000000-0000-4000-8000-000000000000";
const routes = [];

for (const mount of mounts) {
  const file = routerFile.get(mount.routerVar);
  if (!file) continue;
  const src = fs.readFileSync(path.join(serverSrc, "routes", `${file}.js`.replace(/\.js$/, ".ts")), "utf8");
  const routerWideAuth = new RegExp(`${mount.routerVar}\\.use\\(\\s*requireAuth`).test(src) || /\.use\(\s*requireAuth/.test(src);
  const re = new RegExp(`${mount.routerVar}\\.(${METHODS.join("|")})\\(\\s*"([^"]*)"`, "g");
  for (const m of src.matchAll(re)) {
    const full = `${mount.prefix}${m[2] === "/" ? "" : m[2]}`;
    const mountAuth = mount.middleware.some((name) => /requireAuth/.test(name));
    routes.push({ method: m[1].toUpperCase(), path: full, file, mountAuth, routerWideAuth });
  }
}

const results = [];
for (const route of routes) {
  const url = baseUrl.replace(/\/$/, "") + route.path.replace(/:[A-Za-z_]+/g, UUID);
  const init = { method: route.method, headers: {}, signal: AbortSignal.timeout(15000) };
  if (route.method !== "GET" && route.method !== "DELETE") {
    init.headers["content-type"] = "application/json";
    init.body = "{}";
  }
  let status;
  try {
    const res = await fetch(url, init);
    status = res.status;
  } catch (error) {
    status = `error:${error.cause?.code ?? error.name}`;
  }
  results.push({ ...route, url: route.path, status });
}

// Classification: 401/403 = refused without a session (good). 2xx = answered as open (needs a look).
const open = results.filter((r) => typeof r.status === "number" && r.status >= 200 && r.status < 300);
const refused = results.filter((r) => r.status === 401 || r.status === 403);
const other = results.filter((r) => !open.includes(r) && !refused.includes(r));

fs.writeFileSync(path.join(repoRoot, "docs", "remediation", "route-auth-probe-results.json"), JSON.stringify(results, null, 2));
console.log(`routes probed: ${results.length}`);
console.log(`refused without credentials (401/403): ${refused.length}`);
console.log(`answered as open (2xx): ${open.length}`);
for (const r of open) console.log(`  OPEN  ${r.method} ${r.url}  [${r.file}] mountAuth=${r.mountAuth} routerAuth=${r.routerWideAuth} -> ${r.status}`);
console.log(`other statuses: ${other.length}`);
const byStatus = {};
for (const r of other) byStatus[r.status] = (byStatus[r.status] ?? 0) + 1;
console.log(JSON.stringify(byStatus));
