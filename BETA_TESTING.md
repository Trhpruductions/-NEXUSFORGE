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

## Desktop QA Pass/Fail Sheet (Release 6bbbcf2)

Use this sheet to validate desktop recovery routing and beta launch UX changes.

| Test ID | Area | Environment | Steps | Expected Result | Actual Result | Verdict | Notes |
|---|---|---|---|---|---|---|---|
| DQ-01 | Hosted startup success | Hosted target reachable | Launch desktop in hosted mode | App opens hosted target directly; diagnostics action opens same hosted URL |  |  |  |
| DQ-02 | Hosted fallback to local | Hosted down, local web/api up | Launch desktop with unreachable hosted target | Recovery connects to local app; status target switches to local URL |  |  |  |
| DQ-03 | Local startup success | Local web/api up | Launch desktop in local mode | App opens local target; diagnostics action label shows local mode |  |  |  |
| DQ-04 | Local fallback to hosted | Local web/api down, hosted reachable | Launch desktop in local mode | Recovery connects to hosted target; status target switches to hosted URL |  |  |  |
| DQ-05 | Diagnostics open-target accuracy | Any mode | Open fallback diagnostics; click open-target action | Action opens current runtime target (no stale URL) |  |  |  |
| DQ-06 | URL hardening | Inject invalid/non-http target value | Trigger diagnostics open-target action | Invalid target ignored; safe fallback URL used; no script errors |  |  |  |
| DQ-07 | Mode-aware label | Mode switch during recovery | Observe open-target button label | Label updates to hosted/local based on active launch mode |  |  |  |
| DQ-08 | Retry behavior | Any degraded mode | Use Retry Connection action | Retry attempts connection without loop or freeze; status updates correctly |  |  |  |
| DQ-09 | Beta onboarding links | Beta web route | Walk /beta actions for register/login/open app/checklist/feedback | Links route correctly and preserve expected redirect behavior |  |  |  |
| DQ-10 | Desktop launch instructions | Beta web route | Check launch target and PowerShell snippet on /beta | Launch target reflects configured context and is copy-ready |  |  |  |
| DQ-11 | Update banner gating | Desktop runtime | Check idle state then simulate actionable update state | Banner hidden when non-actionable; visible with actionable update states |  |  |  |
| DQ-12 | Regression sweep | Post-change validation | Run smoke flow and quick UI sanity pass | No regressions in startup, fallback, or beta launch flows |  |  |  |

### Execution Metadata

- Build/Version:
- Tester:
- Date:
- OS:
- Network Mode:
- Result Summary:
