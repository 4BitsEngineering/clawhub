-- CreateEnum
CREATE TYPE "StackBundleKind" AS ENUM ('OPENCLAW', 'BRIDGE', 'OVERLAY');

-- AlterTable
ALTER TABLE "Firm" ADD COLUMN     "bridgeVersion" TEXT,
ADD COLUMN     "openclawVersion" TEXT,
ADD COLUMN     "overlayId" TEXT,
ADD COLUMN     "overlayVersion" TEXT,
ADD COLUMN     "stackAutoUpdate" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stackChannel" TEXT NOT NULL DEFAULT 'stable';

-- CreateTable
CREATE TABLE "StackBundle" (
    "id" TEXT NOT NULL,
    "kind" "StackBundleKind" NOT NULL,
    "overlayId" TEXT,
    "version" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'stable',
    "sha256" TEXT NOT NULL,
    "downloadUrl" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "releaseNotes" TEXT,
    "sourceCommit" TEXT,
    "buildLog" TEXT,
    "publishedBy" TEXT,
    "releasedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deprecatedAt" TIMESTAMP(3),

    CONSTRAINT "StackBundle_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StackBundle_kind_channel_releasedAt_idx" ON "StackBundle"("kind", "channel", "releasedAt");

-- CreateIndex
CREATE INDEX "StackBundle_overlayId_channel_releasedAt_idx" ON "StackBundle"("overlayId", "channel", "releasedAt");

-- CreateIndex
CREATE UNIQUE INDEX "StackBundle_kind_overlayId_version_channel_key" ON "StackBundle"("kind", "overlayId", "version", "channel");
