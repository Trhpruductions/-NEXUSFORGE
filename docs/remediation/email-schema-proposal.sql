-- PROPOSAL ONLY. Not applied. Not a Prisma migration (the repo has no migrations folder).
-- Generated 2026-10-15 with: prisma migrate diff --from-schema <committed schema at HEAD e03bc6c> --to-schema <working schema> --script
-- Only additive statements: two enums, one new enum value, one new table with four indexes. No DROP, no ALTER of an existing column.
-- Assumption not verified: the live database matches the committed schema at HEAD. Check before applying.
-- Apply only with explicit approval, using the repo's current method (prisma db push) or a reviewed migration, after a backup.

-- CreateEnum
CREATE TYPE "EmailMessageStatus" AS ENUM ('QUEUED', 'ACCEPTED', 'DELIVERED', 'BOUNCED', 'COMPLAINED', 'FAILED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "EmailCategory" AS ENUM ('ESSENTIAL', 'OPTIONAL');

-- AlterEnum
ALTER TYPE "VerificationPurpose" ADD VALUE 'CHANGE_EMAIL';

-- CreateTable
CREATE TABLE "EmailMessage" (
    "id" TEXT NOT NULL,
    "kind" VARCHAR(64) NOT NULL,
    "category" "EmailCategory" NOT NULL,
    "transport" VARCHAR(16) NOT NULL,
    "userId" TEXT,
    "recipientHash" VARCHAR(64) NOT NULL,
    "recipientMasked" VARCHAR(160) NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "status" "EmailMessageStatus" NOT NULL DEFAULT 'QUEUED',
    "providerMessageId" VARCHAR(255),
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" VARCHAR(200),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailMessage_status_idx" ON "EmailMessage"("status");

-- CreateIndex
CREATE INDEX "EmailMessage_createdAt_idx" ON "EmailMessage"("createdAt");

-- CreateIndex
CREATE INDEX "EmailMessage_userId_kind_createdAt_idx" ON "EmailMessage"("userId", "kind", "createdAt");

-- CreateIndex
CREATE INDEX "EmailMessage_providerMessageId_idx" ON "EmailMessage"("providerMessageId");

