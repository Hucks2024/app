-- AlterTable
ALTER TABLE "User" ADD COLUMN "gender" TEXT;

-- AlterTable
ALTER TABLE "RunActivity" ADD COLUMN "forWho" TEXT NOT NULL DEFAULT 'ALL';
