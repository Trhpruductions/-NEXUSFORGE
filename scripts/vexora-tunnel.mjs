#!/usr/bin/env node
/**
 * Free Cloudflare "quick tunnel" to the gateway (scripts/vexora-gateway.mjs, port 3400).
 *
 * Starts cloudflared, waits for its https://<random>.trycloudflare.com address, then:
 *  - saves it to var/public-url.txt (shown to you),
 *  - sets APP_WEB_URL (email links, sign-in, Stripe return pages, allowed origin) and
 *    API_PUBLIC_URL (upload and webhook links) in apps/server/.env,
 *  - rewrites saved links from the old address (scripts/rehome-urls.mjs), so files
 *    uploaded before an address change keep working,
 *  - restarts the API so it picks them up.
 *
 * Quick tunnels need no Cloudflare account, but the address changes whenever this restarts.
 * With your own domain, swap this for a named tunnel and the address stays fixed.
 */
import fs from "node:fs";
import path from "node:path";
import { spawn, execFile } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envPath = path.join(root, "apps/server/.env");
const urlFile = path.join(root, "var/public-url.txt");
const exe = process.env.CLOUDFLARED_PATH || "C:\\Program Files (x86)\\cloudflared\\cloudflared.exe";
const gateway = `http://127.0.0.1:${process.env.GATEWAY_PORT || 3400}`;
const backendApp = process.env.BACKEND_PM2_NAME || "nexusforge-backend-workspace";

function readEnv(name) {
  const match = fs.readFileSync(envPath, "utf8").match(new RegExp(`^${name}=(.*)$`, "m"));
  return match ? match[1].trim() : "";
}

function setEnv(values) {
  let text = fs.readFileSync(envPath, "utf8");
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  for (const [name, value] of Object.entries(values)) {
    const line = `${name}=${value}`;
    const pattern = new RegExp(`^${name}=.*$`, "m");
    text = pattern.test(text) ? text.replace(pattern, line) : `${text.replace(/\s*$/, "")}${eol}${line}${eol}`;
  }
  fs.writeFileSync(envPath, text);
}

let announced = null;
const child = spawn(exe, ["tunnel", "--no-autoupdate", "--url", gateway], { windowsHide: true });

const onOutput = (chunk) => {
  const text = chunk.toString();
  process.stdout.write(text);
  const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (!match || match[0] === announced) return;
  announced = match[0];
  fs.mkdirSync(path.dirname(urlFile), { recursive: true });
  fs.writeFileSync(urlFile, `${announced}\n`);
  const previous = readEnv("API_PUBLIC_URL") || "http://127.0.0.1:4001";
  setEnv({ APP_WEB_URL: announced, API_PUBLIC_URL: announced });
  console.log(`\n[tunnel] Vexora is public at ${announced}\n[tunnel] restarting the API so links and sign-in use it...`);
  // Files uploaded under the old address keep working at the new one.
  execFile(process.execPath, [path.join(root, "scripts/rehome-urls.mjs"), previous, announced], { windowsHide: true }, (error, stdout) => {
    process.stdout.write(stdout || "");
    if (error) console.log(`[tunnel] couldn't update old upload links: ${error.message}`);
  });
  // Give the tunnel a moment to finish registering before the API restarts.
  setTimeout(() => {
    // Processes started by pm2 don't always have npm's folder on PATH, so use pm2's full path.
    const pm2 = process.env.PM2_CMD || (process.env.APPDATA ? `"${path.join(process.env.APPDATA, "npm", "pm2.cmd")}"` : "pm2");
    execFile(pm2, ["restart", backendApp, "--update-env"], { shell: true, windowsHide: true }, (error) => {
      console.log(error ? `[tunnel] couldn't restart the API: ${error.message}` : "[tunnel] API restarted.");
    });
  }, 3000);
};
child.stdout.on("data", onOutput);
child.stderr.on("data", onOutput);
child.on("exit", (code) => {
  console.log(`[tunnel] cloudflared stopped (${code}).`);
  process.exit(code ?? 1);
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => child.kill());
