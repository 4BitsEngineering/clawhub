# Proposal: suite-contract-signing

## Why

Apunte de la reunión: "El contrato cuando creas la suite se debe presentar vía web y firmarlo". Cuando una oficina se da de alta como Suite (o un cliente se promueve a Suite), debe aceptar y **firmar el contrato de colaboración** por web antes de poder operar.

Decisión confirmada: **firma ligera** — contrato mostrado en web + aceptación con nombre + casilla + sello de fecha/IP + PDF guardado. Sin proveedor externo de e-firma en v1.

## What Changes

### Contrato versionado

- `ContractTemplate { id, version, title, bodyHtml, active, createdAt }` — el contrato vigente, editable por OPERATOR. Versionado para saber qué texto firmó cada Suite.

### Firma de la Suite

- `SuiteContract { id, suiteId, templateVersion, signerName, signerEmail, acceptedAt, ipHash, userAgent, pdfPath? }`.
- Una Suite **no operativa** hasta firmar: al entrar, si su Suite no tiene contrato firmado de la versión vigente, se le redirige a `/suite/contrato` (pantalla AI-Office) con el texto completo, casilla "He leído y acepto", campo de nombre del firmante y botón "Firmar".
- Al firmar: se registra `SuiteContract` (nombre, email de la sesión, fecha, hash de IP, user-agent), se **genera un PDF** del contrato + datos de firma y se guarda (Supabase Storage), y se desbloquea el acceso.
- El PDF y la fecha de firma quedan visibles para OPERATOR (detalle de Suite) y descargables por la propia Suite.

### Re-firma por cambio de versión

- Si el OPERATOR publica una versión nueva del contrato, las Suites existentes siguen operando con su firma anterior; se puede marcar una versión como "requiere re-firma" para forzar la aceptación al siguiente acceso (opcional, decisión de diseño).

## Non-goals

- E-firma legal cualificada (Signaturit/DocuSign) — descartado en v1.
- Firma manuscrita / biometría.
- Contratos por cliente final (esto es el contrato Suite↔4bits).

## Capabilities

- `suite-contract-signing`: contrato versionado, pantalla de firma web ligera con sello IP/fecha y PDF, gating de la Suite hasta firmar.
