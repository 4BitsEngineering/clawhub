-- CreateEnum
CREATE TYPE "InstanceCommandStatus" AS ENUM ('PENDING', 'DISPATCHED', 'COMPLETED', 'FAILED', 'EXPIRED');

-- CreateTable
CREATE TABLE "InstanceCommand" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "args" JSONB,
    "status" "InstanceCommandStatus" NOT NULL DEFAULT 'PENDING',
    "result" JSONB,
    "errorMessage" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dispatchedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstanceCommand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InstanceCommand_instanceId_status_idx" ON "InstanceCommand"("instanceId", "status");

-- CreateIndex
CREATE INDEX "InstanceCommand_instanceId_createdAt_idx" ON "InstanceCommand"("instanceId", "createdAt");

-- AddForeignKey
ALTER TABLE "InstanceCommand" ADD CONSTRAINT "InstanceCommand_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
