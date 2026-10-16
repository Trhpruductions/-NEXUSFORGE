-- DRAFT, NOT EXECUTED.
--
-- Removes every account whose email is not on gmail.com: seeded accounts (nexusforge.local,
-- vexora.local, nexusforge.dev, nexusforge.app), automated test accounts (example.test,
-- example.com) and anonymised deletion tombstones (deleted.invalid). The 7 gmail.com accounts are kept.
--
-- Expected from the read-only inventory on 2026-10-15:
--   accounts removed: 96    accounts kept: 7
--   forges removed (owned by removed accounts): 12   messages inside them: 43
--   support tickets removed: 7
--   real-user memberships lost: 2 (Vexora Demo Squad, owned by a removed account)
--
-- BEFORE RUNNING
--   1. Take a backup of the live database (run scripts\run-daily-backup.cmd, or vexora-backup.mjs).
--   2. Decide the open items marked DECISION below and edit this file to match.
--   3. Run it yourself, in a psql session, one statement at a time. It ends in ROLLBACK on purpose:
--      change the last line to COMMIT only after you have read the check output.
--
-- Owner Console tickets (tools/owner-console/data/console.sqlite, 61 rows) are not in this file.
-- They are a separate store, and they are not removed unless you decide so (see DECISION C).

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

-- DECISION A: Vexora Demo Squad is owned by a removed account, and two real members
-- (TheBoydWonder, jacksons612gaming) would lose it. Uncomment ONE of these lines:
-- A1 (recommended): hand the forge to the owner account, then it is not deleted.
-- UPDATE "Forge" SET "ownerId" = (SELECT id FROM "User" WHERE username = 'trhdevelopment')
--   WHERE name = 'Vexora Demo Squad' AND "ownerId" IN (SELECT id FROM purge_users);
-- A2: leave it as it is; the forge and its 6 messages are removed with the account.

-- DECISION B: the duplicate owner account 'trhdevelpment' (nexusforge.app) is in the removal set (96 includes it).
-- To keep it, add "AND username <> 'trhdevelpment'" to the purge_users query and change the preflight to 95.

-- The removal itself. Cascades remove each account's sessions, memberships, forges, tickets,
-- coin ledger rows and friendships, as the foreign keys in schema.prisma specify.
DELETE FROM "User" WHERE id IN (SELECT id FROM purge_users);

-- Check: expect 7 accounts left, all on gmail.com.
SELECT count(*) AS accounts_left, string_agg(username, ', ') AS usernames FROM "User";
SELECT count(*) AS tickets_left FROM "SupportTicket";
SELECT count(*) AS forges_left FROM "Forge";

-- Change to COMMIT only after the check output above is what you expect.
ROLLBACK;
