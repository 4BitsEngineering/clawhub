# Proposal: commission-payment-management

## Why

Las comisiones se pagan por **transferencia bancaria manual** (sin Stripe): alguien de la empresa entra al banco, hace la transferencia al comercial y necesita reflejarlo en el panel. Hoy el ciclo de pago es binario (`PENDING`/`PAID` con un botón "Marcar pagada"), lo que no refleja la operativa real: no hay forma de registrar la **referencia de la transferencia**, de marcar una **incidencia** (transferencia devuelta, IBAN erróneo, disputa) ni de saber **a qué cuenta** transferir (el IBAN del comercial no existe en el sistema).

## What Changes

- El ciclo de pago pasa a tres estados: **PENDIENTE** (`PENDING`), **TRANSFERIDA** (`TRANSFERRED`, con fecha y referencia opcional) e **INCIDENCIA** (`INCIDENT`, con nota obligatoria). El estado `PAID` desaparece del enum (no hay datos que lo usen).
- Transiciones: `PENDING → TRANSFERRED` (transferencia hecha) · `PENDING → INCIDENT` · `INCIDENT → PENDING` (reintentar) · `INCIDENT → TRANSFERRED` · `TRANSFERRED → INCIDENT` (p. ej. devolución bancaria posterior).
- `/empresa/commissions` (roles **EMPRESA y OPERATOR**) se convierte en el **panel de pagos**: filtro por estado, listado con IBAN del comercial (para copiar al hacer la transferencia), acciones por fila según estado, referencia y notas visibles, y acción bulk "marcar transferidas" para las pendientes.
- Se añade el **IBAN del comercial** (`SalesRep.iban`): lo introduce el **propio comercial** en su **perfil** — página nueva `/sales/profile` (no existe perfil de comercial hoy), con sus datos (nombre, email, territorio, % de comisión en solo lectura) y el IBAN editable. El panel de pagos lo muestra a EMPRESA/OPERATOR para hacer la transferencia.
- La vista del comercial (`/sales/commissions`) refleja los estados nuevos (Pendiente / Transferida / Incidencia) en KPIs y tabla, solo lectura como hasta ahora.

## Capabilities

### New Capabilities

- `commission-payment-management`: gestión del pago de comisiones por transferencia bancaria — estados PENDIENTE/TRANSFERIDA/INCIDENCIA con transiciones, referencia de transferencia, notas de incidencia, IBAN del comercial y panel de pagos para EMPRESA y OPERATOR.

### Modified Capabilities

<!-- Ajusta manual-commission-attribution: el reverso de una atribución manual
     sigue permitido solo en estado PENDING (antes "no PAID"; ahora "no
     TRANSFERRED ni INCIDENT"). -->

## Impact

- **Código afectado:**
  - `src/app/empresa/commissions/page.tsx` — panel de pagos completo (filtro, IBAN, acciones por estado, bulk).
  - `src/app/sales/profile/page.tsx` (**nueva**) — perfil del comercial con IBAN editable; `src/components/sales-nav.tsx` — entrada "Perfil".
  - `src/app/sales/commissions/page.tsx` y banner de `/sales` — labels/KPIs con los estados nuevos (+ aviso "añade tu IBAN" si falta).
  - Webhook y atribución manual — sin cambios de lógica (siguen creando `PENDING`).
- **Modelo de datos (migración aditiva salvo el enum):**
  - `CommissionStatus`: `PENDING | TRANSFERRED | INCIDENT` (se elimina `PAID`; 0 filas lo usan).
  - `Commission`: `paymentRef String?` (referencia de la transferencia), `paymentNote String?` (nota de incidencia/observaciones). `paidAt` se conserva como **fecha de la transferencia**.
  - `SalesRep`: `iban String?`.
- **Roles:** gestión de pagos para `EMPRESA` y `OPERATOR` (la página ya usa `requireEmpresa`, que admite ambos). El comercial solo ve.
- **Fuera de alcance:** pagos vía Stripe Connect (anotado como spec futura); confirmación de cobro por parte del comercial; export CSV/SEPA (candidato a iteración); validación bancaria del IBAN más allá del formato.
