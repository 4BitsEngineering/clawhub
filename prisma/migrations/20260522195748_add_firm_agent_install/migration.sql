-- CreateTable
CREATE TABLE "FirmAgentInstall" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "catalogId" TEXT NOT NULL,
    "agentKey" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "color" TEXT,
    "icon" TEXT,
    "voiceKind" TEXT,
    "elevenlabsId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "installedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FirmAgentInstall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FirmAgentInstall_firmId_sortOrder_idx" ON "FirmAgentInstall"("firmId", "sortOrder");

-- CreateIndex
CREATE INDEX "FirmAgentInstall_catalogId_idx" ON "FirmAgentInstall"("catalogId");

-- CreateIndex
CREATE UNIQUE INDEX "FirmAgentInstall_firmId_slug_key" ON "FirmAgentInstall"("firmId", "slug");

-- AddForeignKey
ALTER TABLE "FirmAgentInstall" ADD CONSTRAINT "FirmAgentInstall_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmAgentInstall" ADD CONSTRAINT "FirmAgentInstall_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "AgentCatalogEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
