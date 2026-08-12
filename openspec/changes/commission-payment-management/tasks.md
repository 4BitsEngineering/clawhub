# Tasks: commission-payment-management

## 1. Modelo de datos

- [x] 1.1 `CommissionStatus`: `PENDING | TRANSFERRED | INCIDENT` (eliminar `PAID`; 0 filas lo usan — verificar antes con un count)
- [x] 1.2 `Commission`: añadir `paymentRef String?` y `paymentNote String?` (`paidAt` pasa a documentarse como fecha de transferencia)
- [x] 1.3 `SalesRep`: añadir `iban String?`
- [x] 1.4 `prisma db push` + `prisma generate`; verificar acceso de `service_role` a las columnas nuevas

## 2. Server actions de pago (`/empresa/commissions`)

- [x] 2.1 `markTransferredAction(id, ref?)`: PENDING|INCIDENT → TRANSFERRED, `paidAt = now`, `paymentRef` si se aporta; validar transición desde el estado actual
- [x] 2.2 `markIncidentAction(id, note)`: PENDING|TRANSFERRED → INCIDENT; nota obligatoria en `paymentNote`
- [x] 2.3 `backToPendingAction(id)`: INCIDENT|TRANSFERRED → PENDING; anular `paidAt` (conservar `paymentNote` como historial)
- [x] 2.4 Bulk `markAllTransferredAction()`: todas las PENDING → TRANSFERRED con fecha
- [x] 2.5 Actualizar el reverso de atribución manual: permitido solo en PENDING (semántica intacta tras el cambio de enum)

## 3. Panel de pagos (UI)

- [x] 3.1 KPIs por estado: pendiente (ámbar), transferida (verde), incidencia (rojo)
- [x] 3.2 Filtro por estado vía searchParam (patrón GET de `/empresa/prospects`)
- [x] 3.3 Tabla: añadir columnas IBAN (o "sin IBAN"), referencia y nota; acciones por fila según estado (Transferencia hecha con input de referencia opcional · Incidencia con input de nota · Volver a pendiente)
- [x] 3.4 Bulk "Marcar transferidas (N)" sobre las pendientes

## 4. Perfil del comercial (página nueva) con IBAN

- [x] 4.1 Crear `/sales/profile`: datos del comercial (nombre, email, territorio, % comisión — solo lectura) + formulario de IBAN; server action con `requireSalesRep` que solo edita el propio (`salesRep.userId === session.user.id`)
- [x] 4.2 Normalización (trim, sin espacios, mayúsculas) + validación básica de formato IBAN (país 2 letras + 2 dígitos + longitud razonable); error visible si no valida
- [x] 4.3 Añadir "Perfil" a `SalesNav`
- [x] 4.4 Aviso en `/sales/commissions` si tiene comisiones y no tiene IBAN: "añade tu IBAN en tu perfil" con enlace

## 5. Vista del comercial

- [x] 5.1 `/sales/commissions`: labels y colores de los tres estados; KPI "pendiente de cobro" = PENDING + INCIDENT; mostrar `paymentNote` en incidencias
- [x] 5.2 Banner de `/sales`: pendiente = no transferido (PENDING + INCIDENT)

## 6. Verificación

- [x] 6.1 Typecheck en verde y grep de que no queda ninguna referencia a `PAID`
- [x] 6.2 Prueba de transiciones: todas las permitidas funcionan y las no permitidas se rechazan (incl. incidencia sin nota)
- [x] 6.3 Prueba de roles: EMPRESA gestiona pagos; COMERCIAL solo ve; atribución manual sigue solo-OPERATOR
- [x] 6.4 Prueba del reverso de atribución manual: bloqueado en TRANSFERRED/INCIDENT

## 7. Documentación

- [x] 7.1 Actualizar `openspec/funionales.md`: ciclo de pago por transferencia, IBAN y panel de pagos (EMPRESA + OPERATOR)
