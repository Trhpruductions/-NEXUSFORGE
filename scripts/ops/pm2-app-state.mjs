// Prints one word for the logon script: the state of a pm2 app (see scripts/lib/pm2-state.mjs), or
// "unreadable" when `pm2 jlist` gave no list after several tries. Right after a reboot pm2 can be slow or busy
// (Postgres crash recovery, every bot starting), and one failed read used to make the logon script skip every app.
//   node scripts/ops/pm2-app-state.mjs <app-name> [tries] [seconds-between]
import { execSync } from "node:child_process";
import { appState, parseJlist } from "../lib/pm2-state.mjs";

const [name, triesArg = "6", pauseArg = "15"] = process.argv.slice(2);
if (!name) {
  console.error("usage: node scripts/ops/pm2-app-state.mjs <app-name> [tries] [seconds-between]");
  process.exit(2);
}
const tries = Math.max(1, Number(triesArg) || 6);
const pauseMs = Math.max(0, Number(pauseArg) || 0) * 1000;

let lastProblem = "";
for (let attempt = 1; attempt <= tries; attempt += 1) {
  try {
    const list = parseJlist(execSync("pm2 jlist", { encoding: "utf8", timeout: 60_000, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] }));
    if (list) {
      console.log(appState(list, name));
      process.exit(0);
    }
    lastProblem = "no process list in the output";
  } catch (error) {
    lastProblem = String(error?.message ?? error).split(/\r?\n/)[0].slice(0, 120);
  }
  if (attempt < tries) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, pauseMs);
}
console.error(`pm2 jlist unreadable after ${tries} tries: ${lastProblem}`);
console.log("unreadable");
