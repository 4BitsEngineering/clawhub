-- CreateTable
CREATE TABLE "UsageRecord" (
    "id" TEXT NOT NULL,
    "spanId" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "runId" TEXT,
    "taskLabel" TEXT,
    "model" TEXT,
    "provider" TEXT,
    "status" TEXT,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "cacheReadTokens" INTEGER,
    "cacheWriteTokens" INTEGER,
    "costUsd" DOUBLE PRECISION,
    "turnCount" INTEGER,
    "tokensSource" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "durationMs" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UsageRecord_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UsageRecord_firmId_endTime_idx" ON "UsageRecord"("firmId", "endTime");

-- CreateIndex
CREATE INDEX "UsageRecord_instanceId_endTime_idx" ON "UsageRecord"("instanceId", "endTime");

-- CreateIndex
CREATE INDEX "UsageRecord_firmId_agentId_endTime_idx" ON "UsageRecord"("firmId", "agentId", "endTime");

-- CreateIndex
CREATE UNIQUE INDEX "UsageRecord_instanceId_spanId_key" ON "UsageRecord"("instanceId", "spanId");

-- AddForeignKey
ALTER TABLE "UsageRecord" ADD CONSTRAINT "UsageRecord_instanceId_fkey" FOREIGN KEY ("instanceId") REFERENCES "Instance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
