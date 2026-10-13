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
        NEXT_PUBLIC_API_URL: "http://127.0.0.1:4001",
        // Age-gate signing secret: set VEXORA_AGE_GATE_SECRET in apps/web/.env.local (never commit it).
      },
    },
    {
      name: "nexusforge-watchdog-workspace",
      script: "cmd.exe",
      args: [
        "/d",
        "/s",
        "/c",
        "powershell -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\ops-managed-watchdog.ps1 -Continuous -Silent -IntervalSeconds 300 -MaxRuns 0",
      ],
      cwd: "./",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 1000,
      restart_delay: 300000,
      watch: false,
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
