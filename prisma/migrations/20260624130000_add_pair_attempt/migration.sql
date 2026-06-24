-- Task: rate-limiting del endpoint /api/v0/pair por IP (anti fuerza bruta).
-- Registra cada intento FALLIDO (código no encontrado, ya usado o expirado)
-- en PairAttempt. El endpoint cuenta los fallos en ventana de 15 min y
-- devuelve 429 si se superan los 10 intentos. La IP se guarda hasheada
-- (SHA-256 hex) para no almacenar datos personales en claro.

-- CreateTable
CREATE TABLE "PairAttempt" (
    "id" TEXT NOT NULL,
    "ipHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PairAttempt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PairAttempt_ipHash_createdAt_idx" ON "PairAttempt"("ipHash", "createdAt");
