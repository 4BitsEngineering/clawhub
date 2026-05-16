-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL,
    "firmId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3),

    CONSTRAINT "Skill_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Skill_firmId_idx" ON "Skill"("firmId");

-- CreateIndex
CREATE INDEX "Skill_firmId_active_idx" ON "Skill"("firmId", "active");

-- CreateIndex
CREATE UNIQUE INDEX "Skill_firmId_slug_key" ON "Skill"("firmId", "slug");

-- AddForeignKey
ALTER TABLE "Skill" ADD CONSTRAINT "Skill_firmId_fkey" FOREIGN KEY ("firmId") REFERENCES "Firm"("id") ON DELETE CASCADE ON UPDATE CASCADE;
