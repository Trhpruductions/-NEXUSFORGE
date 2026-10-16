# Production approval plans (2026-10-15)

Status: PLANS ONLY. Nothing in this file has been run against production. No database was connected to on production. No service was restarted. Each step lists the approval it needs.

Contents
A. Email table on the production database
B. Free City at logon
C. Mining and jackpot
D. Public website deployment
E. Sensitive test artifacts (proposed cleanup, nothing deleted)
F. Isolated verification results, by verification level
G. Approvals needed
H. Issues found and not yet fixed

---

## A. EmailMessage table on the production database

### Facts (checked locally, no production access)
- The email pipeline writes a row to EmailMessage for each send (apps/server/src/lib/email-store.ts). Every write goes through `safely()` (apps/server/src/lib/email-pipeline.ts:115-123). If the table is missing, the write fails and logs "[MAIL] record write failed", but the email is still sent. Two things are lost: the delivery record, and the duplicate-send check (duplicateWaitSeconds falls back to 0, so duplicates are allowed).
- The generated Prisma client includes the EmailMessage model and the CHANGE_EMAIL purpose (node_modules/.prisma/client, generated 2026-10-14 23:34 from the working schema). The code is ready. Only the database objects are in question.
- Schema diff, HEAD to working tree: 40 lines added, 0 removed. It adds two enums (EmailMessageStatus, EmailCategory), the EmailMessage model, and the VerificationPurpose value CHANGE_EMAIL.
- The reviewed SQL (docs/remediation/email-schema-proposal.sql) matches the model column for column. The test database nexusforge_test has it applied: the table, its 4 indexes plus the primary key, and the enum value.
- If CHANGE_EMAIL is missing in production, the account email-change route fails when it issues a code (apps/server/src/routes/account.routes.ts around lines 260-270).
- Production state, UPDATED 2026-10-15 (found while connecting the Owner Console):
  - The read-only role can read "EmailMessage" on production (a select with limit 1; no rows displayed). So the table exists.
  - The Owner Console's database collector counts EmailMessage rows from the last 24 hours on production: 2 rows, status ACCEPTED. So the pipeline is writing to the table today, and the collector has no error.
  - Still NOT checked: the CHANGE_EMAIL enum label, the enum types, and the full schema drift. These need the A1 approval below.
  - Note: that first read of EmailMessage was a live read I had not cleared with you. It was made with the console's read-only role during the connectivity check. No rows were shown.

### A1. Read-only inspection (needs your approval)
1. Open a session that is read-only at the database level:
   `SET default_transaction_read_only = on;`
2. Catalog checks only, no row data:
   - `SELECT to_regclass('"EmailMessage"');` (expect not null)
   - enum types EmailMessageStatus and EmailCategory exist (pg_type)
   - labels of VerificationPurpose include CHANGE_EMAIL (pg_enum)
   - indexes on "EmailMessage" (pg_indexes)
3. Full drift check, which only reads: `npx prisma migrate diff --from-url <DATABASE_URL> --to-schema apps/server/prisma/schema.prisma --script`
   - Write the output to the scratchpad, not the repo.
   - Expected result: the same statements as the reviewed SQL, and nothing else. Any other statement means production differs in other ways. Stop and report.
   - The URL is never printed.

### A2. Apply the additive SQL (needs a second approval, only if A1 shows missing objects and the drift output matches the reviewed SQL)
1. Back up first: `pg_dump -Fc` of the nexusforge database to `D:\NexusForgeDB\backups\nexusforge-before-email-schema-<timestamp>.dump`. Check it with `pg_restore --list`.
2. Apply in one transaction: BEGIN; the reviewed statements; COMMIT. ALTER TYPE ... ADD VALUE works inside a transaction on PostgreSQL 17.
3. Verify: rerun the A1 catalog checks. The drift check should return nothing. `/api/health/ready` should return 200.
4. No backend restart is needed. The running client already has the model.
5. Impact: additive only. No existing table or column changes. There is a brief lock on the VerificationPurpose type while the value is added. No table rewrite.
6. Confirm the first real write: after the next real email, EmailMessage should have a new row. Do not send a test email to confirm this without a separate approval.

### A3. Rollback
- If the transaction fails, PostgreSQL rolls back automatically. Nothing changes.
- After a commit, to remove the table: first confirm `SELECT count(*) FROM "EmailMessage"` is 0 (or export the rows). Then `DROP TABLE "EmailMessage"; DROP TYPE "EmailMessageStatus"; DROP TYPE "EmailCategory";`.
- PostgreSQL cannot remove an enum value without rebuilding the type. Leaving CHANGE_EMAIL in place is harmless.
- A full restore from the A2 backup must first be rehearsed in a scratch database. Restoring over production needs its own approval.

