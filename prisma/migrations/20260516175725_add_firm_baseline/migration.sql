-- CreateEnum
CREATE TYPE "FirmBaselineFileCategory" AS ENUM ('OPENCLAW_CONFIG', 'SKILL', 'WORKSPACE', 'ENTERPRISE', 'OTHER');

-- CreateTable
CREATE TABLE "FirmBaseline" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT,
    "fileCount" INTEGER NOT NULL DEFAULT 0,
    "totalBytes" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "sourceInstanceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FirmBaseline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FirmBaselineFile" (
    "id" TEXT NOT NULL,
    "baselineId" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "category" "FirmBaselineFileCategory" NOT NULL,
    "sha256" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "isBinary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "FirmBaselineFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FirmBaseline_firmId_createdAt_idx" ON "FirmBaseline"("firmId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "FirmBaseline_firmId_version_key" ON "FirmBaseline"("firmId", "version");

-- CreateIndex
CREATE INDEX "FirmBaselineFile_baselineId_idx" ON "FirmBaselineFile"("baselineId");

-- CreateIndex
CREATE UNIQUE INDEX "FirmBaselineFile_baselineId_path_key" ON "FirmBaselineFile"("baselineId", "path");

-- AddForeignKey
ALTER TABLE "FirmBaseline" ADD CONSTRAINT "FirmBaseline_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmBaselineFile" ADD CONSTRAINT "FirmBaselineFile_baselineId_fkey" FOREIGN KEY ("baselineId") REFERENCES "FirmBaseline"("id") ON DELETE CASCADE ON UPDATE CASCADE;
