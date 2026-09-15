# Proposal: clientes-crm

## Why

Con la jerarquía Zona → Suite ya en marcha (`suites-and-zones`), la cartera comercial pasa a colgar de la Suite. El apunte de la reunión "Prospect ahora es empresa/cliente" pide renombrar el concepto y reforzarlo: un **Cliente** (potencial o ya comprador) pertenece a una Suite, tiene teléfono obligatorio, y debe poder **importarse desde Excel** además de darse de alta a mano.

Decisión confirmada: **renombrar, no fusionar** — el Cliente es la entidad de CRM; al comprar sigue generando su `Firm` (la instalación del software), como hoy. No se toca el flujo de compra/pair.

## What Changes

### Rename Prospect → Cliente

- El modelo `Prospect` pasa a llamarse `Cliente` (tabla y referencias). Alias de compatibilidad donde haga falta durante la transición.
- Nuevo vínculo: `Cliente.suiteId` (cuelga de la Suite; sustituye a la atribución por `salesRepId`, ya migrada a `suiteId` en suites-and-zones).
- `phone` pasa a **obligatorio** (validación de aplicación; los registros migrados sin teléfono se marcan como "incompletos" hasta que se rellenen).
- `ProspectStatus` → `ClienteStatus` (mismos valores: NEW, CONTACTED, VISITED_LANDING, PURCHASED, LOST…).

### Alta manual

- Formulario de alta de Cliente en el panel de la Suite (`/sales`), con teléfono obligatorio, dentro de la Suite del usuario.

### Import desde Excel

- Subida de `.xlsx`/`.csv` → parseo en servidor → previsualización (filas válidas / con error) → confirmación → alta en lote sobre la Suite.
- Deduplicación por email dentro de la Suite (no re-crea; marca duplicados en la previsualización).
- Columnas: nombre (obligatorio), email (obligatorio), teléfono (obligatorio), CIF, contacto, notas. Cabeceras flexibles (mapeo laxo por nombre de columna).

### Visibilidad

- El panel de la Suite lista **solo los clientes de su Suite**; OPERATOR/EMPRESA ven todas.

## Non-goals

- Campañas y envío grupal (spec `campaigns-suite-branding`).
- Fusionar Cliente y Firm (descartado: se mantienen separados).
- Sincronización con CRMs externos.

## Capabilities

- `clientes-crm`: rename Prospect→Cliente con `suiteId` y teléfono obligatorio, alta manual e import Excel/CSV con previsualización y dedupe.
