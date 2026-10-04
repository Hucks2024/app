-- AlterTable
ALTER TABLE "User" ADD COLUMN "appleSub" TEXT;
ALTER TABLE "User" ADD COLUMN "googleSub" TEXT;
ALTER TABLE "User" ADD COLUMN "memberVerifiedAt" DATETIME;

-- CreateTable
CREATE TABLE "ThumbsUp" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "activityId" TEXT NOT NULL,
    "fromId" TEXT NOT NULL,
    "toId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ThumbsUp_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "RunActivity" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ThumbsUp_fromId_fkey" FOREIGN KEY ("fromId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ThumbsUp_toId_fkey" FOREIGN KEY ("toId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ThumbsUp_toId_idx" ON "ThumbsUp"("toId");

-- CreateIndex
CREATE UNIQUE INDEX "ThumbsUp_activityId_fromId_toId_key" ON "ThumbsUp"("activityId", "fromId", "toId");

-- CreateIndex
CREATE UNIQUE INDEX "User_appleSub_key" ON "User"("appleSub");

-- CreateIndex
CREATE UNIQUE INDEX "User_googleSub_key" ON "User"("googleSub");

-- Everyone here before signup opened came in on a member's invite code,
-- which is a stronger vouch than one meetup: they start out verified.
UPDATE "User" SET "memberVerifiedAt" = "createdAt" WHERE "memberVerifiedAt" IS NULL;
