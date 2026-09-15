# Design: suites-and-zones

## Decisión central (a validar) — cómo colapsa SalesRep en Suite

Hoy: `SalesRep { userId (1-1 con User COMERCIAL), territory, commissionRate, iban, ibanHolder }`, y `Prospect.salesRepId`, `Commission.salesRepId` cuelgan de él.

Propuesta: **la Suite absorbe el rol de `SalesRep`** (la comisión es de la oficina, no de la persona) y los usuarios se vinculan por `User.suiteId`.

- `SalesRep` **se elimina** como modelo; su información (rate/iban/holder) sube a `Suite`; `territory` → `Zone`.
- `User` gana `suiteId String?`. Rol COMERCIAL se mantiene por nombre (mínimo churn) pero pasa a significar "usuario de Suite".
- `Prospect.salesRepId` → `Prospect.suiteId`; `Commission.salesRepId` → `Commission.suiteId`.
- Migración de datos: por cada SalesRep, crear Suite (type EMPRESA, phone placeholder a completar en el perfil), copiar rate/iban/holder, crear/asignar Zone desde territory, set `User.suiteId`, recablear Prospect/Commission.

Alternativa descartada: mantener `SalesRep` **dentro** de la Suite (comisión por persona). Se descarta porque una oficina cobra a una sola cuenta y complica el reparto sin pedirlo la reunión.

## Modelo de datos

```
Zone   { id, name @unique, createdAt }
Suite  { id, zoneId?, name, type SuiteType, phone,
         commissionRate Float @default(0.10),
         iban?, ibanHolder?,
         billingTaxId?, billingAddress?, billingPostalCode?, billingCity?,
         createdAt, updatedAt }
enum SuiteType { ASESORIA ASOCIACION EMPRESA OTRO }
User.suiteId String?              // usuario de Suite (rol COMERCIAL)
Firm.suiteId String?              // (lo consume clientes-crm; aquí solo la promoción)
```

`phone` es obligatorio a nivel de aplicación (no en DB, para no romper la migración de reps sin teléfono — se exige al guardar el perfil).

## Promoción cliente → Suite

Acción OPERATOR sobre una `Firm`: crea `Suite` (name = Firm.name, type EMPRESA, hereda `Firm.taxId` a billing), set `Firm.suiteId` a la nueva suite y da al FIRM_ADMIN `suiteId` (mantiene rol FIRM_ADMIN; el acceso de Suite se resuelve por `suiteId != null`, no por rol). Idempotente: si la Firm ya tiene suite, no duplica.

## Navegación y permisos

- OPERATOR/EMPRESA: CRUD de Zonas y Suites; ven todas.
- Usuario de Suite (COMERCIAL con suiteId): ve y edita **solo su Suite** (perfil) y su cartera (clientes-crm). Los server actions revalidan `suiteId` (evita IDOR, patrón ya usado en /firm).
- El panel actual `/sales` (comercial) se re-scopea a la Suite; `/empresa` (EMPRESA) gana la gestión de Zonas/Suites.

## Riesgos

- **Migración con datos vivos**: hay comerciales, prospects y comisiones reales. La migración se hace en un script idempotente y verificable en `.env.local` antes de tocar producción; se conserva `salesRepId` en una columna sombra durante una release por si hay que revertir.
- **Rol vs suiteId**: mezclar "es cliente" (FIRM_ADMIN) y "gestiona suite" (suiteId) en un mismo User es deliberado (la promoción cliente→Suite lo exige); el gating se hace por capacidades (`suiteId != null`, `firmId != null`), no solo por rol.
