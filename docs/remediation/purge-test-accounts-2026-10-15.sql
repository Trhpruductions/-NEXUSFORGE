-- DRAFT, NOT EXECUTED.
--
-- Removes every account whose email is not on gmail.com: seeded accounts (nexusforge.local,
-- vexora.local, nexusforge.dev, nexusforge.app), automated test accounts (example.test,
-- example.com) and anonymised deletion tombstones (deleted.invalid). The 7 gmail.com accounts are kept.
--
-- Decisions made on 2026-10-16:
--   A. Vexora Demo Squad: transferred to trhdevelopment (done before this file was written; see below).
--   B. The duplicate owner trhdevelpment is removed (included in the 96).
--   C. The 61 Owner Console tickets are kept. This file does not touch them.
--
-- Expected from the live database, recounted after the transfer on 2026-10-16:
--   accounts removed: 96    accounts kept: 7
--   forges removed (owned by removed accounts): 11   messages inside them: 37
--   support tickets removed: 7
--   real-user memberships lost: 0 (both real members stay in Vexora Demo Squad)
--
-- BEFORE RUNNING
--   1. Take a backup of the live database (run scripts\run-daily-backup.cmd, or vexora-backup.mjs).
--   2. Decide the open items marked DECISION below and edit this file to match.
--   3. Run it yourself, in a psql session, one statement at a time. It ends in ROLLBACK on purpose:
--      change the last line to COMMIT only after you have read the check output.
--
-- Owner Console tickets (tools/owner-console/data/console.sqlite, 61 rows) are not in this file.
-- They are a separate store and are kept (decision C).

BEGIN;

CREATE TEMP TABLE purge_users AS
SELECT id, username FROM "User"
WHERE split_part(email, '@', 2) <> 'gmail.com';

-- Preflight: stop if the set is not the expected 96 accounts.
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM purge_users;
  IF n <> 96 THEN
    RAISE EXCEPTION 'expected 96 accounts to remove, found %', n;
  END IF;
END $$;

-- Decision A is already applied: Vexora Demo Squad now belongs to trhdevelopment, so it is not in the cascade.
-- If you ever need to re-check it, run:
--   SELECT u.username FROM "Forge" f JOIN "User" u ON u.id = f."ownerId" WHERE f.name = 'Vexora Demo Squad';

-- Decision B: the duplicate owner account 'trhdevelpment' (nexusforge.app) is in the removal set (96 includes it).

-- The removal itself. Cascades remove each account's sessions, memberships, forges, tickets,
-- coin ledger rows and friendships, as the foreign keys in schema.prisma specify.
DELETE FROM "User" WHERE id IN (SELECT id FROM purge_users);

-- Check: expect 7 accounts left, all on gmail.com.
SELECT count(*) AS accounts_left, string_agg(username, ', ') AS usernames FROM "User";
SELECT count(*) AS tickets_left FROM "SupportTicket";
SELECT count(*) AS forges_left FROM "Forge";

-- Change to COMMIT only after the check output above is what you expect.
ROLLBACK;
