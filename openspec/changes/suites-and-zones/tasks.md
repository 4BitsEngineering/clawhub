# Tasks: suites-and-zones

## 1. Modelo de datos

- [ ] 1.1 `Zone`, `Suite` (+ enum `SuiteType`), `User.suiteId`, `Firm.suiteId`; columna sombra `Prospect.legacySalesRepId` para revertir
- [ ] 1.2 Reapuntar `Prospect.salesRepId`→`suiteId`, `Commission.salesRepId`→`suiteId` (mantener sombra una release)
- [ ] 1.3 `prisma db push` + `generate` + reiniciar dev server

## 2. Migración de datos (script idempotente, probar en local primero)

- [ ] 2.1 Por cada SalesRep → Suite (rate/iban/holder), territory → Zone, `User.suiteId`
- [ ] 2.2 Recablear Prospect y Commission a la Suite; conservar sombra
- [ ] 2.3 Verificar recuento antes/después (nº prospects, comisiones, importes)

## 3. Backend / permisos

- [ ] 3.1 Helpers de sesión: `requireSuiteUser()` (suiteId != null), gating por capacidad
- [ ] 3.2 Server actions con revalidación de `suiteId` (anti-IDOR)

## 4. Operator / Empresa (gestión)

- [ ] 4.1 CRUD de Zonas
- [ ] 4.2 CRUD de Suites (asignar Zona, tipo, teléfono, comisión, IBAN)
- [ ] 4.3 Acción "Convertir cliente en Suite" en el detalle de Firm (idempotente)

## 5. Perfil de Suite (self-service)

- [ ] 5.1 Pantalla de perfil: teléfono (obligatorio) + datos de facturación + IBAN/titular
- [ ] 5.2 Re-scope del panel comercial `/sales` a la Suite

## 6. Verificación

- [ ] 6.1 `tsc` + render de gestión (operator) y perfil (suite user)
- [ ] 6.2 Migración en local: comercial real → Suite, comisiones intactas
- [ ] 6.3 Aislamiento entre Suites (IDOR) y promoción cliente→Suite idempotente
