-- DropIndex
-- Back to one member list: unique on email and member number outright,
-- rather than once per club.
DROP INDEX "User_club_email_key";

-- DropIndex
DROP INDEX "User_club_memberNumber_key";

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_memberNumber_key" ON "User"("memberNumber");

-- AlterTable
ALTER TABLE "User" DROP COLUMN "club";

-- AlterTable
ALTER TABLE "RunActivity" DROP COLUMN "club";
