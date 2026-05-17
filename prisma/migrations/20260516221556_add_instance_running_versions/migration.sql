-- AlterTable
ALTER TABLE "Instance" ADD COLUMN     "runningBridgeVersion" TEXT,
ADD COLUMN     "runningOpenclawVersion" TEXT,
ADD COLUMN     "runningOverlayId" TEXT,
ADD COLUMN     "runningOverlayVersion" TEXT;
