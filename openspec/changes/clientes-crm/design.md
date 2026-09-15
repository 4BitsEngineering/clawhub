# Design: clientes-crm

## Rename Prospect → Cliente

Prisma no renombra tablas automáticamente sin migración. Estrategia:

- Renombrar el modelo `Prospect` → `Cliente` en el schema y **mapear a la tabla física existente** con `@@map("Prospect")` en un primer paso (cero movimiento de datos, solo cambia el nombre en el cliente Prisma). Un rename físico de tabla queda como limpieza posterior opcional.
- `ProspectStatus` → `ClienteStatus` con `@@map` equivalente si el enum está tipado en DB; los valores no cambian.
- Referencias en código (`db.prospect` → `db.cliente`, tipos, imports) se actualizan en el mismo PR. Los campos `convertedFirmId`, `createdById` se conservan.

## Vínculo con Suite

`suites-and-zones` ya reapunta `Prospect.salesRepId` → `suiteId`. Aquí se consolida: `Cliente.suiteId String` (obligatorio a futuro; durante transición nullable con backfill). El panel de la Suite filtra por `suiteId = sesión.suiteId`; server actions revalidan (anti-IDOR).

## Teléfono obligatorio

Validación de aplicación (no `NOT NULL` en DB para no romper la migración). Los clientes migrados sin teléfono se listan con un badge "sin teléfono" y no bloquean; el alta manual y el import sí lo exigen.

## Import Excel/CSV

- Parseo en servidor con una librería ligera (`xlsx` para .xlsx; CSV nativo). Límite de filas (p. ej. 2.000) y de tamaño.
- **Mapeo laxo de columnas**: normalizar cabeceras (minúsculas, sin acentos) y aceptar sinónimos (`nombre|empresa|razón social` → name; `email|correo` → email; `telefono|móvil|phone` → phone; `cif|nif` → cif; `contacto|persona` → contactName).
- **Dos fases**: (1) subir → previsualización server-side con recuento válidas / con error (falta email o teléfono, email mal formado) / duplicadas (email ya en la Suite); (2) confirmar → `createMany` de las válidas no duplicadas, todas con `suiteId` de la sesión y `status = NEW`.
- Idempotencia: dedupe por `(suiteId, email)`; re-subir el mismo Excel no crea duplicados.
- No se guarda el fichero subido (se procesa en memoria y se descarta).

## Riesgos

- **Rename con código vivo**: `Prospect` se referencia en campañas, comisiones, webhook (`convertedFirmId`), atribución manual. El `@@map` evita mover datos, pero hay que barrer todas las referencias en un solo PR y verificar con `tsc`. La Edge Function (Deno) usa el nombre de tabla físico (`"Prospect"`) por PostgREST — **no cambia** si mantenemos `@@map("Prospect")`.
- **Import malicioso**: validar tipos, longitudes y tope de filas; el parseo nunca ejecuta fórmulas.