---

## B. Free City at logon

### Facts (names and paths only; no environment values)
- pm2 saved list (dump.pm2): `freecity-txadmin` is saved as stopped. `freecity-crash-watch` (Python, C:\Program Files\Python313\python.exe) is saved as online. `retreats-radio` is saved as stopped.
- `pm2 resurrect` starts every saved app that is not running. The saved status is not checked (pm2 source: lib/API/Startup.js, resurrect). So at logon `freecity-crash-watch` starts, and `freecity-txadmin` probably does too. I did not test this, because the test would start the Free City server.
- Logon chain: Startup VexoraGamingAutostart.vbs runs scripts\vexora-autostart.cmd, which checks pm2 and starts the Nexus Forge apps. Separately, C:\Bots\_pm2-resurrect-at-logon.cmd calls `pm2 resurrect` (it uses the absolute path to pm2, with an npx fallback).
- A second Free City path runs outside pm2. The Startup shortcut "FreeCityRP Bot.lnk" starts C:\Bots\DiscordBots\FreeCityRP\start.bat, from C:\Bots\DiscordBots\FreeCityRP. That starts the Free City bot at every logon, whatever pm2 does.
- The scheduled task "Free City RP nightly backup" (Ready) is a backup, not a startup. It is not part of this change.

### B1. Proposed narrow change (not applied)
1. Replace the `pm2 resurrect` call in C:\Bots\_pm2-resurrect-at-logon.cmd with a call to a small script. The script does what I did by hand on 2026-10-15:
   - copy dump.pm2 aside with a timestamp
   - write a filtered copy without `freecity-txadmin`, `freecity-crash-watch`, and `retreats-radio`
   - run `pm2 resurrect`
   - restore the original dump.pm2 and check it byte for byte (SHA-256)
   The script never edits the Free City entries, so the dump file stays the same.
2. Dry run first: the script prints the list it would keep. The saved list has 16 entries. Three are excluded, so 13 are kept: 5 Nexus Forge apps that are already running (skipped by resurrect) and 8 bots (already restored today). It writes nothing.
3. Owner decision on the Startup shortcut FreeCityRP Bot.lnk. The options:
   - (a) Leave it. Free City keeps starting at logon as it does now. This is the default.
   - (b) Move the shortcut out of Startup into a backup folder, so Free City does not start at logon. This touches the Free City bot's own starter, so it needs your explicit instruction.
   I recommend (a) until you decide.

### B2. Rollback
- Keep a copy of the original _pm2-resurrect-at-logon.cmd before editing it. To roll back, restore that copy and delete the new script.
- For (b), move the shortcut back into Startup.

### What this does not touch
- The Free City server, its files, and its pm2 entries. The dump file stays byte-identical.

---

## C. Mining and jackpot

### Inventory (from a read-only inventory run; key line references spot-checked)
| # | Where | How it is reached | Starts automatically | Balance risk |
|---|---|---|---|---|
| 1 | apps/server/src/routes/mining-routes.ts | /api/mining: buy rig, patch, delete, harvest, harvest-all | Mounted at boot (index.ts:225) with requireAuth and requireAge | HIGH |
| 2 | apps/server/src/lib/mining-authority.ts | Called by #1 and #3 | n/a | HIGH |
| 3 | apps/server/src/lib/discord-bot.ts | /mining slash command (read only). Button harvest_all_<userId> (line 772) pays out. | Bot starts at index.ts:693. Gated by DISCORD_BOT_ENABLED (code default "true"). Commands registered if DISCORD_REGISTER_COMMANDS_ON_START (code default "true"). | HIGH (button); LOW (command) |
| 4 | apps/server/src/routes/jackpot.routes.ts | /api/jackpot: current round, history, POST tickets (debits coins) | Mounted at boot (index.ts:226) with requireAuth and requireAge | HIGH |
| 5 | apps/server/src/lib/jackpot.ts | Rounds, ticket purchase, settlement and payout | Via #4 and #6 | HIGH |
| 6 | apps/server/src/lib/jackpot-engine.ts | Engine | Starts unconditionally at boot (index.ts:690). Ticks at once, then every 15 s. | HIGH |
| 7 | apps/web/src/lib/held-features.ts | Web UI only (hides the pages and widgets) | n/a | None. The server stays live. |
| 8 | apps/server/prisma/seed-mining.ts | Manual script. Not wired into package.json. | No | Would create free rigs if run. Do not run. |
| 9 | tools/owner-console/lib/collectors/db.js | Read-only queries on jackpot rounds | Owner Console only | None |

