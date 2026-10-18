-- PROPOSAL ONLY. Not applied to production. Nothing in this file has been run against the live database.
-- VAC ban system: additive columns on the existing AccountSuspension table, plus one index.
-- Every new column has a default or allows NULL, so existing rows stay valid and no data is rewritten.
-- Generated from the working schema (apps/server/prisma/schema.prisma), AccountSuspension model.
-- Apply only with explicit approval, after a backup. The reviewed statements are wrapped in one transaction.

BEGIN;

ALTER TABLE "AccountSuspension"
  ADD COLUMN "kind" VARCHAR(16) NOT NULL DEFAULT 'STAFF',
  ADD COLUMN "source" VARCHAR(16) NOT NULL DEFAULT 'STAFF',
  ADD COLUMN "category" VARCHAR(16),
  ADD COLUMN "evidence" VARCHAR(1000),
  ADD COLUMN "needsReview" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "appealedAt" TIMESTAMP(3),
  ADD COLUMN "appealNote" VARCHAR(1000);

-- CreateIndex
CREATE INDEX "AccountSuspension_kind_liftedAt_idx" ON "AccountSuspension"("kind", "liftedAt");

COMMIT;

-- Rollback (only if the VAC feature is withdrawn and the new columns are empty of data you need):
--   DROP INDEX "AccountSuspension_kind_liftedAt_idx";
--   ALTER TABLE "AccountSuspension" DROP COLUMN "appealNote", DROP COLUMN "appealedAt", DROP COLUMN "needsReview",
--     DROP COLUMN "evidence", DROP COLUMN "category", DROP COLUMN "source", DROP COLUMN "kind";
