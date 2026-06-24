-- Task 13: distribución multi-OS del instalador. Añade `platform` a StackBundle
-- para distinguir el INSTALLER de Windows ("windows") del de macOS ("darwin"),
-- etc. NULLABLE para no romper registros legacy; el código (register/route.ts)
-- defaultea a "windows" los nuevos INSTALLER sin platform, y el endpoint
-- /api/v0/installer filtra por platform (detectado por query o user-agent).

-- AddColumn (nullable → compat con filas existentes, que quedan platform=NULL)
ALTER TABLE "StackBundle" ADD COLUMN "platform" TEXT;

-- Backfill: los INSTALLER existentes eran todos de Windows. Esto preserva la
-- idempotencia del workflow de Windows (su register busca platform="windows").
UPDATE "StackBundle" SET "platform" = 'windows' WHERE "kind" = 'INSTALLER' AND "platform" IS NULL;

-- El unique pasa a incluir platform: dos INSTALLER misma version/channel pero
-- distinto SO conviven. Se recrea el UNIQUE INDEX (Prisma lo materializa así).
DROP INDEX "StackBundle_kind_overlayId_version_channel_key";
CREATE UNIQUE INDEX "StackBundle_kind_overlayId_version_channel_platform_key" ON "StackBundle"("kind", "overlayId", "version", "channel", "platform");

-- Índice de lectura para /api/v0/installer (filtra por kind+channel+platform,
-- ordena por releasedAt desc).
CREATE INDEX "StackBundle_kind_channel_platform_releasedAt_idx" ON "StackBundle"("kind", "channel", "platform", "releasedAt");
