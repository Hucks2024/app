-- Plain column additions. Prisma's own diff rebuilds the whole User table
-- to put the new columns before createdAt, which nothing depends on;
-- adding them in place does the same job without copying every member.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "failedLogins" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "User" ADD COLUMN "lockedUntil" DATETIME;
ALTER TABLE "User" ADD COLUMN "passwordChangedAt" DATETIME;

-- AlterTable
ALTER TABLE "RunActivity" ADD COLUMN "cancelledAt" DATETIME;
