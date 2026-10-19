# Database schema changes (Prisma migrations)

Until now, schema changes went to the live database with `prisma db push`. That works, but it leaves no
history: nobody can review exactly what SQL ran, and a change can't be replayed on a fresh database or rolled
back. This folder sets up proper Prisma migrations without changing anything in the live database.

## What is in the repo

- `apps/server/prisma/migrations/0_init/migration.sql`: the **baseline**, the full current schema (79 tables,
  34 enums, 150 indexes, 94 foreign keys) as plain SQL, generated from `prisma/schema.prisma`.
- `apps/server/prisma/migrations/migration_lock.toml`: tells Prisma the database is PostgreSQL.

Checked on 18 Oct 2026:
- The live database and the test database both match `schema.prisma` exactly (`prisma migrate diff`, read-only).
- On a throwaway Postgres instance, an empty database built only from the migrations matches `schema.prisma`.
- On a throwaway copy of the newest production backup, `prisma migrate resolve --applied 0_init` marks the
  baseline as applied, `prisma migrate status` then reports "Database schema is up to date", and the structure
  is unchanged.

## One-time step for the live database (done 19 Oct 2026)

**Done on 19 Oct 2026 with the owner's approval**, after a fresh backup
(`D:\NexusForgeDB\backups-manual\pre-migrate-baseline-20261019-1020`, restore check passed). Before: no
difference from the schema, `0_init` pending. After: "Database schema is up to date!" and still no
difference. The test database `nexusforge_test` was marked the same way. CI now builds its throwaway database
with `prisma migrate deploy`.

The step only records the baseline in the live database's `_prisma_migrations` table (one row). It does not
change any tables or data. For reference, this is how it was done:

1. Make sure tonight's backup ran, or take one: `node scripts/vexora-backup.mjs`.
2. From `apps/server`, with `DATABASE_URL` loaded from `apps/server/.env` (load it inside node or a shell
   session; never paste it into chat or logs):
   ```
   npx prisma migrate resolve --applied 0_init
   npx prisma migrate status
   ```
   The status should say "Database schema is up to date!".

## The way to change the schema from now on

1. Edit `prisma/schema.prisma`.
2. Create the migration against the **test** database (never the live one):
   `npx prisma migrate dev --name short_description` with `DATABASE_URL` pointing at `nexusforge_test`.
   Prisma needs a shadow database for this; the test server user must be allowed to create databases.
3. Read the generated `migration.sql`. Look for anything that drops columns or tables or rewrites data. Those
   need a plan and the owner's approval.
4. Commit the migration together with the code that uses it.
5. Deploy: back up first (`node scripts/vexora-backup.mjs`), then run `npx prisma migrate deploy` and
   `npx prisma generate` for the live database, then build and restart as usual.
6. Never use `prisma db push` on the live database again. It bypasses the history and can drop data to make
   the schema match.

## Rolling back

Prisma doesn't generate "down" migrations. To undo a change, write a new migration that reverses it. If data
was lost, restore from the backup taken just before the deploy. `scripts/ops/backup-restore-check.mjs` proves
a backup restores cleanly without touching the live server.
