-- AlterTable
ALTER TABLE "PairingToken" ADD COLUMN     "existingInstanceId" TEXT;

-- CreateIndex
CREATE INDEX "PairingToken_existingInstanceId_idx" ON "PairingToken"("existingInstanceId");
