# Ops-managed watchdog retired (2026-10-16)

## What it was
`nexusforge-watchdog-workspace` ran `scripts/ops-managed-watchdog.ps1 -Continuous` under pm2 with a
five-minute interval. Each run did two things:

1. `npm run pm2:workspace:heal` (`scripts/ops-managed-heal.ps1`). When the runtime doctor reports a
   problem, the heal step runs `pm2:workspace:delete:all` (removes the backend and web pm2 apps), then
   `pm2:workspace:start:all` (rebuilds both and starts them again), then probes.
2. `scripts/pm2-workspace-persist.ps1`, which runs `pm2 save`.

## Why it was retired
- **`pm2 save` is forbidden on this PC.** The pm2 dump file is shared with the owner's other bots, and an
  earlier save wiped them. The project's own `vexora-watchdog` says explicitly that it never runs `pm2 save`.
  The ops watchdog ran it every five minutes.
- **Restart-loop risk.** The heal step deletes and rebuilds the production apps whenever the doctor
  check fails. A second automatic restarter (`vexora-watchdog` already restarts stuck services after three
  failures) can fight it, and every cycle rebuilds the apps.
- **Duplicate job.** Health checks and restarts are already done by `vexora-watchdog`.

## What was removed
- The `nexusforge-watchdog-workspace` entry in `ecosystem.config.cjs`. Nothing is started from it.
- The entry in the owner console's expected pm2 app list (`tools/owner-console/lib/config.js`), so the
  console counts only the apps that are meant to run.
- The watchdog's pm2 and ops npm scripts in `package.json` (start, restart, stop, delete, status, logs,
  doctor freshness, status, once, continuous, summary and summary guard).
- The watchdog steps in `scripts/ops-managed-gate.ps1`. The gate still runs brand verification, the desktop
  splash and artifact checks, and managed runtime validation.

## What was kept
- `scripts/ops-managed-watchdog*.ps1`, `scripts/ops-managed-heal.ps1` and the old `var/` logs. They are kept
  for history and are not referenced by any running process or npm script. Do not wire them back into pm2.
- `vexora-watchdog` (health checks, Discord alerts), which is the watchdog that runs.

## Owner console status
The console now expects the five apps that autostart and the ecosystem file manage: backend, web,
gateway, tunnel and `vexora-watchdog`.
