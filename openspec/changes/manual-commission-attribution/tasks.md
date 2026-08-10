# Tasks: manual-commission-attribution

## 1. Datos y lógica de atribución

- [x] 1.1 Consultar en `/empresa/commissions` las compras atribuibles: `Purchase` con `status = COMPLETED` y sin `commission` asociada (`commission: null`), orden por `completedAt` desc
- [x] 1.2 Consultar la lista de comerciales activos (`SalesRep` con `status = ACTIVE`, incluyendo `user.name`/`email` y `commissionRate`) para el selector
- [x] 1.3 `attributePurchaseAction(formData)`: `requireOperator()`, leer `purchaseId` + `salesRepId`, validar que la compra existe, está `COMPLETED` y no tiene comisión; crear `Commission` con `rate = salesRep.commissionRate`, `amountCents = round(purchase.amountCents * rate)`, `status = PENDING`, `notes` de traza (email operador + fecha ISO). Capturar violación de `@unique` como no-op

## 2. Reverso

- [x] 2.1 `undoAttributionAction(formData)`: `requireOperator()`, leer `commissionId`, borrar solo si `status = PENDING` y la nota marca origen manual; si está `PAID`, no hacer nada

## 3. UI (solo OPERATOR)

- [x] 3.1 Sección "Compras sin atribuir" en `/empresa/commissions`, renderizada solo si `session.user.role === "OPERATOR"`: tabla con comprador, importe, fecha + `<select>` de comercial + botón "Atribuir"
- [x] 3.2 En el historial de comisiones, añadir botón "Deshacer" en las de origen manual con estado PENDING (junto a "Marcar pagada")
- [x] 3.3 Verificar que el rol EMPRESA no ve ninguna de las dos cosas (sección ni botón de deshacer)

## 4. Verificación

- [x] 4.1 Typecheck (`npx tsc --noEmit`) en verde
- [x] 4.2 Prueba end-to-end: atribuir una compra directa (sin comercial) a un comercial → aparece en `/sales/commissions` del comercial y en los KPIs de `/empresa` → deshacer estando pendiente → la compra vuelve a la lista de sin atribuir
- [x] 4.3 Prueba de guarda: intentar atribuir dos veces la misma compra (doble submit) no crea comisión duplicada; intentar deshacer una comisión PAID no la borra

## 5. Documentación

- [x] 5.1 Actualizar `openspec/funionales.md`: sección de comisiones con la atribución manual (solo OPERATOR) y la nota de que solo son atribuibles compras completadas sin comisión