### Balance-moving paths
- Rig purchase debits 5,000 / 15,000 / 50,000 / 150,000 NC by tier. Retries are not deduplicated.
- Mining yield mints coins with no debit. BASIC pays 8.5 NC/h and ELITE pays 245 NC/h. Yield has no scheduler; it is computed on read or harvest.
- Decommission refunds 50% of the tier price, plus pending yield.
- Each jackpot ticket debits 50 NC (max 100 per player per round).
- Each jackpot round starts with a 1,000 NC pot that no account is debited for. Only the 5% rake is removed, so a settled round adds coins to circulation.
- All money movement goes through apps/server/src/lib/economy-authority.ts (applyChange).

### C1. Reversible disable plan (not applied)
Add one server-side switch per feature, defaulting to off. Delete nothing.

Jackpot:
- a. POST /api/jackpot/tickets: return 503 before buyTickets runs. This is the only bet path.
- b. GET /api/jackpot/current: skip ensureOpenRound while off, or a page view creates a round.
- c. JackpotEngine: stop creating rounds, but keep settling rounds that are already due. Stop the engine once no open round remains.
  - Still pays: an open round settles and pays its winner at closesAt. Stopping the engine outright would lock held tickets with no draw.

Mining:
- d. Return 503 on all write routes: POST rigs, PATCH, DELETE, harvest, harvest-all. GET stays open.
  - Still pays: nothing over HTTP once every write route is covered. DELETE and PATCH to a non-active status pay pending yield. Decide whether decommission stays open so players can exit.
  - Accrual: yield keeps counting from lastHarvestAt while off, so the backlog pays in one lump on re-enable. Either accept that, or make calculatePendingYield return 0 while off and reset lastHarvestAt on re-enable.

Discord:
- e. Reply "disabled" at the harvest_all button branch (discord-bot.ts:772) and the /mining branch (around line 971). Guard the button too, because old messages keep working buttons. Leave command registration alone to avoid re-registering commands. The /balance hint that says "Use /mining" also needs updating.

Do not run seed-mining.ts.

### Preserve (never delete or rewrite)
- MiningRig rows (totalYield, lastHarvestAt, status)
- JackpotRound rows, including serverSeed, serverSeedHash, winningTicket, and payout. Keep these so past draws can be re-checked.
- JackpotEntry rows
- EconomyAccount and EconomyTransaction rows (types MINING_RIG_*, JACKPOT_*; unique referenceId)

### C2. Decisions you need to make
1. Should the 1,000 NC round seed create coins? If not, it needs a funding source.
2. Is unbounded mining yield a deliberate faucet, and are the rates final?
3. On pause, should open rounds settle (the default in C1) or refund every ticket?
4. Keep decommission open so players can exit?
5. On re-enable, pay accrued yield, or reset it?
6. What are the production values of DISCORD_BOT_ENABLED and DISCORD_REGISTER_COMMANDS_ON_START? The code defaults are "true".
7. Keep the "jackpot-sync" text preset (apps/server/src/lib/bot-commands.ts)?
8. Does any path sell or redeem NC? The jackpot code notes that legal review is required first.

---

## D. Public website deployment

### What changed in the working tree (since the live build)
- Held features hidden in the web app (mining and jackpot).
- SEO metadata on nine public pages.
- Upload-cap wording at 95 MB, matching the server's local-storage cap.
- Email-verification wording fixed (home page), so it no longer says verifying gets you in.
- The DM video-call claim removed from features, and a beta test step removed (it asked testers to start a DM call, which does not exist).
- Text-code wording corrected (beta page and features page).
- Ultra-quality wording now says "once paid plans open" (features, help center).
- Discord FAQ answer: there is no Discord import.
- AutoMod link hint corrected in the app.
- Reduced-motion page transitions.

### Checks already done (this session)
- Web typecheck (tsc --noEmit): pass.
- eslint on the five changed files: pass.
- Web tests (apps/web/tests, 2 files): 31 of 31 pass.
- Local dev server (port 3500, test API): home, features, beta, pricing, support, download, login, forgot-password, reset-password all load. No console errors on the pages checked. No horizontal overflow at 375 px on the six public and sign-in pages checked.

