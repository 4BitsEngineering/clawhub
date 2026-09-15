# Spec: suites-and-zones

## ADDED Requirements

### Requirement: Jerarquía Zona → Suite

El sistema SHALL modelar Zonas que agrupan Suites. OPERATOR y EMPRESA SHALL poder crear y editar Zonas y Suites; un usuario de Suite SHALL ver y editar únicamente su propia Suite.

#### Scenario: Operator crea una Suite en una Zona

- **WHEN** el operator crea la Suite "Asesoría X" (tipo ASESORIA, teléfono, IBAN) en la Zona "Valencia"
- **THEN** la Suite queda listada bajo esa Zona y su usuario puede acceder a su perfil y su cartera

#### Scenario: Aislamiento entre Suites

- **WHEN** un usuario de la Suite A intenta abrir el perfil o la cartera de la Suite B
- **THEN** el acceso se deniega (redirect/notFound), aunque manipule el id

### Requirement: Suite generaliza al comercial (migración de SalesRep)

La información comercial (tarifa de comisión, IBAN, titular) SHALL residir en la Suite. Los comerciales, prospects y comisiones existentes SHALL migrar sin pérdida a Suites, y las atribuciones y pagos previos SHALL seguir siendo consultables.

#### Scenario: Migración de un comercial existente

- **WHEN** se ejecuta la migración
- **THEN** cada SalesRep pasa a una Suite (con su tarifa/IBAN), su territorio pasa a Zona, su usuario queda vinculado a la Suite, y sus prospects y comisiones quedan recableados a esa Suite

#### Scenario: Comisión atribuida tras la migración

- **WHEN** una compra se atribuye a una Suite
- **THEN** la comisión se calcula con la tarifa de la Suite y su pago usa el IBAN de la Suite

### Requirement: Perfil de Suite con teléfono obligatorio y datos de facturación

El usuario de Suite SHALL poder mantener el perfil de su Suite (teléfono, datos de facturación, IBAN + titular). El teléfono SHALL ser obligatorio al guardar.

#### Scenario: Guardar perfil sin teléfono

- **WHEN** el usuario guarda el perfil de su Suite dejando el teléfono vacío
- **THEN** se rechaza con un aviso y no se persiste

### Requirement: Promoción de cliente a Suite

OPERATOR SHALL poder convertir una Firm (cliente) en Suite sin que deje de ser cliente del software.

#### Scenario: Cliente pasa a Suite

- **WHEN** el operator promueve la Firm "Gestoría Y" a Suite
- **THEN** se crea su Suite (heredando nombre y datos fiscales), su FIRM_ADMIN gana acceso de Suite y la Firm conserva su instalación y facturación como cliente

#### Scenario: Promoción idempotente

- **WHEN** el operator promueve una Firm que ya tiene Suite
- **THEN** no se crea una segunda Suite
