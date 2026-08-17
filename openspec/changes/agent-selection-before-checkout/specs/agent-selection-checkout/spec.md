# Spec: agent-selection-checkout

## ADDED Requirements

### Requirement: Selección de agentes en la landing antes del pago

Las landings de venta (`/` y `/oferta/[slug]`) SHALL mostrar el catálogo completo de agentes (14) con selección por checkbox antes del pago, con todos seleccionados por defecto, en ambas modalidades (BUNDLED y EXTERNAL).

#### Scenario: Compra con equipo por defecto

- **WHEN** el comprador no toca la selección y paga
- **THEN** la compra registra los 14 agentes (o array vacío ≡ todos) y el baseline resultante instala el catálogo completo

#### Scenario: Compra con equipo reducido

- **WHEN** el comprador deselecciona agentes (p. ej. deja 5) y paga
- **THEN** la sesión de Stripe lleva `selectedAgents` con exactamente esos ids más `planner`
- **AND** el precio mostrado y cobrado no varía respecto a la selección completa

#### Scenario: El planner no puede excluirse

- **WHEN** el comprador intenta deseleccionar el Planificador (UI) o envía un form sin él (manipulación)
- **THEN** la selección efectiva incluye `planner` en todos los casos

### Requirement: Persistencia de la selección en la compra

El webhook de Stripe SHALL persistir la selección en `Purchase.selectedAgents` (array de ids; vacío = catálogo completo). Los ids desconocidos SHALL descartarse en la validación del checkout.

#### Scenario: Metadata ausente (compra antigua o venta manual)

- **WHEN** llega un checkout sin key `selectedAgents`
- **THEN** la compra se crea con `selectedAgents = []` y se interpreta como equipo completo

### Requirement: Baseline por firma según la selección

`provisionDefaultBaseline` SHALL generar `overlay/overlay-config.json` y `overlay/dispatch.config.json` únicamente con los agentes seleccionados en la última compra de la firma (más `planner`), y con el catálogo completo si no hay compra o la selección es vacía o inválida.

#### Scenario: Pair tras compra con selección

- **WHEN** el instalador parea una firma cuya última compra tiene `selectedAgents = [planner, executive, tax]`
- **THEN** el paquete descargado instala exactamente esos 3 agentes y el dispatch expone solo esos roles

#### Scenario: Firma creada sin compra (operator/script)

- **WHEN** parea una firma sin ninguna `Purchase`
- **THEN** el baseline contiene el catálogo completo (comportamiento actual)

### Requirement: Visibilidad del equipo contratado

El panel `/empresa` (detalle de compra, OPERATOR) y el portal `/firm` SHALL mostrar el equipo contratado como chips (icono + nombre), o "Equipo completo" cuando la selección es vacía.

#### Scenario: Operator revisa una compra

- **WHEN** el operator abre el detalle de una compra con selección reducida
- **THEN** ve los agentes contratados y puede contrastarlos con lo instalado
