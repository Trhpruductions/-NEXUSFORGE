# Backups and recovery

## What runs today

- **Nightly backup** (Windows task "Vexora Gaming daily backup", 04:00): `scripts/run-daily-backup.cmd` runs
  `scripts/vexora-backup.mjs`. It writes a `pg_dump` of the live database (custom format) and a copy of the
  uploads folder to `D:\NexusForgeDB\backups`, keeping the newest 14 of each. Log:
  `D:\NexusForgeDB\backups\backup-task.log`.
- **Where things live**: the live database is its own PostgreSQL 17 server with data in
  `D:\NexusForgeDB\data`, port 5433, localhost only, log `D:\NexusForgeDB\postgres.log`. It is started at
  logon by `scripts/vexora-autostart.cmd` and restarted by the watchdog if it stops. The Windows service
  "postgresql-x64-17" (data under `C:\Program Files\PostgreSQL\17\data`, port 5432) is a **different**
  server and does not hold Nexus Forge data.

## Proving a backup restores

```
node scripts/ops/backup-restore-check.mjs              # newest dump
node scripts/ops/backup-restore-check.mjs <file.dump>  # a specific dump
```

It starts a throwaway, password-protected Postgres instance on port 5499 (never the live server), restores the
dump, counts every table's rows, checks that no table the live database has is missing from the backup, then
stops the instance and deletes its folder. Exit code 0 means PASSED.

Result on 18 Oct 2026 (backup from 04:00 that day): restored with no errors in 2.1 s, 80 tables, 4,671 rows,
no missing tables. The uploads copy had every file that existed when it was made.

## Encrypted copies off this PC (on since 19 Oct 2026: OneDrive)

**Switched on 19 Oct 2026** with `node scripts/ops/setup-offsite-backup.mjs`: the copies go to
`C:\Users\TRHDEVELOPMENT\OneDrive\NexusForge Backups` (synced to the owner's OneDrive), and the key is in
`apps/server/.env` as `BACKUP_ENCRYPTION_KEY` (never committed). First copy made the same day, then decrypted
from the OneDrive folder and fully restore-checked: 80 tables, no errors, all 31 upload files. The 04:00 backup
now adds a copy every night and keeps the newest 14.

Everything above is on the same PC as the live site. A dead disk, theft, fire or ransomware would take the
site and its backups together. The nightly backup can also write an **encrypted** copy to a folder that leaves
the PC. It stays off until both settings exist (in `apps/server/.env` or the environment):

| Setting | Meaning |
|---|---|
| `BACKUP_OFFSITE_DIR` | A folder that leaves this PC: a cloud-synced folder (OneDrive, Google Drive, Dropbox), a network drive, or a USB drive that is taken off-site. |
| `BACKUP_ENCRYPTION_KEY` | 32 random bytes, base64. Make it with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. |
| `BACKUP_OFFSITE_KEEP` | Optional; how many off-site copies to keep (default 14). |

**Keep a copy of the key outside this PC** (a password manager). Without it the off-site copies can't be
restored. The copies are AES-256-GCM encrypted, so the cloud provider can't read user data, and a damaged or
altered copy is detected instead of restored.

Owner decisions needed before switching it on: which destination, who can access it, and how long copies are
kept (the database holds personal data such as emails, so the retention period should match the privacy
policy).

Tested on 18 Oct 2026 with a temporary folder: backup, then encrypted copy, then decrypt
(`node scripts/ops/backup-decrypt.mjs <file.enc> <output>`), then a full restore check PASSED (80 tables), and
the uploads archive unpacked with all 31 files.

## Restoring for real

1. Stop the API so nothing writes during the restore: `pm2 stop nexusforge-backend-workspace` (never
   `pm2 save`).
2. If the backup is an off-site copy, decrypt it first with `scripts/ops/backup-decrypt.mjs`.
3. Prove the dump with `scripts/ops/backup-restore-check.mjs <file.dump>`.
4. Restore into the live database (this replaces its contents):
   `pg_restore --clean --if-exists -h localhost -p 5433 -U <user> -d nexusforge <file>.dump`
   (password via the `PGPASSWORD` environment variable, never on the command line).
5. Uploads: copy the backup folder (or unpack the `.tar`) into `UPLOAD_DIR`.
6. `pm2 start nexusforge-backend-workspace`, then check `https://nfgcord.com/api/health`.

## Database outage on 18 Oct 2026 (explained)

The API logged 163 "connection refused" errors. The database log shows a normal **fast shutdown request** at
10:24:56. That is what `pg_ctl stop`, a Ctrl+C, or closing the console window Postgres was started from sends,
not a crash. The watchdog noticed after 3 failed checks and started it again at 10:27:30. It recovered by
10:28, about 3 minutes down. The source of the shutdown request wasn't found (no Windows service events, no
reboot, and no development session was active at that moment).

Because the live database is started from a console with `pg_ctl` rather than as a service, anything that
closes or interrupts that console can stop it. **Fix (needs administrator rights, so the owner runs it):**
`scripts/ops/register-db-service.ps1` moves it under its own Windows service "nexusforge-db": started by
Windows at boot, restarted 5/10/30 s after a crash, logs in `D:\NexusForgeDB\data\log`. Open PowerShell with
"Run as administrator", go to the repo folder, then:

```
powershell -ExecutionPolicy Bypass -File scripts\ops\register-db-service.ps1                 # dry run, shows the plan
powershell -ExecutionPolicy Bypass -File scripts\ops\register-db-service.ps1 -OwnerApproved  # does it
```

The database is down for roughly 10-30 seconds during the hand-over; the API reconnects by itself. If the
service doesn't come up within 60 s the script removes it and starts the database the old way again.
`scripts/vexora-autostart.cmd` and the watchdog already know about the service: once it exists they start it
through Windows instead of running a second copy with `pg_ctl` (the watchdog picks this up at its next
restart; until then it would still start the database the old way if it ever went down).

## If this PC is lost

What's needed to rebuild on another Windows PC:
1. The code: GitHub `Trhpruductions/-NEXUSFORGE` (push regularly; the working branch is
   `feat/community-feed`).
2. The data: the newest off-site encrypted backup (database + uploads) and the encryption key.
3. The secrets: `apps/server/.env` and `apps/web/.env.local` values (keep them in a password manager, never in
   the repo), and the Cloudflare tunnel credentials from `%USERPROFILE%\.cloudflared` (or create a new tunnel
   in the Cloudflare dashboard and point nfgcord.com at it).
4. Install Node.js 24, PostgreSQL 17 and pm2; `npm ci`; create the database; restore the dump; build the
   server and web app; start the pm2 apps from `ecosystem.config.cjs`; start the tunnel.
5. Check `https://nfgcord.com/api/health`, sign in with a test account, and confirm uploads display.

Rehearse this once on a spare machine; it is the only way to know the list is complete.
