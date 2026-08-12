# firm-client-portal

## ADDED Requirements

### Requirement: Portal de cliente con exactamente cuatro bloques
`/firm` (rol `FIRM_ADMIN`) SHALL mostrar únicamente: descarga del instalador, código de activación actual, consumo del mes y acceso a facturación. No SHALL mostrar ni permitir gestión de baselines, usuarios, instances, MCP ni settings.

#### Scenario: Contenido del portal
- **WHEN** un FIRM_ADMIN abre `/firm`
- **THEN** ve los cuatro bloques y ninguna otra sección operativa

#### Scenario: Subrutas ocultas
- **WHEN** un FIRM_ADMIN navega a `/firm/baselines`, `/firm/users`, `/firm/instances/[id]`, `/firm/mcp`, `/firm/settings` o `/firm/usage`
- **THEN** es redirigido a `/firm`

### Requirement: Código de activación autoservicio
El portal SHALL mostrar el código de pairing activo más reciente (no usado, no caducado) con su fecha de caducidad. Si no existe, SHALL permitir generar uno nuevo con la validación de cuota de asientos y caducidad de 7 días.

#### Scenario: Generar código cuando no hay activo
- **WHEN** el FIRM_ADMIN pulsa "Generar código" sin códigos activos y con asientos libres
- **THEN** se crea un código de 7 días y se muestra en pantalla

#### Scenario: Cuota agotada
- **WHEN** la firma ya usó todos sus asientos
- **THEN** no se genera código y se muestra el aviso de contactar con soporte

### Requirement: Consumo del mes sin datos internos
El portal SHALL mostrar el consumo de IA de la firma del mes en curso (tokens usados y tareas ejecutadas, con el mes anterior como referencia) y NO SHALL mostrar costes internos (`costUsd`) ni desglose por modelo/proveedor.

#### Scenario: Consumo agregado
- **WHEN** el FIRM_ADMIN abre el portal
- **THEN** ve tokens y tareas del mes en curso agregados de todas sus instances

### Requirement: Facturación vía Stripe Billing Portal
El portal SHALL ofrecer un acceso "Gestionar facturación" que cree una sesión del Billing Portal de Stripe para el customer de la firma (derivado de su suscripción) y redirija a ella, permitiendo descargar facturas/recibos y gestionar las suscripciones de tokens y software.

#### Scenario: Acceso al portal de facturación
- **WHEN** el FIRM_ADMIN pulsa "Gestionar facturación" y la firma tiene compra con suscripción
- **THEN** es redirigido al Billing Portal de Stripe con retorno a `/firm`

#### Scenario: Firma sin suscripción
- **WHEN** la firma no tiene ninguna compra con suscripción de Stripe
- **THEN** la tarjeta de facturación se muestra sin botón, indicando que no está disponible

### Requirement: Estética AI-Office
El portal SHALL usar la línea visual del producto AI-Office (fondo azul marino profundo, titulares serif con punto final, acentos amarillo/crema, tarjetas claras redondeadas), de forma autocontenida y sin alterar el tema del resto de la aplicación.

#### Scenario: Aislamiento visual
- **WHEN** se renderiza cualquier otra página de la app (operator, empresa, sales)
- **THEN** su estilo no cambia por la existencia del portal
