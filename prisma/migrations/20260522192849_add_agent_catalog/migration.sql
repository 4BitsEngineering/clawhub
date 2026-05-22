-- CreateTable
CREATE TABLE "AgentCatalogEntry" (
    "id" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL DEFAULT 'clawcrew',
    "agentKey" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "description" TEXT NOT NULL,
    "defaults" JSONB NOT NULL,
    "presentation" JSONB,
    "portraitUrl" TEXT,
    "keywords" JSONB,
    "compatibleOverlays" JSONB,
    "manifest" JSONB NOT NULL,
    "sourceCommit" TEXT,
    "deprecatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "indexedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentCatalogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OfficeTemplate" (
    "id" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT,
    "description" TEXT,
    "agentKeys" JSONB NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "recommended" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OfficeTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentCatalogEntry_role_idx" ON "AgentCatalogEntry"("role");

-- CreateIndex
CREATE INDEX "AgentCatalogEntry_category_idx" ON "AgentCatalogEntry"("category");

-- CreateIndex
CREATE INDEX "AgentCatalogEntry_deprecatedAt_idx" ON "AgentCatalogEntry"("deprecatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "AgentCatalogEntry_libraryId_agentKey_key" ON "AgentCatalogEntry"("libraryId", "agentKey");

-- CreateIndex
CREATE UNIQUE INDEX "OfficeTemplate_sector_key" ON "OfficeTemplate"("sector");

-- CreateIndex
CREATE INDEX "OfficeTemplate_active_sortOrder_idx" ON "OfficeTemplate"("active", "sortOrder");
