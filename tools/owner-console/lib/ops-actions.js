"use strict";

// The only write actions the console can start: restarting one of five named pm2 apps, two builds, three checks,
// and a read-only schema diff. Each one becomes a job. The HTTP layer requires the owner's confirmation.
// pm2 is only ever called as `pm2 restart <name> --update-env`. Never save, delete, stop, kill or restart-all.

const fs = require("node:fs");
const path = require("node:path");
const { REPO_ROOT, PM2_ENTRY, DATA_DIR } = require("./config");
const { scrubText } = require("./secrets");
const { collectHealth } = require("./collectors/health");
const { collectPm2 } = require("./collectors/pm2");
const { classifySchemaSql } = require("./schema-status");
const { loadEnvFiles } = require("./envfiles");

const SERVER_ROOT = path.join(REPO_ROOT, "apps", "server");

const RESTART_APPS = [
  "nexusforge-backend-workspace",
  "nexusforge-web-workspace",
  "vexora-gateway",
  "vexora-tunnel",
  "vexora-watchdog",
];
const RESTART_WAIT_MS = 60 * 1000;
const RESTART_POLL_MS = 15 * 1000;
// A restart is flagged stuck after this long. It is never stopped by the console.
const RESTART_STUCK_MS = 3 * 60 * 1000;
// Only the restarted app's own HTTP targets are probed. Apps without one are judged by pm2 status alone.
const RESTART_HEALTH_KEYS = {
  "nexusforge-backend-workspace": ["backend", "backend-ready"],
  "nexusforge-web-workspace": ["web"],
  "vexora-gateway": ["gateway"],
};

const BUILDS = {
  web: {
    label: "Web app build",
    cmdLine: "npm run build -w web",
    // Removed from the child environment so a stray value cannot bake a wrong API address into the build.
    removeEnv: ["NEXT_PUBLIC_API_URL", "NEXT_PUBLIC_APP_URL"],
    cwd: REPO_ROOT,
  },
  backend: {
    label: "Backend build",
    cmdLine: "npm run build -w @nexusforge/server",
    removeEnv: [],
    cwd: REPO_ROOT,
  },
};

function serverTestFiles() {
  const dir = path.join(SERVER_ROOT, "tests");
  // The names become part of a cmd.exe command line, so only plain characters are allowed. Anything else is skipped.
  const emailFiles = fs
    .readdirSync(dir)
    .filter((name) => /^email-[A-Za-z0-9._-]+\.test\.ts$/.test(name))
    .sort()
    .map((name) => `tests/${name}`);
  return [...emailFiles, "tests/access-token.test.ts", "tests/forge-images.test.ts"];
}

function parseTsc(stdout) {
  const errors = (stdout.match(/error TS\d+/g) || []).length;
  return { errors };
}

function parseTap(stdout) {
  const count = (name) => {
    const match = stdout.match(new RegExp(`^(?:# |ℹ )${name}\\s+(\\d+)`, "m"));
    return match ? Number(match[1]) : null;
  };
  return { tests: count("tests"), pass: count("pass"), fail: count("fail") };
}

const CHECKS = {
  "tsc-web": {
    label: "TypeScript check, web app",
    cmdLine: "npx tsc --noEmit -p apps/web/tsconfig.json",
    cwd: REPO_ROOT,
    parse: parseTsc,
  },
  "tsc-server": {
    label: "TypeScript check, server",
    cmdLine: "npx tsc --noEmit",
    cwd: SERVER_ROOT,
    parse: parseTsc,
  },
  "tests-server": {
    label: "Server tests: email, access token, forge images",
    cmdLine: null,
    cwd: SERVER_ROOT,
    parse: parseTap,
  },
};

