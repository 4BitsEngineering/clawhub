# manual-commission-attribution

## ADDED Requirements

### Requirement: Atribución manual de una compra a un comercial
El administrador (`OPERATOR`) SHALL poder atribuir una `Purchase` con estado `COMPLETED` y sin `Commission` previa a un comercial, creando una `Commission` con `rate = SalesRep.commissionRate` vigente, `amountCents = round(purchase.amountCents * rate)` y `status = PENDING`.

#### Scenario: Atribución de una compra sin comisión
- **WHEN** el OPERATOR selecciona un comercial para una compra completada que aún no tiene comisión
- **THEN** se crea una `Commission` para ese comercial con la tarifa vigente del comercial y estado PENDING, y el comercial la ve en `/sales/commissions`

#### Scenario: Compra ya atribuida no se duplica
- **WHEN** el OPERATOR intenta atribuir una compra que ya tiene una `Commission` (automática o manual)
- **THEN** el sistema no crea una segunda comisión y la operación no produce error visible al usuario

#### Scenario: Solo compras completadas son atribuibles
- **WHEN** se listan las compras candidatas a atribución manual
- **THEN** solo aparecen las que tienen estado `COMPLETED` y no tienen `Commission` asociada

### Requirement: Traza de atribución manual
Toda `Commission` creada por atribución manual SHALL registrar en el campo `notes` una traza que identifique el origen manual, el operador que la creó y la fecha.

#### Scenario: Nota de auditoría al atribuir
- **WHEN** el OPERATOR completa una atribución manual
- **THEN** la `Commission` resultante tiene en `notes` una marca de origen manual con el email del operador y la fecha

### Requirement: Reverso de una atribución manual pendiente
El administrador (`OPERATOR`) SHALL poder deshacer (eliminar) una `Commission` de origen manual mientras su estado sea `PENDING`. Una comisión `PAID` no SHALL poder deshacerse.

#### Scenario: Deshacer una atribución pendiente
- **WHEN** el OPERATOR deshace una comisión de atribución manual en estado PENDING
- **THEN** la `Commission` se elimina y la compra vuelve a estar disponible para atribución

#### Scenario: No se puede deshacer una comisión pagada
- **WHEN** el OPERATOR intenta deshacer una comisión que ya está en estado PAID
- **THEN** el sistema no la elimina y la comisión permanece intacta

### Requirement: Restricción de acceso a OPERATOR
La atribución manual y su reverso SHALL estar disponibles únicamente para el rol `OPERATOR`, tanto en la interfaz como en las server actions.

#### Scenario: El rol EMPRESA no ve la atribución
- **WHEN** un usuario con rol `EMPRESA` abre `/empresa/commissions`
- **THEN** no ve la sección de atribución manual y sigue pudiendo ver y marcar comisiones como pagadas

#### Scenario: Server action protegida
- **WHEN** se invoca la acción de atribución o de reverso sin sesión de `OPERATOR`
- **THEN** la acción no ejecuta el cambio
