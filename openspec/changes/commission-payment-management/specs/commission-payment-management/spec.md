# commission-payment-management

## ADDED Requirements

### Requirement: Ciclo de estados del pago por transferencia
Una `Commission` SHALL estar en uno de tres estados: `PENDING` (pendiente de transferencia), `TRANSFERRED` (transferencia hecha, con fecha y referencia opcional) o `INCIDENT` (incidencia, con nota obligatoria). Las transiciones permitidas SHALL ser: PENDING→TRANSFERRED, PENDING→INCIDENT, INCIDENT→PENDING, INCIDENT→TRANSFERRED, TRANSFERRED→INCIDENT y TRANSFERRED→PENDING; cualquier otra transición SHALL rechazarse.

#### Scenario: Marcar transferencia hecha
- **WHEN** EMPRESA u OPERATOR marca una comisión pendiente como transferida, con o sin referencia
- **THEN** la comisión queda `TRANSFERRED` con la fecha registrada y la referencia si se aportó

#### Scenario: Registrar una incidencia
- **WHEN** EMPRESA u OPERATOR marca una comisión como incidencia sin aportar nota
- **THEN** el cambio no se aplica; con nota, la comisión queda `INCIDENT` con la nota visible

#### Scenario: Reintentar tras incidencia
- **WHEN** una comisión en `INCIDENT` se devuelve a `PENDING`
- **THEN** vuelve al listado de pendientes conservando la nota como historial

#### Scenario: Deshacer un marcado erróneo
- **WHEN** una comisión `TRANSFERRED` se devuelve a `PENDING`
- **THEN** la fecha de transferencia se anula y vuelve a pendiente

### Requirement: Panel de pagos para EMPRESA y OPERATOR
`/empresa/commissions` SHALL ofrecer a los roles `EMPRESA` y `OPERATOR` el listado de comisiones con filtro por estado, KPIs por estado, el IBAN del comercial en cada fila, la referencia y nota de pago, las acciones de transición según el estado y una acción bulk para marcar como transferidas todas las pendientes.

#### Scenario: Listado filtrable
- **WHEN** el usuario filtra por un estado
- **THEN** la tabla muestra solo las comisiones en ese estado, con comercial, IBAN, importe y datos de pago

#### Scenario: Bulk de transferencias
- **WHEN** el usuario ejecuta "marcar transferidas" con N comisiones pendientes
- **THEN** las N pasan a `TRANSFERRED` con la fecha registrada

#### Scenario: El comercial no gestiona pagos
- **WHEN** un usuario con rol `COMERCIAL` accede a sus comisiones
- **THEN** ve los estados pero no dispone de ninguna acción de transición

### Requirement: Perfil del comercial con IBAN autoservicio
El sistema SHALL ofrecer al rol `COMERCIAL` una página de perfil (`/sales/profile`, con entrada en la navegación) donde ve sus datos (nombre, email, territorio y % de comisión en solo lectura) e introduce/edita su **IBAN**, que se guarda normalizado (mayúsculas, sin espacios) con validación básica de formato. Cada comercial SHALL poder editar únicamente su propio IBAN.

#### Scenario: Comercial guarda su IBAN
- **WHEN** el comercial introduce un IBAN válido en su perfil
- **THEN** queda guardado normalizado y aparece en el panel de pagos de EMPRESA/OPERATOR en sus comisiones

#### Scenario: IBAN con formato inválido
- **WHEN** el comercial introduce un texto que no pasa la validación básica de IBAN
- **THEN** no se guarda y se muestra el error

#### Scenario: Aviso de IBAN faltante
- **WHEN** el comercial tiene comisiones y no ha introducido IBAN
- **THEN** `/sales/commissions` muestra un aviso con enlace a su perfil, y el panel de pagos muestra "sin IBAN" en sus filas (las transiciones de estado siguen permitidas)

### Requirement: Vista del comercial coherente con los estados
`/sales/commissions` SHALL reflejar los tres estados (Pendiente / Transferida / Incidencia) en KPIs y tabla, en solo lectura, mostrando la nota de la incidencia cuando exista. A efectos de KPIs del comercial, `INCIDENT` SHALL contar como pendiente de cobro.

#### Scenario: Comercial ve una incidencia
- **WHEN** una de sus comisiones está en `INCIDENT`
- **THEN** el comercial la ve marcada como incidencia con su nota, sumando en "pendiente de cobro"

### Requirement: Compatibilidad con la atribución manual
El reverso de una atribución manual SHALL seguir permitido únicamente cuando la comisión está en `PENDING`; en `TRANSFERRED` o `INCIDENT` SHALL requerir volver primero a `PENDING`.

#### Scenario: No deshacer atribución transferida
- **WHEN** el OPERATOR intenta deshacer una atribución manual cuya comisión está `TRANSFERRED`
- **THEN** la comisión permanece intacta