function checkCommand(id) {
  if (id !== "tests-server") return CHECKS[id].cmdLine;
  return `npx --yes tsx --test --test-force-exit ${serverTestFiles().join(" ")}`;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** What "healthy" means for each app after a restart. */
async function healthAfterRestart(name) {
  if (name === "nexusforge-backend-workspace" || name === "nexusforge-web-workspace" || name === "vexora-gateway") {
    const health = await collectHealth(RESTART_HEALTH_KEYS[name]);
    const find = (key) => health.items.find((item) => item.key === key);
    if (name === "nexusforge-backend-workspace") {
      const api = find("backend");
      const ready = find("backend-ready");
      return {
        ok: Boolean(api && api.ok && ready && ready.ok),
        text: `API ${api ? api.status ?? api.error : "?"}, API ready ${ready ? ready.status ?? ready.error : "?"}`,
      };
    }
    if (name === "nexusforge-web-workspace") {
      const web = find("web");
      return { ok: Boolean(web && web.ok), text: `web login page ${web ? web.status ?? web.error : "?"}` };
    }
    const gateway = find("gateway");
    return { ok: Boolean(gateway && gateway.ok), text: `gateway ${gateway ? gateway.status ?? gateway.error : "?"}` };
  }
  const pm2 = await collectPm2();
  const app = pm2.apps.find((candidate) => candidate.name === name);
  return { ok: Boolean(app && app.status === "online"), text: `pm2 status ${app ? app.status : "not found"}` };
}

function startRestart(runner, name) {
  if (!RESTART_APPS.includes(name)) throw new Error("that app cannot be restarted from the console");
  return runner.enqueue({
    kind: "restart",
    // Own lane: one pm2 write at a time, and a slow restart never holds up builds or checks.
    lane: "pm2",
    stuckAfterMs: RESTART_STUCK_MS,
    label: `Restart ${name}`,
    target: name,
    display: `pm2 restart ${name} --update-env`,
    run: async (ctx) => {
      const code = await ctx.exec({
        file: process.execPath,
        args: [PM2_ENTRY, "restart", name, "--update-env"],
        display: `pm2 restart ${name} --update-env`,
        // Past 3 minutes the job says so, but pm2 is never killed mid-call (see keepRunningOnTimeout in lib/jobs.js).
        timeoutMs: RESTART_STUCK_MS,
        keepRunningOnTimeout: true,
      });
      if (code.code !== 0) return { passed: false, code: code.code };
      if (ctx.dryRun) {
        ctx.log("DRY RUN: the restart was not run, so there is no health check to wait for.");
        return { passed: true, code: 0, summary: { dryRun: true } };
      }
      // pm2 reported the restart as done. Health is checked a few times, and a read that fails is reported as unknown.
      const deadline = Date.now() + RESTART_WAIT_MS;
      let last = null;
      do {
        await sleep(RESTART_POLL_MS);
        last = await healthAfterRestart(name).catch((error) => ({ ok: null, text: `could not read health (${scrubText(error && error.message ? error.message : "error")})` }));
        ctx.log(`Health: ${last.text} (${last.ok === true ? "ok" : last.ok === false ? "not yet" : "unknown"})`);
        if (last.ok === true) return { passed: true, code: 0, summary: { healthy: true, text: `restart completed; ${last.text}` } };
      } while (Date.now() < deadline);
      if (last && last.ok === false) {
        return { passed: false, code: 0, summary: { healthy: false, text: `restart completed; health check failed: ${last.text}` } };
      }
      return { passed: true, code: 0, summary: { healthy: null, text: "restart completed; health unknown" } };
    },
  });
}

function startBuild(runner, target) {
  const build = BUILDS[target];
  if (!build) throw new Error("unknown build");
  return runner.enqueue({
    kind: "build",
    label: build.label,
    target,
    display: build.cmdLine,
    run: async (ctx) => {
      const env = { ...process.env };
      for (const key of build.removeEnv) delete env[key];
      const result = await ctx.exec({ cmdLine: build.cmdLine, cwd: build.cwd, env, display: build.cmdLine, timeoutMs: 40 * 60 * 1000 });
      return { passed: result.code === 0, code: result.code };
    },
  });
}

function startCheck(runner, id) {
  const check = CHECKS[id];
  if (!check) throw new Error("unknown check");
  const command = checkCommand(id);
  return runner.enqueue({
    kind: "check",
    label: check.label,
    target: id,
    display: command,
    run: async (ctx) => {
      const result = await ctx.exec({ cmdLine: command, cwd: check.cwd, env: { ...process.env }, display: command, capture: true, timeoutMs: 20 * 60 * 1000 });
      const summary = check.parse(result.stdout || "");
      const passed = result.code === 0 && (summary.fail === undefined || summary.fail === null || summary.fail === 0);
      ctx.setSummary(summary);
      return { passed, code: result.code, summary };
    },
  });
}

// The schema check connects with a read-only database role (SELECT only). Its connection string lives in a
// git-ignored file in the console's data folder and is never printed. Without that file the check does not run.
const SCHEMA_ROLE_FILE = path.join(DATA_DIR, "schema-readonly.env");

function readOnlySchemaUrl() {
  try {
    const match = fs.readFileSync(SCHEMA_ROLE_FILE, "utf8").match(/^SCHEMA_READONLY_DATABASE_URL=(.+)$/m);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

function startSchemaDiff(runner) {
  const command = "npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script";
  return runner.enqueue({
    kind: "schema",
    label: "Database schema status (read only)",
    target: "schema",
    display: command,
    run: async (ctx) => {
      const roleUrl = readOnlySchemaUrl();
      if (!roleUrl) throw new Error("The schema check is off until its read-only database role is set up. Nothing was run.");
      // The env files are read in memory and handed to the child only. They are never printed. The database
      // address is replaced with the read-only role, so the full-privilege credentials are not passed on.
      const env = { ...process.env, ...loadEnvFiles().childEnv(), DATABASE_URL: roleUrl };
      const result = await ctx.exec({ cmdLine: command, cwd: SERVER_ROOT, env, display: command, capture: true, timeoutMs: 10 * 60 * 1000 });
      const classification = classifySchemaSql(result.stdout || "", {
        exitCode: result.code,
        dryRun: Boolean(ctx.dryRun),
        truncated: Boolean(result.truncated),
      });
      const summary = { ...classification, sql: (result.stdout || "").slice(0, 60000) };
      ctx.setSummary(summary);
      // Passed only when the check ran cleanly and gave a usable verdict. A dry run or an unreadable result fails.
      return { passed: classification.status !== "unknown", code: result.code, summary };
    },
  });
}

module.exports = { RESTART_APPS, BUILDS, CHECKS, startRestart, startBuild, startCheck, startSchemaDiff, serverTestFiles, readOnlySchemaUrl };
