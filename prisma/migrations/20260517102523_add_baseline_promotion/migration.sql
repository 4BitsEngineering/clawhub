-- AlterTable
ALTER TABLE "FirmBaseline" ADD COLUMN     "isPromoted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "promotedAt" TIMESTAMP(3),
ADD COLUMN     "promotedBy" TEXT;

-- CreateIndex
CREATE INDEX "FirmBaseline_firmId_isPromoted_idx" ON "FirmBaseline"("firmId", "isPromoted");
