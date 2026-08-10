# Design: manual-commission-attribution

## Context

La comisión se modela en `Commission` (schema `clawhub`): `purchaseId @unique`, `salesRepId`, `rate`, `amountCents`, `status` (PENDING/PAID), `notes?`, `createdAt`. La relación con `Purchase` es 1:1 (`@unique`) con `onDelete: Restrict`.

La atribución automática vive en la Edge Function (`supabase/functions/stripe-webhook/index.ts`): resuelve `trackingToken → CampaignSend.prospectId → Prospect.salesRepId`, lee `SalesRep.commissionRate` y crea la `Commission` con `amountCents = round(purchase.amountCents * rate)`.

`Purchase` NO tiene `salesRepId` directo — la atribución "vive" en la existencia de la `Commission`. La vista del comercial (`/sales/commissions`) lee `salesRep.commissions` directamente, así que **crear la `Commission` es suficiente** para que el comercial vea la venta; no hay que tocar `Prospect` ni `Purchase`.

Solo el `OPERATOR` administra contenido de ventas (campañas, landing ya restringidas). `/empresa/commissions` hoy usa `requireEmpresa` (EMPRESA + OPERATOR) para ver y liquidar.

## Goals / Non-Goals

**Goals:**

- El OPERATOR atribuye una compra completada y sin comisión a un comercial en un clic.
- La comisión resultante es indistinguible de una automática para el comercial, salvo por la nota de traza.
- Imposible duplicar comisión sobre una misma compra.
- Reverso de una atribución manual mientras esté pendiente.

**Non-Goals:**

- Crear `Purchase` que nunca pasó por Stripe (ventas 100% offline) — aparcado.
- Reasignar/editar comisiones ya `PAID`.
- Override manual de la tarifa (se usa la vigente del comercial).
- Cambiar quién liquida (sigue EMPRESA + OPERATOR marcando pagadas).

## Decisions

### D1 — Atribución = crear la `Commission`, sin tocar `Purchase` ni `Prospect`

La acción crea únicamente la fila `Commission`. No se escribe `salesRepId` en `Purchase` (no existe) ni se reasigna el `Prospect`.

- **Por qué:** la vista del comercial y los KPIs de empresa ya derivan de `Commission`/`salesRep.commissions`. Añadir mutaciones a `Prospect` acoplaría conceptos (un prospect puede tener varias compras) y abriría inconsistencias.
- **Alternativa descartada:** setear `Prospect.salesRepId` además de crear la comisión — innecesario y con efectos colaterales en el pipeline del comercial.

### D2 — Solo compras `COMPLETED` sin `Commission` son atribuibles

La sección lista `Purchase` con `status = COMPLETED` y sin `commission` asociada. La guarda de unicidad (`Commission.purchaseId @unique`) es la red de seguridad ante doble submit.

- **Por qué:** una compra pendiente/fallida no genera ingreso; una ya atribuida (automática o manual) no debe duplicarse. El `@unique` hace la operación idempotente a nivel BD.

### D3 — Tarifa = `SalesRep.commissionRate` vigente, cálculo replicado del webhook

`amountCents = round(purchase.amountCents * salesRep.commissionRate)`, `rate = salesRep.commissionRate`, `status = PENDING`.

- **Por qué:** consistencia total con la atribución automática; el operador no decide números, solo el "quién".
- **Nota:** la fórmula se replica en Next.js (la del webhook está en Deno y no se puede importar). Comentario cruzado en ambos sitios; si cambia la fórmula, actualizar los dos.

### D4 — Traza en `Commission.notes`

Se guarda una nota tipo `Atribución manual · <email operador> · <fecha ISO>`.

- **Por qué:** distingue comisiones manuales de automáticas para auditoría y para permitir el reverso seguro (D5) sin un campo/enum nuevo. `notes` ya existe en el modelo.
- **Alternativa descartada:** añadir un campo `source`/`manual` al modelo — requiere migración para un dato que la nota ya cubre.

### D5 — Reverso permitido solo si `PENDING`

El OPERATOR puede eliminar una comisión de atribución manual mientras esté `PENDING`. Una vez `PAID`, no.

- **Por qué:** corregir un error de asignación es habitual antes de liquidar; borrar una ya pagada descuadraría la contabilidad. `onDelete: Restrict` en la relación no bloquea borrar la `Commission` (bloquea borrar la `Purchase`), así que el delete es seguro.
- **Nota:** el reverso se ofrece sobre comisiones cuya `notes` marca origen manual; no se borran las automáticas desde aquí.

### D6 — Ubicación: sección en `/empresa/commissions`, gated a OPERATOR

Se añade una sección "Compras sin atribuir" en la página existente, visible solo si `session.user.role === "OPERATOR"`. Las server actions revalidan el rol con `requireOperator()`.

- **Por qué:** el admin ya gestiona comisiones ahí; evita una página nueva. Doble protección (render + action) como en campañas/landing.

## Risks / Trade-offs

- [Doble submit crea dos comisiones] → mitigado por `Commission.purchaseId @unique`: el segundo insert falla; capturar y tratar como no-op.
- [El comercial ve una venta "nueva" sin contexto] → la nota de traza y la fecha de la compra dan contexto; el comercial ya entiende su histórico de comisiones.
- [Tarifa cambia entre la venta y la atribución manual] → se usa la tarifa vigente al atribuir (igual que si se hubiera atribuido tarde de forma automática); documentado como comportamiento esperado.
- [Fórmula duplicada Next.js/Deno] → comentario cruzado; riesgo bajo (fórmula estable de una línea).

## Open Questions

- ¿Permitir en el futuro un override de la tarifa por atribución (comisiones especiales)? Fuera de alcance ahora; encaja si más adelante entra la opción B (ventas offline).
- ¿Filtro/búsqueda en la lista de compras sin atribuir si crece mucho? De momento orden por fecha desc; paginar si hiciera falta.
