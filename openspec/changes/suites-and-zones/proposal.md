# Proposal: suites-and-zones

## Why

Hoy el modelo comercial es plano: 4bits (OPERATOR/EMPRESA) y comerciales individuales (COMERCIAL/`SalesRep`) que captan prospects. La dirección nueva (reunión 25-ago) introduce una jerarquía **Zona → Suite → Cliente**: las **Suites** son oficinas (asesorías, asociaciones, empresas…) que gestionan su propia cartera de clientes y sus campañas bajo su marca; las **Zonas** las agrupan. Un cliente puede además convertirse en Suite.

Decisión de negocio confirmada: **4bits sigue cobrando y provisionando al cliente final** — la Suite es una capa de **CRM + marca + comisión**, no un revendedor que factura. Por eso la Suite es una **generalización del comercial actual**: de "una persona con IBAN" a "una oficina con usuarios, marca y cartera".

Esta spec es la **base**: modelo Zona/Suite, perfil de Suite y migración del `SalesRep` actual. De ella cuelgan las demás (clientes-crm, campaigns-suite-branding, suite-contract-signing, impago-client-notice).

## What Changes

### Entidad Zona

- `Zone { id, name, createdAt }` — agrupación gestionada por OPERATOR/EMPRESA. Formaliza el actual `SalesRep.territory` (texto libre).
- Una Zona tiene muchas Suites.

### Entidad Suite (generaliza SalesRep)

- `Suite { id, zoneId?, name, type (ASESORIA|ASOCIACION|EMPRESA|OTRO), phone (obligatorio), commissionRate, iban?, ibanHolder?, billing* (taxId, dirección…), createdAt }`.
- `name` es la **marca** (se usará como remitente de campañas — spec campaigns-suite-branding).
- La comisión y el IBAN de cobro pasan del comercial-persona a la Suite-oficina.
- Usuarios de la Suite: un `User` con rol de Suite y `suiteId` (ver Diseño). Reemplaza al vínculo 1-a-1 `SalesRep.userId`.

### Migración del modelo actual (no destructiva)

- Cada `SalesRep` existente → una Suite de un solo usuario (type EMPRESA por defecto), heredando `commissionRate`, `iban`, `ibanHolder`; su `territory` → Zona con ese nombre (creada si no existe).
- Los `Prospect`/`Commission`/`Purchase` ya atribuidos siguen enlazados por el usuario/rep; se recablean a la Suite en la migración.

### "Un cliente puede convertirse en Suite"

- Acción del OPERATOR sobre una `Firm`: crea una Suite para ella y da a su FIRM_ADMIN acceso de Suite (sin perder su rol de cliente). La Firm sigue siendo cliente del software **y** pasa a gestionar su propia cartera.

### Perfil de Suite

- Pantalla de perfil (self-service del usuario de Suite): teléfono, datos de facturación, IBAN + titular. Alimenta también la firma del contrato (spec suite-contract-signing).

## Non-goals

- Facturación de la Suite a sus clientes (4bits cobra al cliente final — descartado en reunión).
- Rename de Prospect→Cliente e import (spec `clientes-crm`).
- Remitente de campañas y envío grupal (spec `campaigns-suite-branding`).
- Firma del contrato (spec `suite-contract-signing`).
- Dominio de correo propio por Suite (se usa solo el nombre visible).

## Capabilities

- `suites-and-zones`: jerarquía Zona→Suite, perfil de Suite, migración de SalesRep, promoción cliente→Suite.