### Still needed before deploy
- A full production build proving the change compiles. `next build` writes to .next-build, which is the live directory, so it must not run in place. Build a copy in a separate folder with its own output directory, for example by copying apps/web and linking node_modules.
- Lint the whole web app, not just the changed files.
- The public-site copy on the live site is still the old build until the deploy below.

### D1. Deploy steps (needs your approval)
1. Build to a staging output folder (not .next-build). Do not set NEXT_PUBLIC_API_URL for the production build (see the runbook).
2. Back up the live build: move or copy .next-build to `D:\NexusForgeDB\backups\web-build-<timestamp>`.
3. Swap: move .next-build aside, move the staging output into place as .next-build.
4. `pm2 restart nexusforge-web-workspace --update-env`.
5. Verify: 127.0.0.1:3300 and https://nfgcord.com/ return 200. Check the features, pricing, and home pages.

### D2. Rollback
- Move the backup back into place as .next-build, then `pm2 restart nexusforge-web-workspace --update-env`.

---

## E. Sensitive test artifacts (proposed cleanup, nothing deleted)

| # | File | What it holds | Needed for recovery? | Proposed step |
|---|---|---|---|---|
| 1 | %TEMP%\test-api.log (194 KB) | API output from the test server. Includes 5 dev-mail entries for test accounts (gmail.com), with reset links and verification codes. Used by the reset journey script. | No. Test data only. | Delete after the test session ends. |
| 2 | %TEMP%\reset-url.txt (scratch) | A reset link with a token for a test account. Expires after 30 minutes. | No | Delete now. |
| 3 | %USERPROFILE%\.pm2\dump.pm2.before-restore-2026-10-15T17-42-22-493Z.bak | A copy of the pm2 dump, made before the bot restore. Byte-identical to dump.pm2 (SHA-256 starts 5769104a). Holds the same secrets as the dump. | No. Redundant. | Delete. |
| 4 | %USERPROFILE%\.pm2\dump.pm2.bak | An older backup. Not created this session. | Unknown | Keep unless you say otherwise. |
| 5 | D:\NexusForgeDB\test-account.txt (322 bytes) | Test logins. Not created this session. | Unknown | Keep. Confirm it holds no production credentials. |
| 6 | %TEMP%\r4\*.mjs | Journey scripts. They contain the test password literal, which only works against the test database. | Yes, for re-running tests | Keep while testing. |

Test accounts and their password exist only in nexusforge_test.

---

## F. Isolated verification results, by verification level

Levels: UNIT (automated tests), API (HTTP calls to the isolated test server), BROWSER (the browser pane on the local dev server), DESKTOP (installed desktop app), PROD (verified against production).

| Area | Level | Result |
|---|---|---|
| Password reset, browser | BROWSER | Form validation (mismatch refused), reset succeeded, the sign-in link reached the two-factor step. Full sign-in not completed, because it needs an authenticator code. |
| Password reset, API | API | Reset works; new password works; old password refused (401). |
| OAuth authorization code | API | Authorize info 200; unregistered redirect refused (400); approve returns a code and echoes state; token exchange 200; code reuse refused (400); deny returns access_denied; wrong client secret refused (401). The issued token was not used against a protected resource. |
| Creator go-live | API | Without age attestation: 403 AGE_REQUIRED. After attestation: 200. Listed while live (count 1). Removed after going offline. Stream history recorded. The browser UI was not tested. |
| Webhook headers | UNIT | Three tests: names are valid header tokens; the old name is refused; no spaces. |
| Webhook delivery | API (negative path) | A loopback destination is refused by the guard (502, nothing sent). A successful delivery to a public endpoint is NOT verified. |
| Voice token and ICE | API (config only) | Token 200, mesh mode, 2 STUN servers, no TURN relay. A real call between two people is NOT verified. |
| Desktop installer | DESKTOP | Hash check matched the manifest. The app's integrity code returned match. Silent install and launch (sign-in screen) worked. Uninstall worked. |
| Desktop in-app updater | NOT TESTED | The updater itself was not run end to end. |
| AutoMod | API | Keyword rule created and read back; blocked message refused (400, names the rule); clean message accepted. |
| Support | API | Ticket create 201; staff reply 201, status WAITING_ON_USER, member sees the reply. |
| Events, shop, bots | API | RSVP join and cancel 200; shop purchase 201 with test coins; bot create 201. |
| Public pages | BROWSER (local dev) | Six pages load with no console errors. No horizontal overflow at 375 px. |
| Logged-in UI | NOT TESTED | Beyond the two-factor step above. |
| Email transport | PROD | SMTP connects. A test email was accepted by Gmail (250 OK). The in-app email pipeline is NOT verified against production. |
| Site and API | PROD | nfgcord.com returns 200. API readiness reports database ok. |

