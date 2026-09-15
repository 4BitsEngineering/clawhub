# Design: campaigns-suite-branding

## Remitente

`sendEmail` (src/lib/mailer.ts) ya acepta `from`. Hoy es fijo (`RESEND_FROM`). Se amplía para aceptar un display name por envío:

- `from = "${sanitize(suite.name)} <${baseFromAddress}>"` donde `baseFromAddress` = la dirección del `RESEND_FROM` (p. ej. `info@iaofi.com`).
- `sanitize`: quitar comillas/comas/saltos del nombre (evita cabeceras rotas o inyección de headers).
- `Reply-To`: si la Suite tiene email de contacto, se añade para que las respuestas del cliente lleguen a la Suite y no a nuestro buzón general. Decisión de diseño a confirmar (por defecto: sí).
- Resend permite `from` con display name arbitrario mientras el dominio (`iaofi.com`) esté verificado — que lo está. No hace falta nada por Suite.

## Envío grupal

Reutiliza el pipeline actual de `CampaignSend` (un registro + email/SMS por cliente, con tracking token). Cambios:

- **Selección**: la tabla de clientes de la Suite gana checkboxes + acción "Enviar campaña". El server action recibe: `campaignId`, y **o** una lista de `clienteIds` **o** un `status` (mutuamente excluyentes).
- **Resolución del público**:
  - por selección → los `clienteIds` (validados de la Suite).
  - por estado → `SELECT id FROM Cliente WHERE suiteId = ? AND status = ?`.
- **Anti-duplicado**: excluir clientes con un `CampaignSend` existente de esa campaña (a menos que `resend=true`).
- **Confirmación**: el server action primero devuelve el recuento ("N destinatarios") y el envío real se confirma en un segundo submit (evita disparos accidentales sobre carteras grandes).
- **Lotes**: enviar en tandas (p. ej. 50) con manejo de error por destinatario — un fallo de Resend en uno no aborta el resto; los fallidos quedan en Activity/log.

## Scope y permisos

- Campañas y envíos scoped a `suiteId` de la sesión; server actions revalidan que campaña y clientes son de la Suite (anti-IDOR).
- OPERATOR/EMPRESA pueden operar sobre cualquier Suite.

## Riesgos

- **Volumen / rate limits de Resend**: el envío por estado sobre una cartera grande puede chocar con límites. Mitigación: lotes + tope por envío + registro de fallidos para reintento manual.
- **Inyección de cabecera vía nombre de Suite**: el `sanitize` del display name es obligatorio.
