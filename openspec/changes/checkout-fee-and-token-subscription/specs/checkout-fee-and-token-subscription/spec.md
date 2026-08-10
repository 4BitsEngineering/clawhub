# checkout-fee-and-token-subscription

## ADDED Requirements

### Requirement: Selección del periodo de tokens antes de pagar
La landing pública `/oferta/[slug]` SHALL permitir al cliente elegir el periodo de facturación de tokens (mensual, trimestral, semestral o anual) antes de iniciar el pago, mostrando el precio de cada periodo y el desglose entre fee y primer cobro de tokens.

#### Scenario: El cliente ve y elige el periodo
- **WHEN** un cliente abre la landing con el checkout habilitado
- **THEN** ve las cuatro opciones de periodo con su importe (múltiplo exacto de `tokenMonthlyPriceCents`) y no puede continuar al pago sin una opción seleccionada

#### Scenario: Desglose visible
- **WHEN** el cliente selecciona un periodo
- **THEN** la landing muestra el fee del primer año y el importe del primer periodo de tokens que se cobrarán

### Requirement: Checkout de fee anual + suscripción de tokens
Al iniciar el pago, el sistema SHALL crear una única Checkout Session de Stripe que cobre en la primera factura el fee del primer año (precio con descuento) y la primera factura de tokens del periodo elegido, y que deje activas la renovación anual del fee (a precio de lista) y la renovación de tokens en su periodo.

#### Scenario: Un solo pago inicial visible
- **WHEN** el cliente confirma el pago
- **THEN** en una sola sesión de checkout autoriza el importe total = fee primer año + primer periodo de tokens

#### Scenario: Una sola interacción del cliente pese a dos suscripciones
- **WHEN** se completa la compra y el sistema deja activas la suscripción de tokens y la renovación anual del fee
- **THEN** el cliente ha introducido la tarjeta y autorizado el pago una única vez; la creación de la suscripción de renovación del fee no le presenta ninguna pantalla ni cobro adicional

#### Scenario: Periodo no ofrecido rechazado
- **WHEN** llega una solicitud de checkout con un periodo de tokens que el administrador no tiene habilitado
- **THEN** el sistema no crea la sesión de pago

#### Scenario: Renovaciones programadas
- **WHEN** el checkout se completa
- **THEN** existe una suscripción de tokens que renueva en el periodo elegido y una renovación anual del fee programada a precio de lista que no cobra nada en el momento de la compra

#### Scenario: Sin claves de Stripe el checkout está deshabilitado
- **WHEN** `STRIPE_SECRET_KEY` no está configurada
- **THEN** la landing muestra el botón de compra deshabilitado y no se crea ninguna sesión (comportamiento actual conservado)

### Requirement: Comisión calculada solo sobre el fee
El sistema SHALL calcular la comisión del comercial únicamente sobre el importe del fee pagado (`Purchase.feeAmountCents`), excluyendo el importe de tokens, y SHALL NOT generar comisión por las renovaciones.

#### Scenario: La comisión ignora los tokens
- **WHEN** una compra atribuida a un comercial se completa con fee 149€ y tokens 60€ (trimestral)
- **THEN** la comisión creada es `round(149€ * rate)` y en ningún caso incluye los 60€ de tokens

#### Scenario: Las renovaciones no generan comisión
- **WHEN** se cobra una renovación del fee o de los tokens en el futuro
- **THEN** no se crea ninguna comisión nueva por ese cobro

#### Scenario: Atribución manual usa la misma base
- **WHEN** el administrador atribuye manualmente una compra a un comercial
- **THEN** la comisión se calcula sobre `feeAmountCents` de esa compra, no sobre el total cobrado

### Requirement: Registro de importes y suscripciones de la compra
Al procesar la compra, el sistema SHALL registrar en `Purchase` el importe del fee (`feeAmountCents`), el periodo de tokens (`tokenBillingPeriod`), el importe de tokens (`tokenAmountCents`) y los identificadores de suscripción de Stripe (tokens y fee).

#### Scenario: Datos persistidos tras la compra
- **WHEN** el webhook procesa `checkout.session.completed`
- **THEN** la `Purchase` queda con `feeAmountCents`, `tokenBillingPeriod`, `tokenAmountCents` y los IDs de las suscripciones de tokens y de fee

#### Scenario: Idempotencia conservada
- **WHEN** Stripe reenvía el mismo evento de compra
- **THEN** no se crean compras, comisiones ni suscripciones de fee duplicadas

### Requirement: Configuración de precios por el administrador
El administrador (`OPERATOR`) SHALL poder configurar el precio de renovación del fee, el descuento del primer año (en importe absoluto o en porcentaje), el precio mensual de tokens y qué periodos de tokens se ofrecen, desde el editor de landing; el rol EMPRESA no SHALL tener acceso a esta configuración.

#### Scenario: Editar precios del fee y de tokens
- **WHEN** el OPERATOR guarda el editor de landing con precio de renovación, descuento del primer año y precio mensual de tokens
- **THEN** la landing pública y el checkout usan esos importes (fee primer año, fee renovación y tokens = precio mensual × meses del periodo)

#### Scenario: Descuento en porcentaje
- **WHEN** el OPERATOR configura el descuento del primer año como un porcentaje sobre el precio de renovación
- **THEN** el precio efectivo del primer año se calcula desde ese porcentaje y se usa como importe cobrado y como base de comisión

#### Scenario: Periodos de tokens ofrecidos
- **WHEN** el OPERATOR habilita solo un subconjunto de periodos (p. ej. semestral y anual)
- **THEN** la landing pública muestra únicamente esos periodos y el checkout solo acepta uno de ellos

#### Scenario: EMPRESA no configura precios
- **WHEN** un usuario con rol `EMPRESA` intenta acceder al editor de landing
- **THEN** no puede ver ni modificar la configuración de precios (restricción existente conservada)
