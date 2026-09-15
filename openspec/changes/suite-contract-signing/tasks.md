# Tasks: suite-contract-signing

## 1. Modelo

- [ ] 1.1 `ContractTemplate` y `SuiteContract` (@@unique suiteId+templateVersion)
- [ ] 1.2 `prisma db push` + `generate` + reiniciar dev server

## 2. Gating

- [ ] 2.1 `requireSignedSuite()` en el layout del panel de Suite (excepto /suite/contrato y logout)

## 3. Firma

- [ ] 3.1 Pantalla `/suite/contrato` (AI-Office): texto completo + casilla + nombre + botón Firmar
- [ ] 3.2 `signContractAction`: registrar firma (ipHash, userAgent), @@unique anti-doble
- [ ] 3.3 Generar PDF (HTML→PDF pura JS) y subir a Storage; firma no bloquea si el PDF falla

## 4. Operator

- [ ] 4.1 CRUD del ContractTemplate (editar/publicar versión)
- [ ] 4.2 Detalle de Suite: estado de firma + descarga del PDF

## 5. Verificación

- [ ] 5.1 `tsc` + render de /suite/contrato y del gate (redirección)
- [ ] 5.2 Ciclo: Suite nueva → firma → PDF guardado → acceso desbloqueado → no re-pide
- [ ] 5.3 Operator ve estado y descarga el PDF
