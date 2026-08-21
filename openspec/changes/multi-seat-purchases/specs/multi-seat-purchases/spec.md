# Spec: multi-seat-purchases

## ADDED Requirements

### Requirement: Cantidad de equipos en la compra

Las landings SHALL ofrecer un selector de cantidad (1–10) y el checkout SHALL cobrar cuota × N como quantity del line item, registrando `Purchase.seats` y `Firm.seatsPurchased = N`.

#### Scenario: Compra de 3 equipos Todo incluido

- **WHEN** el comprador elige 3 equipos, periodo mensual, y paga
- **THEN** Stripe cobra 3 × cuota mensual, la firma nace con seatsPurchased = 3 y el portal permite generar hasta 3 códigos de activación

#### Scenario: Comisión sobre venta multi-seat

- **WHEN** una compra atribuida a un comercial tiene 3 seats
- **THEN** la comisión se calcula sobre la componente software efectiva × 3

### Requirement: CIF/NIF obligatorio en el checkout

El formulario de compra SHALL exigir CIF/NIF (validación laxa de formato, normalizado) y persistirlo en `Purchase.buyerTaxId`; la primera compra de una firma SHALL fijar `Firm.taxId`.

#### Scenario: Compra sin CIF/NIF

- **WHEN** el comprador envía el formulario sin CIF/NIF
- **THEN** vuelve a la sección de precios con un aviso y no se crea sesión de Stripe

#### Scenario: Autónomo con NIF

- **WHEN** el comprador introduce un NIF de persona física (p. ej. 12345678Z)
- **THEN** la compra procede y el NIF queda visible para el operator en el detalle de la compra

### Requirement: Ampliación de equipos sobre firma existente

Una compra con `metadata.firmId` (botón "Ampliar equipos" de /firm), o con email de un FIRM_ADMIN existente y misma modalidad, SHALL sumar seats a la firma existente en lugar de crear una nueva, heredando modalidad y equipo de agentes.

#### Scenario: Ampliación desde el portal

- **WHEN** un firm_admin con 2 seats compra 2 más desde "Ampliar equipos"
- **THEN** la firma pasa a seatsPurchased = 4, la compra queda registrada sobre esa firma y recibe email con código para activar los equipos nuevos

#### Scenario: Recompra orgánica con mismo email y modalidad

- **WHEN** el mismo comprador vuelve a la landing y compra 1 equipo más con la misma modalidad
- **THEN** se trata como ampliación de su firma (no se crea firma duplicada)

#### Scenario: Idempotencia ante reintentos del webhook

- **WHEN** Stripe reentrega el evento de una ampliación ya procesada
- **THEN** los seats no se suman dos veces (idempotencia por stripeSessionId)
