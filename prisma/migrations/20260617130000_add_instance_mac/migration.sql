-- Añade la MAC del PC a Instance (identidad de máquina, ligada al parear).
ALTER TABLE "Instance" ADD COLUMN "mac" TEXT;

-- Índice para buscar instancia por MAC dentro de la firma (activación / dedup).
CREATE INDEX "Instance_firmId_mac_idx" ON "Instance"("firmId", "mac");
