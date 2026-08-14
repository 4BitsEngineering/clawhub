# unified-pricing-token-options

## ADDED Requirements

### Requirement: Elección de modalidad de tokens
La landing SHALL ofrecer dos modalidades antes de pagar: **tokens incluidos** (precio unificado software+tokens) o **tokens externos** (el cliente usa su propio proveedor LLM y paga solo el software). La modalidad elegida SHALL registrarse en la compra (`tokenProvision`).

#### Scenario: Cliente elige tokens incluidos
- **WHEN** el cliente selecciona «Tokens incluidos» y un periodo de pago
- **THEN** el checkout cobra la cuota unificada del periodo y la compra queda registrada como BUNDLED

#### Scenario: Cliente elige tokens externos
- **WHEN** el cliente selecciona «Mi propio proveedor de IA»
- **THEN** el checkout cobra solo el software con pago anual y la compra queda registrada como EXTERNAL

### Requirement: Precio unificado sin desglose visible
En la modalidad de tokens incluidos, el precio SHALL presentarse y cobrarse como **una única cifra por periodo** (total anual = software efectivo + tokens×12, dividido entre los pagos del año). La landing y el checkout NO SHALL mostrar el desglose software/tokens al cliente.

#### Scenario: Cuotas por periodo con los precios por defecto
- **WHEN** el software es 200 € y los tokens 20 €/mes
- **THEN** las cuotas ofrecidas son ≈36,67 €/mes, 110 €/trimestre, 220 €/semestre — y el anual aplica el precio de pronto pago

#### Scenario: Un solo cargo recurrente
- **WHEN** se completa el checkout bundled
- **THEN** existe una única suscripción de Stripe con la cuota del periodo (sin cargos separados de software y tokens)

### Requirement: Pronto pago anual de tokens
Cuando el periodo elegido es **anual**, el componente de tokens SHALL calcularse con el precio mensual de pronto pago (configurable; por defecto 15 €/mes en vez de 20), resultando con los valores por defecto en 200 + 15×12 = **380 €/año**.

#### Scenario: Ahorro visible del plan anual
- **WHEN** el cliente compara periodos en la landing
- **THEN** el plan anual muestra su cuota con el pronto pago aplicado

### Requirement: Comisión solo sobre la componente de software
La comisión del comercial SHALL calcularse únicamente sobre la componente de **software efectiva** (`feeAmountCents`, con el descuento del panel aplicado), en ambas modalidades, una sola vez por compra. Los tokens y las cuotas recurrentes NO SHALL generar comisión. Los cupones de Stripe NO SHALL alterar la base de comisión.

#### Scenario: Comisión en compra bundled
- **WHEN** una compra BUNDLED atribuida se completa con software efectivo de 200 €
- **THEN** la comisión es `round(20000 × rate)` con independencia del periodo y de los tokens

### Requirement: Precios y descuentos configurables por el administrador
El editor de landing (solo OPERATOR) SHALL permitir configurar: precio anual del software y su descuento (importe o %), precio mensual estándar de tokens, **precio mensual de tokens con pago anual**, y periodos ofrecidos. La validación SHALL impedir que el precio anual de tokens supere el estándar.

#### Scenario: Cambio de precios se refleja en la landing
- **WHEN** el OPERATOR cambia tokens estándar a 25 € y pronto pago a 18 €
- **THEN** las cuotas de la landing y del checkout se recalculan con esos valores

### Requirement: Cupones de descuento en el checkout
El checkout SHALL aceptar códigos promocionales de Stripe (`allow_promotion_codes`), aplicando el descuento del cupón al cobro.

#### Scenario: Cliente con cupón
- **WHEN** el cliente introduce un código promocional válido en la pantalla de pago
- **THEN** Stripe aplica el descuento a la cuota y la compra se procesa normalmente
