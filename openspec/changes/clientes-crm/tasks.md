# Tasks: clientes-crm

## 1. Rename de modelo

- [ ] 1.1 `Prospect` → `Cliente` con `@@map("Prospect")`; `ProspectStatus` → `ClienteStatus`
- [ ] 1.2 `Cliente.suiteId` (consolida el reapunte de suites-and-zones)
- [ ] 1.3 Barrer referencias en código (`db.prospect`→`db.cliente`, tipos, imports); `tsc` limpio
- [ ] 1.4 `prisma db push` + `generate` + reiniciar dev server (webhook Deno intacto: usa la tabla física "Prospect")

## 2. Alta manual

- [ ] 2.1 Formulario de alta en `/sales` con teléfono obligatorio, scope a la Suite de la sesión

## 3. Import Excel/CSV

- [ ] 3.1 Parser server-side (`xlsx` + CSV), mapeo laxo de cabeceras, tope de filas
- [ ] 3.2 Previsualización: válidas / con error / duplicadas (dedupe por (suiteId, email))
- [ ] 3.3 Confirmación → createMany sobre la Suite (estado NEW); fichero no se persiste

## 4. Visibilidad

- [ ] 4.1 Cartera de la Suite filtra por suiteId; badge "sin teléfono" para migrados incompletos
- [ ] 4.2 OPERATOR/EMPRESA ven todas

## 5. Verificación

- [ ] 5.1 `tsc` + render de alta e import (previsualización)
- [ ] 5.2 Import de Excel real: recuentos correctos, dedupe, re-subida idempotente
- [ ] 5.3 Compra de un Cliente → Firm creado y estado PURCHASED (flujo intacto)
