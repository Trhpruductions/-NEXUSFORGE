// What the logon script (scripts/vexora-autostart.cmd) should do with one pm2 app, decided from `pm2 jlist` output.
// Kept pure so it can be tested without pm2.

/**
 * The JSON list from `pm2 jlist` output. pm2 can print warnings on their own lines before it (for example
 * "In-memory PM2 is out-of-date"), so the list is the line that starts with "[". Null when there is none.
 */
export function parseJlist(output) {
  for (const line of String(output ?? "").split(/\r?\n/)) {
    const text = line.trim();
    if (!text.startsWith("[")) continue;
    try {
      const list = JSON.parse(text);
      if (Array.isArray(list)) return list;
    } catch {
      // Not the list; keep looking.
    }
  }
  return null;
}

/**
 * "online", "missing", a pm2 status such as "errored" or "stopped", or "stale-settings": the API runs, but
 * without the graceful-shutdown settings from ecosystem.config.cjs (a resurrect from the old dump.pm2).
 */
export function appState(list, name) {
  const app = list.find((entry) => entry?.name === name);
  if (!app) return "missing";
  const status = app.pm2_env?.status ?? "unknown";
  if (status === "online" && name === "nexusforge-backend-workspace" && app.pm2_env?.shutdown_with_message !== true) return "stale-settings";
  return status;
}