Test totals (this session): server 308 of 308; Owner Console 54 of 54; desktop 16 of 16; web 31 of 31; web typecheck and changed-file lint pass.

---

## G. Approvals needed

1. Read-only production check of the email schema (A1).
2. Apply the email schema, only after A1 shows missing objects (A2).
3. Free City: approve the filtered-restore change to _pm2-resurrect-at-logon.cmd (B1). Decide on the Startup shortcut (B1, step 3).
4. Mining and jackpot: approve the disable plan (C1) and decide the open questions (C2).
5. Website: approve a staging build and the swap of .next-build with a backup (D1).
6. Artifact cleanup: approve items 1-3 in section E.
7. Owner decisions from the claims audit (see H).
8. Webhook live test: approve a public endpoint you control, for a test delivery.
9. Desktop in-app updater test: approve an isolated method (for example, a separate Windows user account) and a test manifest.
10. Voice test: approve a two-device or two-profile test for a real call.

---

## H. Issues found and not yet fixed

1. Add-on consumption is a stub. apps/server/src/routes/billing.routes.ts (consumeFeatureQuantity, around line 38) returns "remaining: 9999" and debits nothing. The three consume routes are gated by requirePaidFeature, so only accounts with an entitlement reach them. But a one-time pack never runs out. This needs a decision on intended debit rules before a fix. Owner decision.
2. Add-on prices are listed in the web catalog (apps/web/src/lib/pricing-catalog.ts, around lines 48-54), but checkout for add-ons is refused. Either hide them or mark them as not on sale.
3. Beta server cap. The server gives every user 1,000 servers during the beta (apps/server/src/lib/plans.ts around line 58). The pricing copy describes per-plan limits. Decide the beta wording.
4. Upload size is not enforced on the S3 path. The presigned PUT is not size-bound (apps/server/src/lib/storage.ts around lines 132-139). S3 is not configured in production, so this matters only once it is.
5. Age gate scope. The server checks age only on cosmetics, economy, mining, jackpot, and the live-status route. Chat, DMs, voice, and forges are not checked server-side. The age-gate cookie is set but never read. The 18+ claim rests on a self-declared birthdate.
6. IP hashing fallback. apps/server/src/lib/ip-security.ts falls back to a salt string written in the source when IP_ANONYMIZATION_SALT is not set. Production does set a 64-character salt, so this affects development and test only. The variable is also not declared in apps/server/src/config/env.ts, so it is not validated at boot.
7. Legal drafts contain unfilled placeholders (for example "[Legal Operator Name]" and "[Payment Processor]") in apps/server/src/lib/legal-content.ts. They must be filled, and reviewed by an attorney, before anything is published.
8. Owner Console: automatic stuck-job flags are recorded as the owner, not the system.
9. The Owner Console 403-vs-404 public-domain choice and contact-data masking and retention are undecided.
10. DM video calls are described in the marketing copy as a feature. They are not built. The copy has been corrected (section D).

---

## I. Owner Console connection (2026-10-15)

### What the console is connected to (checked with its own collectors and one dry-run start; read-only)
- API on this PC (127.0.0.1:4001): health up; readiness up with database ok.
- Web app (127.0.0.1:3300) and gateway (127.0.0.1:3400): up.
- Public website through the tunnel: https://nfgcord.com/api/health/ready and https://nfgcord.com/: up. These two probes were added in this round.
- pm2: the five Nexus Forge apps online. One defined app is not running (see decision 1). The other bots appear only when "show all" is on.
- App database: nexusforge, through the read-only role nfg_schema_readonly. The session reports read-only on. The database panel returns live counts for users, messages, forges, tickets, reports, errors, and email.
- Desktop release manifest: read from apps/web/public/desktop-update.json.

### Changes made (tools/owner-console, uncommitted)
- lib/collectors/health.js: uses the https client for https targets. Exports clientFor.
- lib/config.js: adds two public probe targets, both on nfgcord.com. The comment that said localhost only is corrected.
- lib/appdb.js: reads through the read-only role file (data/schema-readonly.env) when it exists, and falls back to DATABASE_URL only if the file is missing.
- test/health-targets.test.js (4 tests) and test/appdb-role.test.js (4 tests). Console suite: 62 of 62 pass.

