# Design: commission-payment-management

## Context

`Commission` hoy: `status CommissionStatus (PENDING|PAID)`, `paidAt`, `notes` (usado por la atribución manual con el prefijo "Atribución manual"). `/empresa/commissions` usa `requireEmpresa()` (EMPRESA + OPERATOR) y ofrece "Marcar pagada" por fila + bulk. El comercial ve sus comisiones en `/sales/commissions` (solo lectura) y un banner de pendientes en `/sales`. En BD solo existen 2 comisiones, ambas `PENDING` — no hay datos `PAID` que migrar.

El pago real es una transferencia bancaria manual hecha fuera del sistema. El sistema debe reflejar la operativa: saber cuánto y a quién (IBAN) transferir, registrar que se hizo (fecha + referencia) y gestionar incidencias (devoluciones, IBAN erróneo).

## Goals / Non-Goals

**Goals:**

- Listado operativo de pagos: qué está pendiente, a qué IBAN, por cuánto.
- Ciclo de estados que refleje la realidad: pendiente → transferida / incidencia, con vuelta atrás.
- Trazabilidad: fecha, referencia de transferencia y notas de incidencia.
- Disponible para EMPRESA y OPERATOR; el comercial lo ve reflejado.

**Non-Goals:**

- Ejecutar pagos (Stripe Connect u otros) — spec futura.
- Confirmación de cobro por el comercial.
- Export SEPA/CSV para el banco (iteración futura si hay volumen).

## Decisions

### D1 — Enum `PENDING | TRANSFERRED | INCIDENT` (se elimina `PAID`)

Tres estados que mapean 1:1 con la operativa: *pendiente de transferencia*, *transferencia hecha*, *incidencia*. `PAID` se elimina: 0 filas lo usan y "transferida" ES el estado de pagado en esta operativa.

- **Por qué no añadir un cuarto estado "cobrada":** el sistema no puede saber cuándo el comercial recibe el dinero sin que él confirme (fuera de alcance). "Transferida" es el hecho verificable por la empresa.
- **Migración:** recrear el enum sin `PAID` es seguro (sin datos). Actualizar todas las referencias en código (`markPaidAction`, vistas del comercial, atribución manual).

### D2 — Transiciones explícitas con guardas en server actions

`PENDING → TRANSFERRED` (fecha = ahora, `paymentRef` opcional) · `PENDING → INCIDENT` (`paymentNote` obligatoria) · `INCIDENT → PENDING` (reintento; conserva la nota como historial en `paymentNote`) · `INCIDENT → TRANSFERRED` · `TRANSFERRED → INCIDENT` (devolución posterior) · `TRANSFERRED → PENDING` (deshacer un error de marcado).

- **Por qué también `TRANSFERRED → PENDING`:** marcar por error la fila equivocada es el fallo humano más probable; sin vuelta atrás habría que tocar BD a mano.
- Cada action revalida rol (`requireEmpresa`) y valida la transición desde el estado actual (no confiar en el formulario).

### D3 — Campos nuevos mínimos; `paidAt` = fecha de transferencia

`Commission.paymentRef String?` (referencia/concepto de la transferencia bancaria) y `Commission.paymentNote String?` (nota de incidencia u observaciones). Se **reutiliza `paidAt`** como fecha de la transferencia (se anula al volver a PENDING). `notes` queda reservado para la traza de atribución manual (no se mezcla).

- **Por qué separar `paymentNote` de `notes`:** `notes` ya codifica el origen manual (prefijo mágico) y el reverso de atribuciones depende de él; mezclar incidencias ahí rompería esa lógica.

### D4 — IBAN autoservicio: perfil del comercial (`/sales/profile`, página nueva)

`SalesRep.iban String?`. Lo introduce y mantiene el **propio comercial** en su perfil — hoy no existe perfil de comercial, así que se crea `/sales/profile` con entrada "Perfil" en `SalesNav`:

- **Contenido del perfil:** nombre y email (de `User`, solo lectura), territorio y % de comisión (solo lectura — los fija la empresa), e **IBAN editable** + **titular de la cuenta** (puede ser una sociedad, no necesariamente el comercial) con guardado vía server action (`requireSalesRep`, solo el suyo).
- **Ayudas cruzadas:** si el comercial tiene comisiones y no tiene IBAN, `/sales/commissions` muestra un aviso "añade tu IBAN en tu perfil" con enlace; el panel de pagos de empresa muestra "sin IBAN" en sus filas.
- **Por qué en `SalesRep` y no en `User`:** es un dato de la operativa comercial (cobro de comisiones), no de identidad/login.
- **Validación:** formato IBAN básico (longitud/prefijo de país, sin verificación bancaria). Guardar normalizado (sin espacios, mayúsculas).
- EMPRESA/OPERATOR **ven** el IBAN en el panel de pagos pero no lo editan (fuente única: el comercial). Si hiciera falta corrección urgente, es una iteración menor.

### D5 — Panel de pagos en `/empresa/commissions` (sin página nueva)

La página existente se amplía: KPIs por estado (pendiente ámbar / transferida verde / incidencia roja), **filtro por estado** vía searchParam (mismo patrón GET que `/empresa/prospects`), tabla con IBAN + referencia + nota, acciones por fila según transiciones de D2, y bulk "Marcar transferidas" solo sobre las pendientes visibles. La sección de atribución manual (solo OPERATOR) no cambia.

- **Por qué la misma página:** EMPRESA y OPERATOR ya viven ahí; una página nueva duplicaría navegación para el mismo concepto.

### D6 — Vista del comercial: solo relabel

`/sales/commissions`: KPIs pasan a "Pendiente de cobro" (PENDING + INCIDENT) y "Transferido" (TRANSFERRED); la tabla muestra el estado con su color (incidencia en rojo con la nota visible). El banner de `/sales` sigue sumando lo no transferido.

- **Por qué INCIDENT cuenta como pendiente de cobro para el comercial:** desde su punto de vista aún no ha cobrado; la incidencia es un matiz operativo interno con su nota visible.

## Risks / Trade-offs

- [Eliminar `PAID` del enum rompe código que lo referencia] → actualización coordinada en la misma tarea (grep exhaustivo); sin datos que migrar, el riesgo es solo de compilación y lo ataja el typecheck.
- [Reverso de atribución manual tras el cambio] → la guarda pasa de "solo PENDING" a idéntica semántica ("solo PENDING"); INCIDENT/TRANSFERRED no permiten deshacer la atribución (primero volver a PENDING).
- [IBAN sensible en pantalla] → visible solo para EMPRESA/OPERATOR (roles que ya ven todos los datos de comisiones); no se muestra al comercial ni en logs.
- [Bulk "todas transferidas" con filas sin IBAN] → el bulk no exige IBAN (la transferencia se hizo fuera); el IBAN es ayuda operativa, no requisito del estado.

## Open Questions

- ¿Edición del IBAN también por EMPRESA/OPERATOR como corrección de emergencia? (fuente única en el comercial de momento)
- ¿Export CSV/SEPA de las pendientes para carga en el banco? (candidato cuando haya volumen)
- ¿Notificar al comercial por email al marcar TRANSFERRED? (ya anotado como mejora futura general)
- ¿Más campos editables en el perfil del comercial (teléfono, notificaciones)? El perfil nace con IBAN; es la percha natural para crecer.
