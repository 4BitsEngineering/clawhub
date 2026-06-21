-- Kill-switch POR INSTANCIA (distinto de Firm.status). Si disabledAt != NULL,
-- el heartbeat devuelve instance_status:"disabled" y el bridge del cliente
-- bloquea el acceso al software ("contacta con tu proveedor").
ALTER TABLE "Instance" ADD COLUMN "disabledAt" TIMESTAMP(3);
ALTER TABLE "Instance" ADD COLUMN "disabledReason" TEXT;