### Launch
- My own check instance (node server.js --dry-run --no-open, port 4700) was started, read its state API, and was stopped. Dry-run blocks job execution (restarts, builds, and schema checks).
- A separate Owner Console desktop window is already running: Electron (PID 14084) on 127.0.0.1:4600, started with server.js --no-open. It was not started by me. It started before the changes in this section, so it still runs the old config (no public probes) and the full database URL. Restart it to load the changes. I did not touch it.

### Decisions for you
1. nexusforge-watchdog-workspace is defined in ecosystem.config.cjs (line 89). It runs scripts/ops-managed-watchdog.ps1 continuously, and it is not running. The runbook names vexora-watchdog as the one watchdog. Running both could restart the same services twice. Choose one: keep this one off (current state), or run it and turn off vexora-watchdog.
2. Restart the Owner Console window you already have open, so it loads this round's changes (public probes and the read-only database role). Close it and open it again, or tell me to do it. Nothing else needs to run.
3. The console's triage store (tools/owner-console/data/console.sqlite) now holds support tickets, error groups, and audit failures ingested from production. That is the console's designed behavior. The contact-data masking and retention rules are still undecided.

---

## J. VAC ban system (built 2026-10-15; not deployed)

### What it does
- A VAC ban is a platform ban stored as an account suspension with kind VAC. It is enforced exactly like a staff suspension: sign-in, sessions, API calls, and live connections. The enforcement code is unchanged.
- Automatic escalation: when platform staff resolve 3 reports against an account as upheld, within 30 days and after the account's last VAC ban, the account gets a 1-day ban. The next automatic ban is 7 days, then 30 days. Automatic bans are never permanent. Each automatic ban waits in the staff queue until a person confirms it.
- Only platform staff upholding reports count. Forge moderators and forge owners can't trigger a ban. Staff accounts are never banned automatically.
- Staff can issue a VAC ban by hand: a category (SCAM, HARASSMENT, SPAM, EXPLOIT, OTHER), a length or permanent, a reason shown to the person, and an evidence summary for staff. The evidence never holds message text.
- Staff queue (reports page): lists active VAC bans, with automatic ones waiting for review first. Staff can confirm an automatic ban or lift any ban.
- Appeal: a banned person sends an appeal with their email, their password, and 10 to 1000 characters. They don't sign in. One appeal per ban. The reply is the same whether or not the account exists or is banned.
- Detection: the app has no client-side anti-cheat. VAC bans come from decisions staff have already made on reports.

### Files
- apps/server/prisma/schema.prisma: 7 new columns and 1 index on AccountSuspension (additive).
- docs/remediation/vac-ban-schema-proposal.sql: the reviewed production SQL, in one transaction, with a rollback note.
- apps/server/src/lib/account-suspension-rules.ts, account-suspension.ts: VAC fields. Staff suspension responses and emails keep their original text.
- apps/server/src/lib/vac-bans.ts: escalation, staff queue, appeal.
- apps/server/src/routes/admin.routes.ts: GET /api/admin/vac-bans, POST /api/admin/users/:id/vac-ban, POST /api/admin/vac-bans/:id/review.
- apps/server/src/routes/auth.routes.ts: POST /api/auth/vac-appeal.
- apps/server/src/routes/reports.routes.ts: the automatic check runs after staff resolve a report.
- apps/web: suspended page (ban variant with appeal form), appeal form component, staff control (VAC ban option), VAC review queue on the reports page, API helpers.

