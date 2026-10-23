-- CreateTable
CREATE TABLE "DeletedEmail" (
    "emailHash" TEXT NOT NULL PRIMARY KEY,
    "gender" TEXT NOT NULL,
    "deletedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
