# Spec: suite-contract-signing

## ADDED Requirements

### Requirement: Contrato versionado editable por operator

El sistema SHALL mantener una plantilla de contrato versionada, editable por OPERATOR, con una única versión vigente en cada momento.

#### Scenario: Publicar una versión nueva

- **WHEN** el operator edita el contrato y publica
- **THEN** se crea una versión nueva que pasa a ser la vigente para futuras firmas

### Requirement: La Suite firma por web antes de operar

Una Suite sin contrato firmado de la versión vigente SHALL ser redirigida a la pantalla de firma y no SHALL poder operar hasta firmar. La firma SHALL registrar firmante, fecha, hash de IP y user-agent, y generar un PDF guardado.

#### Scenario: Suite nueva sin firmar

- **WHEN** el usuario de una Suite recién creada entra a su panel
- **THEN** se le muestra el contrato completo y no puede operar hasta aceptar y firmar

#### Scenario: Firma correcta

- **WHEN** el usuario introduce su nombre, marca la casilla y firma
- **THEN** se registra la firma (nombre, email, fecha, IP hasheada, user-agent), se genera y guarda el PDF, y se desbloquea el acceso

#### Scenario: Doble firma evitada

- **WHEN** una Suite ya firmó la versión vigente
- **THEN** no se le vuelve a pedir y no se duplica el registro

### Requirement: Visibilidad de la firma para operator

OPERATOR SHALL ver el estado de firma de cada Suite (versión, fecha, firmante) y poder descargar el PDF.

#### Scenario: Operator revisa una Suite

- **WHEN** el operator abre el detalle de una Suite firmada
- **THEN** ve versión, fecha y firmante y puede descargar el PDF del contrato firmado
