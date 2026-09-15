# Spec: clientes-crm

## ADDED Requirements

### Requirement: Cliente pertenece a una Suite con teléfono obligatorio

El CRM SHALL modelar Clientes (antes Prospects) que pertenecen a una Suite. El alta manual y la importación SHALL exigir teléfono; los clientes migrados sin teléfono SHALL marcarse como incompletos sin bloquear.

#### Scenario: Alta manual sin teléfono

- **WHEN** un usuario de Suite da de alta un cliente sin teléfono
- **THEN** se rechaza con aviso y no se crea

#### Scenario: Aislamiento por Suite

- **WHEN** un usuario de Suite lista su cartera
- **THEN** ve solo los clientes de su Suite; OPERATOR/EMPRESA ven todas

### Requirement: Importación de clientes desde Excel/CSV

El sistema SHALL permitir subir un `.xlsx`/`.csv`, previsualizar el resultado (válidas / con error / duplicadas) y confirmar el alta en lote sobre la Suite, deduplicando por email dentro de la Suite.

#### Scenario: Importación con previsualización

- **WHEN** el usuario sube un Excel de 100 filas (5 sin email, 10 ya existentes en la Suite)
- **THEN** la previsualización muestra 85 a crear, 5 con error y 10 duplicadas; al confirmar se crean 85 con la Suite y estado NEW

#### Scenario: Re-subida idempotente

- **WHEN** se vuelve a subir el mismo Excel
- **THEN** todas salen como duplicadas y no se crea ningún cliente nuevo

#### Scenario: Cabeceras flexibles

- **WHEN** el Excel trae columnas "Razón social", "Correo", "Móvil"
- **THEN** se mapean a nombre, email y teléfono respectivamente

### Requirement: Rename sin pérdida ni ruptura del flujo de compra

El rename Prospect→Cliente SHALL conservar los datos y no SHALL alterar el flujo de compra/pair (el Cliente sigue generando su Firm al comprar) ni la atribución de comisiones existente.

#### Scenario: Cliente que compra

- **WHEN** un Cliente completa una compra
- **THEN** se crea/asocia su Firm como hasta ahora y su estado pasa a PURCHASED