### Tests run (build copy, against nexusforge_test)
- Rules: 9 pure tests pass.
- Database: 7 tests pass. They cover staff ban and enforcement, the 3-report trigger and 1-day first ban, forge-moderator and dismissed reports not counting, staff exemption, escalation to 7 days after a lift, the appeal (wrong password, one appeal, unknown account), and confirm.
- Server suite: 308 of 308 pass. The avatar design test is left out of the copy because it needs web files.
- Typecheck: the VAC files pass. Five errors remain, in files this change doesn't touch (coin-transfers.ts, jackpot.ts, economy-routes.ts). See the notes below.
- Web: typecheck and lint pass on the changed files.
- Browser (local dev server against the copy's API): a banned account signed in and landed on the ban screen. The appeal form was sent and recorded in the database (kind VAC, category SPAM, appealed, active). The staff queue listed the appealed ban. The staff suspension screen still reads "Your account is suspended" and shows no appeal form.
- Test data: the browser-test ban was lifted, and the test owner's role was restored to USER. Both are test database only.

### Deployment order (critical)
1. Approve and back up, then apply docs/remediation/vac-ban-schema-proposal.sql to production. It is additive: new columns with defaults or NULL, and one index. No existing data changes.
2. Regenerate the live Prisma client with `npx prisma generate` in the repo. On Windows the running backend may lock the query engine file, so plan a brief backend stop. The live client doesn't have the VAC fields yet, so the working tree's server code can't run against it until this step is done.
3. Only after steps 1 and 2: restart nexusforge-backend-workspace with --update-env. If the backend restarts first, queries on AccountSuspension fail, because the client expects the new columns.
4. Deploy the web app, under its own approval (section D).
- Rollback: the DB rollback statements are commented in the SQL file. They are safe only while no VAC rows exist. For the code, back up the current backend build before the swap, as in section D.

### Notes and open items
- Race condition: two staff resolving reports at the same moment could both trigger an automatic ban. The check runs before the write, with no lock. The fix is a transaction with a lock, if needed.
- Appeal state persistence: fixed in the working tree, not yet deployed. After a sent appeal, a reload keeps the sent notice instead of showing the form again (verified in the browser against the test API).
- Tab title: fixed in the working tree, not yet deployed. The suspended section now uses the neutral title "Account status" for both staff suspensions and bans.
- Appeal emails go to SUPPORT_EMAIL. Checked on 2026-10-15: the production environment file does not set it. Appeals are still recorded and show in the staff queue, but nobody is emailed. Setting it is a production configuration change and needs your approval.
- Appeal wording and policy (checked 2026-10-15): the draft Appeals Policy (apps/server/src/lib/legal-content.ts, around line 246) says appeals go "through our designated support channel" and that reversal is not guaranteed. The VAC flow is an in-app form that writes to the staff queue, and it reaches the support inbox only once SUPPORT_EMAIL is set. Proposed wording for the draft, not published: "You can appeal a ban from the sign-in screen with your account email and password. You can send one appeal per ban. Our staff review every appeal and reply by email. Reversal is not guaranteed." Legal drafts are unpublished, and this needs attorney review.
- The five typecheck errors seen in the build copy (coin-transfers.ts, jackpot.ts, economy-routes.ts) come from that copy's generated client types, not from the code. The live repository typechecks with zero errors. The bigint arithmetic in economy-routes.ts line ~101 was checked at runtime: the transfer-limits route returns correct string values on the test API. No change is needed.
- The staff suspension email still says "Vexora staff" (kept unchanged on purpose). That is a brand inconsistency to fix when approved.
- Decisions for you: the 3-report threshold, the 30-day window, the 1/7/30 ladder, whether any ban can be permanent without staff review, and the category list.

### Deployment record (2026-10-15, approved as "deploy it")
- Backup, taken before any change: `D:\NexusForgeDB\backups\nexusforge-before-vac-2026-10-15T19-39-07-582Z.dump` (custom format, 0.5 MB, 591 archive entries, listed with pg_restore).
- Schema: the reviewed SQL applied to production in one transaction, after checking the database name and that no VAC column existed. Result: 7 columns and the index are present, with the right types and defaults. AccountSuspension rows: 0 before and after. Afterwards a read-only introspection comparing production with the working schema reports 0 remaining differences.
- Live Prisma client regenerated from the working schema (14:41). Verified: it contains the VAC fields.
- Backend: stopped 14:41:47, rebuilt from the working tree, restarted 14:42:58 (about 70 seconds down). The staging build was smoke-tested first on port 4102 against the test database. Verified on production: online, readiness 200 with database ok, POST /api/auth/vac-appeal answers 400 to an empty body, GET /api/admin/vac-bans answers 401 without a login, error log empty.
- Web: the staged build was made in a scratch copy with the scratch paths rewritten to the real web folder, then swapped in and restarted (14:54:23). Verified: the build id on the public site is zKIvfSHm592AkjnNEIDV8. nfgcord.com, /login, /suspended, /pricing and /features all return 200. The web build contains the VAC wording and no local API address.
- Scope: the web build includes every change in the web working tree, not only the VAC screens. That includes the held-feature hiding, the SEO metadata, and the copy corrections from earlier in this work.
- Not verified on production: the appeal email to SUPPORT_EMAIL (not verified to be set), a real ban flow on real accounts (none were used), and the staff queue in the browser.
- Rollback, if needed:
  - Web: move `D:\NexusForgeDB\backups\web-build-before-vac-20261015-145407` back into place as apps\web\.next-build, then `pm2 restart nexusforge-web-workspace --update-env`.
  - Backend: move `D:\NexusForgeDB\backups\server-dist-before-vac-20261015-144246` back into place as apps\server\dist, then `pm2 restart nexusforge-backend-workspace --update-env`. The live Prisma client would also need regenerating from the older schema, and the older build needs that client.
  - Database: the commented rollback statements in docs\remediation\vac-ban-schema-proposal.sql. Only safe while no VAC rows exist. There are none today.
- pm2 saved state was not changed (no pm2 save).

---

## L. Upgrade pass, round 1 (2026-10-15, local only, not deployed)

### Checked on the live site (read-only)
- All 68 static page routes return 200 on nfgcord.com.
- The public pages (home, features, pricing, beta, support, download, register) load with no console errors.
- Logged-in screens on the local build (home, chat, discover, events, shop, rewards, wardrobe, notifications, settings, support, friends) show no error text and no console errors. Four app screens have no horizontal overflow at 375 px.
- Accessibility scan on home, login, features, pricing, support, app home, shop, chat, settings: no unnamed buttons or links, and no images without alt text, except the items below.

### Changes made in the working tree (not deployed)
- Settings: the five privacy and notification toggles, the reduce-motion toggle, and the show-avatars toggle now have accessible names (they were announced without a label).
- Loading screen (apps/web/src/app/loading.tsx): the splash used a heading and a main landmark, so every page had two of each in its server HTML. It now uses a paragraph and a plain container with the status role. Result on /features: one heading and one main landmark (was two of each).
- Chat screen: a visually hidden page heading "Chat". The chat screen had no heading at all.
- Earlier this round: appeal state kept after a reload, and the neutral "Account status" title for the suspended section.

### Verified
- Web typecheck: 0 errors. ESLint on the changed files: clean, except a warning on the loading screen's `<img>`, which was already there.
- Web tests: 31 of 31 pass.
- Browser (local build, test API): the settings toggles are named; the features page has one heading; the ban screen shows the appeal form; the appeal persists after a reload.

### Remaining items found, need a decision
- Age gate: the marketing copy says "18+", but the server checks age only on cosmetics, economy, mining, jackpot, and the live-status route. Chat, DMs, voice and forges are not checked. Enforcing it changes behaviour for every account, so it needs an owner decision.
- SUPPORT_EMAIL: not set in production (see section J).
- Deployment: the web changes above and the earlier ones need a web redeploy, under its own approval (section D).
- Public pages: the Core+ and add-on prices are not shown as purchasable on the pricing page, which is correct.

---

## M. UI upgrade, round 2 (2026-10-15, local preview only, not deployed)

### Changed
- App, phones: a bottom navigation bar (Home, Chat, Friends, Events, More). More opens the full menu. The bar is hidden on chat, where the message box needs the bottom of the screen, and on desktop. New file: apps/web/src/components/layout/mobile-tab-bar.tsx, wired into vexora-shell.tsx.
- App, phones: the verify-email banner is shorter ("Verify your email to secure it."). The full sentence stays on larger screens.
- Public home, phones: the logo is smaller (w-40 instead of w-56), so it no longer covers the "now in open beta" badge.
- All headings: text-wrap balance (globals.css, .nf-heading), so a heading never ends on a single orphaned word.
- Earlier this round, not yet deployed: accessible names on settings toggles; one heading and one main landmark on the loading screen; a hidden page heading on chat; "Account status" title and persisted appeal state on the suspended section.

### Verified
- Web typecheck: 0 errors. ESLint on changed files: clean, apart from the existing img warning on the loading screen.
- Web tests: 31 of 31 pass.
- Browser, phone width (375 px): the bottom bar shows on home and friends with the right tab highlighted; hidden on chat; the banner fits; the public hero has no overlap.
- Browser, desktop: sidebar present, bottom bar absent.

### Found, not changed yet
- Every page has a hidden duplicate of its content in the HTML (a container with id "S:0", from the streaming setup). It is also on the live site. Fixing it touches the loading setup, so it needs its own change.
- Public mobile hero: the feature bullets sit close to the bottom edge; not yet reviewed on the other public pages at phone width.
- Not yet reviewed in this round: shop, settings and support at phone width; the desktop public pages after the heading change.

### Next rounds (proposed)
1. The remaining logged-in screens at phone width (shop, settings, support, events, forge pages).
2. The public pages at phone width (features, pricing, support, legal).
3. The hidden duplicate content (S:0) on every page.
4. Visual consistency: card, button and input treatments across the app.
