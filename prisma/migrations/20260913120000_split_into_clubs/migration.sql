-- AlterTable
ALTER TABLE "User" ADD COLUMN "club" TEXT NOT NULL DEFAULT 'PACE';

-- AlterTable
ALTER TABLE "RunActivity" ADD COLUMN "club" TEXT NOT NULL DEFAULT 'PACE';

-- DropIndex
-- Both become club-scoped: one address can hold a membership in each club,
-- and each club numbers its members from #1.
DROP INDEX "User_email_key";

-- DropIndex
DROP INDEX "User_memberNumber_key";

-- CreateIndex
CREATE UNIQUE INDEX "User_club_email_key" ON "User"("club", "email");

-- CreateIndex
CREATE UNIQUE INDEX "User_club_memberNumber_key" ON "User"("club", "memberNumber");
