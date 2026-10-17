# Nexus Forge Gaming: beta runbook

The site is live at **https://nfgcord.com**. Testers need nothing from you except the link; everything below is for whoever runs the beta.

## Send testers here

```text
Nexus Forge Gaming beta is open.
Start here: https://nfgcord.com/beta
It explains how to get in (browser, Windows app, phone or Xbox), what to try and how to report problems.
Payments are in test mode (nothing is charged) and codes come by email only for now.
```

Tester pages:

- `https://nfgcord.com/beta`: ways in, checklist, what's switched off during the beta.
- `https://nfgcord.com/download`: Windows installer, phone and Xbox install steps.
- `https://nfgcord.com/support`: help center, live status card, "Report a problem" (no sign-in needed).

## Where feedback lands

| Source | Where to look |
| --- | --- |
| Report a problem form | `/admin/problem-reports` in the app, plus a post in Discord `#bot-alerts` |
| Support tickets | `/app/support` (staff view) |
| Server errors (500s) | `/admin/errors` (grouped, with reference codes shown to users), plus Discord `#bot-alerts` |
| Outages | Watchdog posts to Discord `#bot-alerts` when something is down and when it recovers |

## Daily checks (two minutes)

```bash
node scripts/vexora-watchdog.mjs --once
```

All five lines should say `ok`. Then glance at `/admin/errors` and `/admin/problem-reports`.

## When something is down

1. `pm2 list`: `nexusforge-backend-workspace`, `nexusforge-web-workspace`, `vexora-gateway`, `vexora-tunnel` and `vexora-watchdog` should all be `online`.
2. Restart one piece: `pm2 restart <name> --update-env`. If it is missing: `pm2 start ecosystem.config.cjs --only <name> --update-env`.
3. Database down: `scripts/vexora-autostart.cmd` starts Postgres (port 5433) and re-checks the pm2 apps; it also runs by itself at logon.
4. Never run `pm2 save` on this PC.

## Shipping a fix

```bash
npm run build -w @nexusforge/server && pm2 restart nexusforge-backend-workspace --update-env
npm run build -w web && pm2 restart nexusforge-web-workspace --update-env
```

Open pages reload themselves once after a web release. Schema changes: run Prisma `db push` and `generate` from `apps/server` first.

## Accounts and perks

- Lifetime membership: `node scripts/grant-lifetime.mjs <username> [core|plus|elite|infinite|--revoke]`.
- Test logins live in `D:\NexusForgeDB\test-account.txt` (never paste them anywhere).
- Stripe is in sandbox mode: test card `4242 4242 4242 4242`. Going live needs the live key and `npm run stripe:setup -- --live`.

## Backups

A Windows task runs `scripts/run-daily-backup.cmd` at 4 AM (database dump + uploads, newest 14 kept) into `D:\NexusForgeDB\backups`; the log is `backup-task.log` there.

## Still switched off during the beta

- Text-message codes (needs Twilio credentials).
- A dedicated sending mailbox (mail currently goes out through Gmail SMTP).
- Code signing for the Windows installer (SmartScreen warning).
- Live payments (Stripe business verification pending).
