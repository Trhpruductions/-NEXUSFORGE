# NexusForge Beta Testing Runbook

## Purpose
Use this runbook to start beta services, expose public links, and onboard testers with consistent flows.

## Fast Path (One Command)
From repository root:

```bash
npm run beta:share
```

This script will:
- clean conflicting ports
- start web + API services
- expose both through public Cloudflare Tunnel URLs
- configure server CORS and web API settings for remote access
- restart web once the public API URL is known
- write `apps/web/.env.local` with public API URL
- print the final tester link
- write all links to `BETA_LINKS.txt`

To stop all beta processes from the saved PID list:

```bash
npm run beta:stop
```

## 1) Start Beta Services
From repository root:

```bash
npm run beta:start
```

This starts:
- Web on `http://localhost:3100`
- API on `http://localhost:4000`

## 2) Start Public Tunnels (Two Terminals)
Terminal A (web):

```bash
npm run beta:tunnel:web
```

Terminal B (api):

```bash
npm run beta:tunnel:api
```

Copy the generated tunnel URLs.

## 3) Web Environment for Public API
Set `apps/web/.env.local`:

```env
NEXT_PUBLIC_API_URL=<your api tunnel url>
NEXUSFORGE_DESKTOP_ONLY=false
```

Restart web after editing env values.

## 4) Primary Tester Entry URL
Send testers to:

- `<your web tunnel url>/beta`

From there they can access:
- `/beta/checklist`
- `/beta/feedback`

If you want desktop testers to use the remote app, set `NEXUSFORGE_DESKTOP_URL` to `https://<your web tunnel url>/app` when launching the desktop client.

> The beta page now displays the computed desktop launch target and PowerShell commands directly, and includes a copy button so testers can copy the launch commands from `/beta`.

## 5) Suggested Message To Testers
Use this template:

```text
NexusForge Beta is live.
Start here: <your web tunnel url>/beta

Please run the checklist and submit findings using the built-in feedback page.
When reporting issues, include route URL, timestamp, and repro steps.
```

## 6) Stability Notes
- Keep all beta and tunnel terminals running.
- Quick tunnel URLs rotate if restarted.
- If links fail, restart tunnel commands and resend new URLs.

## Latest Validation Snapshot (2026-05-12)

End-to-end validation was executed from repository root and completed with all checks passing.

- `npm run build` -> PASS
- `npm run lint` -> PASS
- `npm run test -w @nexusforge/server` -> PASS (15/15)
- `npm run smoke:local` -> PASS (includes API probes)
- `npm run desktop:release:checklist` -> PASS (build/package + launch checks)
- `npm run admin:badge:smoke` -> PASS (grant/revoke verified and state restored)

Notes:
- Admin badge smoke used seeded local admin credentials for validation in local environment.
- Temporary credential environment variables were cleared after the run.
