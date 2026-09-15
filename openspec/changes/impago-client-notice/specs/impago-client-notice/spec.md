# Spec: impago-client-notice

## ADDED Requirements

### Requirement: Aviso de impago al cliente

Ante `invoice.payment_failed` de una suscripción de una firma, el sistema SHALL enviar un email al cliente (FIRM_ADMIN) avisando del impago y con enlace para regularizar, además de bloquear los tokens (ya existente). El aviso SHALL ser idempotente por factura.

#### Scenario: Primer impago

- **WHEN** Stripe notifica un impago de la firma
- **THEN** el cliente recibe un email de aviso con enlace a su portal de facturación y sus tokens quedan bloqueados

#### Scenario: Reintentos de Stripe

- **WHEN** Stripe reemite el mismo evento de impago de la misma factura
- **THEN** no se envía un segundo email para esa factura

### Requirement: Aviso de regularización

Cuando una firma bloqueada por impago vuelve a estar al corriente (`invoice.paid` con transición de bloqueada a activa), el sistema SHALL enviar un email de servicio restablecido.

#### Scenario: Cliente regulariza

- **WHEN** llega `invoice.paid` de una firma que estaba bloqueada
- **THEN** se desbloquean los tokens y el cliente recibe un email de confirmación

#### Scenario: Cobro normal sin impago previo

- **WHEN** llega `invoice.paid` de una firma que no estaba bloqueada
- **THEN** no se envía ningún email (es un cobro recurrente normal)
