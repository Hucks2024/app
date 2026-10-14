-- CreateIndex
CREATE INDEX "Participation_userId_idx" ON "Participation"("userId");

-- CreateIndex
CREATE INDEX "Report_reportedUserId_idx" ON "Report"("reportedUserId");

-- CreateIndex
CREATE INDEX "RunActivity_startsAt_idx" ON "RunActivity"("startsAt");

-- CreateIndex
CREATE INDEX "RunActivity_hostId_idx" ON "RunActivity"("hostId");
