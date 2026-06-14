-- AlterTable: kill-switch de suscripción (aditiva, sin reescritura ni reset)
ALTER TABLE "Firm" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN     "suspendedAt" TIMESTAMP(3),
ADD COLUMN     "suspendedReason" TEXT;
