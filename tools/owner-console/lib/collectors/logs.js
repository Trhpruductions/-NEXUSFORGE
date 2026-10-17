"use strict";

// Tails the last lines of each Nexus Forge app's pm2 out and err logs. Read only.
// The log file names come from pm2's own state (pm2_env.pm_out_log_path and pm_err_log_path), so they follow restarts.

const fs = require("node:fs/promises");
const path = require("node:path");
const { LOG_APPS, LOG_TAIL_BYTES, LOG_TAIL_LINES, LOG_LINE_MAX_CHARS } = require("../config");
const { scrubText } = require("../secrets");
const { scanSecurityLines } = require("../security-scan");

// Last size seen per pm2 app and stream, used to find the lines written since the previous poll.
const lastSeen = new Map();

async function readTail(file, sinceSize) {
  const handle = await fs.open(file, "r");
  try {
    const st = await handle.stat();
    const len = Math.min(st.size, LOG_TAIL_BYTES);
    const buf = Buffer.alloc(len);
    let read = 0;
    while (read < len) {
      const { bytesRead } = await handle.read(buf, read, len - read, st.size - len + read);
      if (bytesRead === 0) break;
      read += bytesRead;
    }
    const text = buf.subarray(0, read).toString("utf8");
    let lines = text.split(/\r?\n/);
    if (len < st.size && lines.length > 0) lines = lines.slice(1); // the first line may start mid-way
    while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();

    let newText = "";
    if (typeof sinceSize === "number" && st.size > sinceSize) {
      const delta = Math.min(st.size - sinceSize, read);
      newText = buf.subarray(read - delta, read).toString("utf8");
    }
    return { size: st.size, mtimeMs: st.mtimeMs, lines, newText };
  } finally {
    await handle.close();
  }
}

async function collectLogs(pm2Apps) {
  if (!Array.isArray(pm2Apps)) throw new Error("pm2 has not reported its app list yet");
  const apps = {};
  const securityHits = [];
  const newStderr = [];

  for (const app of LOG_APPS) {
    const pm2 = pm2Apps.find((candidate) => candidate.name === app.pm2Name);
    const entry = { key: app.key, label: app.label, pm2Name: app.pm2Name, present: Boolean(pm2), files: {}, lines: { out: [], err: [] } };

    for (const stream of ["out", "err"]) {
      const file = pm2 && pm2.logPaths ? pm2.logPaths[stream] : null;
      if (!file) {
        entry.files[stream] = { name: null, sizeBytes: null, mtime: null, error: "pm2 reports no log file for this app" };
        continue;
      }
      const memoKey = `${app.pm2Name}:${stream}`;
      const previous = lastSeen.get(memoKey);
      const sinceSize = previous && previous.file === file ? previous.size : undefined;
      try {
        const tail = await readTail(file, sinceSize);
        lastSeen.set(memoKey, { file, size: tail.size });
        entry.files[stream] = {
          name: path.basename(file),
          sizeBytes: tail.size,
          mtime: new Date(tail.mtimeMs).toISOString(),
          error: null,
        };
        entry.lines[stream] = tail.lines.slice(-LOG_TAIL_LINES).map((line) => ({
          text: scrubText(line.slice(0, LOG_LINE_MAX_CHARS)),
        }));
        securityHits.push(...scanSecurityLines(tail.lines, { app: app.key, stream }));
        if (stream === "err" && sinceSize !== undefined) {
          const fresh = tail.newText.split(/\r?\n/).filter((line) => line.trim() !== "");
          if (fresh.length > 0) {
            newStderr.push({ app: app.key, label: app.label, count: fresh.length, sample: scrubText(fresh[0].slice(0, 200)) });
          }
        }
      } catch (err) {
        entry.files[stream] = {
          name: path.basename(file),
          sizeBytes: null,
          mtime: null,
          error: scrubText(String(err.code || err.message || "could not read log")),
        };
      }
    }
    apps[app.key] = entry;
  }

  return { checkedAt: new Date().toISOString(), apps, securityHits, newStderr };
}

module.exports = { collectLogs };
