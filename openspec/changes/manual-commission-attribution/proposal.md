# Proposal: manual-commission-attribution

## Why

Hoy una `Commission` solo se crea automáticamente desde la Edge Function de Stripe cuando la compra llega con atribución (el `trackingToken` de un link de campaña resuelve a `prospect.salesRepId`). Toda venta que no pasó por un link de comercial —cierre telefónico, presencial, o un cliente que compró directo en la landing pero al que un comercial trajo por otra vía— queda **sin comisión y sin forma de asignarla**. El comercial no la ve en `/sales/commissions` y la empresa no puede reconocer su trabajo.

La página `/empresa/commissions` solo permite marcar como pagada o liquidar en bulk; no crea ni reasigna atribuciones.

## What Changes

- El **administrador (OPERATOR)** puede atribuir manualmente una `Purchase` ya existente y completada a un comercial, generando su `Commission`.
- La atribución reutiliza la misma lógica de cálculo que el webhook: `amountCents = purchase.amountCents`, `rate = salesRep.commissionRate`, `amountCents_comisión = round(purchase.amountCents * rate)`, `status = PENDING`.
- Solo son atribuibles las compras **`COMPLETED` que aún no tienen `Commission`** (la relación `Commission.purchaseId` es `@unique`): no se duplican comisiones ni se pisan las automáticas.
- La comisión creada a mano se marca como tal en el campo `notes` (traza de auditoría: quién y cuándo).
- El administrador puede **deshacer** una atribución manual mientras la comisión siga `PENDING` (corrige errores de asignación).
- Restricción de acceso: la funcionalidad es **exclusiva de OPERATOR**, coherente con campañas y landing.

## Capabilities

### New Capabilities

- `manual-commission-attribution`: atribución manual, por parte del administrador, de compras ya existentes a un comercial — creación de la `Commission` con la tarifa vigente del comercial, guarda de unicidad por compra, y reverso mientras esté pendiente.

### Modified Capabilities

<!-- Ninguna: no existen specs previos de comisiones en openspec/specs/. -->

## Impact

- **Código afectado:**
  - `src/app/empresa/commissions/page.tsx` — nueva sección "Compras sin atribuir" (solo OPERATOR) con selector de comercial por fila + acción de atribución; acción de deshacer en comisiones manuales pendientes.
  - Posible helper compartido para el cálculo de comisión (unificar con la lógica del webhook, documentando que viven en runtimes distintos —Next.js vs Deno— y no comparten código).
- **Modelo de datos:** sin migración. Se usa `Commission.notes` (ya existe) para la traza. No se toca `Purchase` ni `Prospect`.
- **Roles:** solo `OPERATOR`. El rol `EMPRESA` sigue viendo y liquidando comisiones pero no atribuye.
- **Fuera de alcance:** registrar ventas que nunca pasaron por Stripe (creación de `Purchase` manual) — aparcado, no descartado. Reasignar comisiones ya pagadas. Override manual de la tarifa.
