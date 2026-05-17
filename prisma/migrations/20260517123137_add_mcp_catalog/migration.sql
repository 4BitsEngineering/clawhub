-- CreateTable
CREATE TABLE "McpServerCatalog" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "transport" TEXT NOT NULL,
    "launchCommand" TEXT,
    "launchArgs" JSONB,
    "npmPackage" TEXT,
    "requiredEnvVars" JSONB,
    "configurableArgs" JSONB,
    "docsUrl" TEXT,
    "iconEmoji" TEXT,
    "isOfficial" BOOLEAN NOT NULL DEFAULT false,
    "deprecatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "McpServerCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FirmMcpInstall" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "catalogId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "configArgs" JSONB,
    "installedBy" TEXT,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FirmMcpInstall_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "McpServerCatalog_slug_key" ON "McpServerCatalog"("slug");

-- CreateIndex
CREATE INDEX "McpServerCatalog_category_idx" ON "McpServerCatalog"("category");

-- CreateIndex
CREATE INDEX "McpServerCatalog_deprecatedAt_idx" ON "McpServerCatalog"("deprecatedAt");

-- CreateIndex
CREATE INDEX "FirmMcpInstall_firmId_enabled_idx" ON "FirmMcpInstall"("firmId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "FirmMcpInstall_firmId_catalogId_key" ON "FirmMcpInstall"("firmId", "catalogId");

-- AddForeignKey
ALTER TABLE "FirmMcpInstall" ADD CONSTRAINT "FirmMcpInstall_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirmMcpInstall" ADD CONSTRAINT "FirmMcpInstall_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "McpServerCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
