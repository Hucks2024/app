-- AlterTable
ALTER TABLE "User" ADD COLUMN "xrpDestinationTag" INTEGER;
ALTER TABLE "User" ADD COLUMN "paidUntil" DATETIME;

-- CreateTable
CREATE TABLE "XrpPayment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "txHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "amountXrp" REAL NOT NULL,
    "amountGbp" REAL NOT NULL,
    "monthsCredited" INTEGER NOT NULL,
    "ledgerCloseAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "XrpPayment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_xrpDestinationTag_key" ON "User"("xrpDestinationTag");

-- CreateIndex
CREATE UNIQUE INDEX "XrpPayment_txHash_key" ON "XrpPayment"("txHash");
