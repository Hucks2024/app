-- AlterTable
ALTER TABLE "User" ADD COLUMN "memberNumber" INTEGER;

-- AlterTable
ALTER TABLE "RunActivity" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'RUN';
ALTER TABLE "RunActivity" ADD COLUMN "afterSpot" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_memberNumber_key" ON "User"("memberNumber");
