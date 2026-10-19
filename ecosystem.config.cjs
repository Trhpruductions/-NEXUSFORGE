const os = require("node:os");
const path = require("node:path");

module.exports = {
  apps: [
    {
      name: "nexusforge-backend-workspace",
      script: "apps/server/dist/index.js",
      cwd: "./",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      watch: false,
      // pm2 can't send SIGINT/SIGTERM on Windows, so it sends a "shutdown" message instead. The API then closes
      // HTTP, sockets, background jobs and the database in order (apps/server/src/lib/shutdown.ts, 10 s limit);
      // pm2 force-stops it only after kill_timeout.
      shutdown_with_message: true,
      kill_timeout: 12000,
      env: {
        NODE_ENV: "production",
      },
    },
    {
      name: "nexusforge-web-workspace",
      script: "node_modules/next/dist/bin/next",
      args: "start ./apps/web --hostname 127.0.0.1 --port 3300",
      cwd: "./",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 10,
      restart_delay: 2000,
      watch: false,
      env: {
        NODE_ENV: "production",
        // No NEXT_PUBLIC_API_URL here: the browser talks to the API through the page's own
        // origin (https://nfgcord.com), and a baked-in 127.0.0.1 address once broke sign-in.
        // Age-gate signing secret: set VEXORA_AGE_GATE_SECRET in apps/web/.env.local (never commit it).
      },
    },
    {
      // Public entry point: one local port (3400) that routes /api, /socket.io and /uploads to
      // the API and everything else to the web app. The Cloudflare tunnel points at it.
      name: "vexora-gateway",
      script: "scripts/vexora-gateway.mjs",
      cwd: "./",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 50,
      restart_delay: 3000,
      watch: false,
      env: {
        NODE_ENV: "production",
      },
    },
    {
      // Named Cloudflare tunnel "vexora" for https://nfgcord.com (credentials live in
      // ~/.cloudflared, never in the repo). Deliberately not in dump.pm2 (no "pm2 save" -
      // that dump is shared with the other bots), so scripts/vexora-autostart.cmd starts it.
      name: "vexora-tunnel",
      script: "scripts/vexora-tunnel.mjs",
      args: ["--config", path.join(os.homedir(), ".cloudflared", "vexora.yml"), "--public-url", "https://nfgcord.com"],
      cwd: "./",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 50,
      restart_delay: 5000,
      watch: false,
      env: {
        NODE_ENV: "production",
      },
    },
    {
      // Health watchdog: checks DB, API, web, gateway and the public site every minute,
      // restarts a stuck piece after 3 failures and reports to Discord #bot-alerts.
      name: "vexora-watchdog",
      script: "scripts/vexora-watchdog.mjs",
      cwd: "./",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 50,
      restart_delay: 10000,
      watch: false,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
