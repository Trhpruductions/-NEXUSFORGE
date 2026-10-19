"use strict";

const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { REPO_ROOT } = require("../config");

let previousCpu = null;
// Same threshold as the watchdog's low-disk alert (scripts/vexora-watchdog.mjs).
const LOW_DISK_GB = 5;

function cpuTotals() {
  let idle = 0;
  let total = 0;
  for (const cpu of os.cpus()) {
    const t = cpu.times;
    idle += t.idle;
    total += t.user + t.nice + t.sys + t.idle + t.irq;
  }
  return { idle, total };
}

async function collectHost() {
  const current = cpuTotals();
  let cpuPct = null;
  if (previousCpu) {
    const dt = current.total - previousCpu.total;
    const di = current.idle - previousCpu.idle;
    if (dt > 0) cpuPct = Math.max(0, Math.min(100, (1 - di / dt) * 100));
  }
  previousCpu = current;

  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const drive = path.parse(REPO_ROOT).root;
  const stats = await fs.statfs(drive);
  const diskTotal = stats.blocks * stats.bsize;
  const diskFree = stats.bavail * stats.bsize;
  // The system drive matters too: Windows, temp files and the pm2 logs live there, and it is the one that fills up.
  const systemDrive = `${process.env.SystemDrive || path.parse(os.homedir()).root.replace(/[\\/]+$/, "")}\\`;
  const drives = [];
  for (const name of [...new Set([systemDrive.toUpperCase(), drive.toUpperCase()])]) {
    try {
      const s = name === drive.toUpperCase() ? stats : await fs.statfs(name);
      const freeGb = (s.bavail * s.bsize) / 1024 ** 3;
      drives.push({ drive: name, freeGb, totalGb: (s.blocks * s.bsize) / 1024 ** 3, low: freeGb < LOW_DISK_GB });
    } catch {
      // A drive that can't be read is left out rather than failing the whole card.
    }
  }

  return {
    checkedAt: new Date().toISOString(),
    hostname: os.hostname(),
    cpuPct,
    cpuCores: os.cpus().length,
    ramPct: ((totalMem - freeMem) / totalMem) * 100,
    ramUsedGb: (totalMem - freeMem) / 1024 ** 3,
    ramTotalGb: totalMem / 1024 ** 3,
    diskDrive: drive,
    diskFreeGb: diskFree / 1024 ** 3,
    diskTotalGb: diskTotal / 1024 ** 3,
    diskUsedPct: diskTotal > 0 ? ((diskTotal - diskFree) / diskTotal) * 100 : null,
    drives,
    hostUptimeSec: os.uptime(),
  };
}

module.exports = { collectHost };
