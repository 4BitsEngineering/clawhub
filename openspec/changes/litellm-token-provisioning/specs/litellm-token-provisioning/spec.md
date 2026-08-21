# Spec: litellm-token-provisioning

## ADDED Requirements

### Requirement: Alta automática de team y virtual key por firma BUNDLED

Al completarse una compra BUNDLED, el sistema SHALL crear en el proxy LiteLLM un team (`TEAM-<firmId8>`, presupuesto = budget/seat × seats, TPM/RPM configurados) y una virtual key (`KEY-<firmId8>`, all-team-models, 360d) referenciando el modelo compartido, persistiendo team id, key id y la key cifrada en la Firm. El alta SHALL ser idempotente y no bloqueante (fallback de reintento en pair).

#### Scenario: Compra BUNDLED con proxy disponible

- **WHEN** se completa una compra Todo incluido de 2 seats
- **THEN** existe TEAM-<id> con presupuesto 2 × budget/seat y una key asociada, y la Firm guarda team id, key id y la key cifrada

#### Scenario: Proxy caído en la compra

- **WHEN** el alta falla en el webhook
- **THEN** la compra se completa igualmente y el pair reintenta el alta antes de generar el baseline; si también falla, Activity de error para el operator

### Requirement: Baseline BUNDLED sin pedir claves al cliente

Si la firma tiene virtual key, el baseline por defecto SHALL configurar el proveedor litellm (URL del proxy + key inline) con el modelo compartido como primario y un manifest sin env requeridas; el asistente de instalación no SHALL pedir ninguna clave. Sin key, se mantiene la plantilla actual (EXTERNAL introduce la suya).

#### Scenario: Instalación de cliente BUNDLED

- **WHEN** el instalador parea una firma BUNDLED con key provisionada
- **THEN** el paso Credenciales no pide nada y el gateway arranca con `litellm/<alias>` como modelo primario

#### Scenario: Petición de prueba

- **WHEN** el stack instalado hace una petición LLM
- **THEN** el proxy la sirve con la key del team de la firma y el gasto queda contabilizado en su team

### Requirement: Kill-switch por impago

Ante `invoice.payment_failed` o `customer.subscription.deleted` de cualquier suscripción de la firma, el sistema SHALL bloquear la virtual key (`/key/block`); ante `invoice.paid` posterior SHALL desbloquearla. Ambos con Activity y estado espejo en la Firm.

#### Scenario: Impago

- **WHEN** Stripe notifica un impago de la suscripción de la firma
- **THEN** la key queda bloqueada (las peticiones LLM del cliente devuelven error) y el operator ve el estado en el panel

#### Scenario: Regularización

- **WHEN** llega `invoice.paid` de la firma bloqueada
- **THEN** la key se desbloquea automáticamente

### Requirement: Presupuesto ligado a seats

El presupuesto del team SHALL ser budget/seat × `seatsPurchased` (default 16 USD ≈ 15 €/mes por seat, reset 30d) y SHALL actualizarse al cambiar los seats de la firma.

#### Scenario: Ampliación de seats

- **WHEN** una firma pasa de 1 a 3 seats
- **THEN** el team pasa a presupuesto 3 × budget/seat vía /team/update
