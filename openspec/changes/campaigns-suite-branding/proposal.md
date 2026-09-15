# Proposal: campaigns-suite-branding

## Why

Con Suites y Clientes ya modelados, las campañas deben salir **con la marca de la Suite** y poder **enviarse en grupo**. Dos apuntes de la reunión:

1. "El correo debe salir como si fuera enviado desde la Suite" — el **remitente** (nombre visible), no el dominio: si la Suite es "Asesoría X", los correos de sus campañas salen como `Asesoría X <info@iaofi.com>`.
2. "Enviar una campaña se podrá hacer de forma grupal para todos los que seleccione o todos los que cumplan un determinado estado."

## What Changes

### Remitente por Suite (solo nombre visible)

- Los `CampaignSend` de email de una Suite SHALL usar como `from` el **nombre de la Suite** sobre el dominio verificado compartido: `"<Suite.name> <info@iaofi.com>"`.
- `Reply-To` opcional al email de contacto de la Suite (para que las respuestas le lleguen), si se decide en diseño.
- No se verifica dominio por Suite (descartado): el dominio remitente sigue siendo el nuestro.

### Envío grupal

- Desde el listado de clientes de la Suite, seleccionar una campaña y **enviar a**:
  - los clientes **seleccionados** (checkboxes en la tabla), o
  - todos los que **cumplan un estado** (p. ej. todos los NEW, o VISITED_LANDING).
- Se genera un `CampaignSend` por cliente (con su tracking token), reutilizando el pipeline actual de envío 1-a-1.
- **Anti-duplicado**: no reenvía a un cliente que ya tiene un send de esa campaña (salvo opción explícita "reenviar").
- Resumen previo: "se enviará a N clientes" antes de confirmar.

### Alcance de la campaña a la Suite

- Las campañas se listan/crean dentro de la Suite; los envíos solo alcanzan a clientes de esa Suite (scope + anti-IDOR).

## Non-goals

- Dominio de correo propio por Suite (verificación DNS) — solo nombre visible.
- Plantillas avanzadas / editor visual de campañas.
- Programación de envíos (scheduling).

## Capabilities

- `campaigns-suite-branding`: remitente = nombre de la Suite y envío grupal por selección o por estado, con anti-duplicado.
