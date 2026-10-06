-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailReminders" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "Participation" ADD COLUMN "reminderSentAt" DATETIME;
