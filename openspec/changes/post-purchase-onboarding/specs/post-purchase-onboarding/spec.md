# post-purchase-onboarding

## ADDED Requirements

### Requirement: PairingToken al completar la compra
Al procesar `checkout.session.completed`, tras crear la Firm y el usuario FIRM_ADMIN, el sistema SHALL generar un `PairingToken` activo asociado a la Firm recién creada, con el mismo formato de código que `generatePairingCode` (`src/lib/tokens.ts`).

#### Scenario: Compra nueva genera token
- **WHEN** la Edge Function procesa un `checkout.session.completed` no visto antes y crea la Firm
- **THEN** existe un `PairingToken` activo vinculado a esa Firm antes de enviar el email de bienvenida

#### Scenario: Webhook idempotente no duplica tokens
- **WHEN** Stripe reenvía un evento cuya `stripeSessionId` ya tiene `Purchase` registrada
- **THEN** el sistema no crea Firm, Purchase ni `PairingToken` adicionales

### Requirement: Email de bienvenida con link al instalador
Tras crear el `PairingToken`, el sistema SHALL enviar al email del comprador un mensaje de bienvenida mediante la API REST de Resend (`POST https://api.resend.com/emails`, raw fetch sin SDK) que contenga el link de descarga `${APP_URL}/api/v0/installer?pairing=<code>`, usando el remitente configurado en `RESEND_FROM`.

#### Scenario: Envío correcto
- **WHEN** la compra se procesa con éxito y hay email de comprador en la sesión de Stripe
- **THEN** se envía un email vía Resend con el link del instalador que incluye el código de pairing de la Firm

#### Scenario: Fallo de Resend no bloquea la compra
- **WHEN** la llamada a la API de Resend falla (error de red, API key inválida, dominio sin verificar)
- **THEN** el webhook registra el error en logs y responde 200, y Purchase, comisión y `PairingToken` quedan registrados igualmente

#### Scenario: Sesión sin email de comprador
- **WHEN** la sesión de checkout no incluye email del comprador
- **THEN** el sistema omite el envío del email sin error y el resto del procesamiento se completa

### Requirement: Link de descarga en la página de éxito
La página `/oferta/[slug]/success` SHALL resolver, vía Prisma, la cadena `Purchase (stripeSessionId) → Firm → PairingToken` y mostrar el link real de descarga del instalador `/api/v0/installer?pairing=<code>`, sustituyendo el texto placeholder.

#### Scenario: Compra ya procesada por el webhook
- **WHEN** el comprador llega a la success page y el webhook ya registró la Purchase y el `PairingToken`
- **THEN** la página muestra un botón/link de descarga del instalador con el código de pairing

#### Scenario: Webhook aún no procesado (carrera)
- **WHEN** el comprador llega a la success page antes de que el webhook haya procesado el evento
- **THEN** la página muestra el mensaje de fallback ("recibirás un email con las instrucciones") sin link roto ni error

### Requirement: Edge Function restaurada y reconciliada
El repositorio SHALL contener la Edge Function como `supabase/functions/stripe-webhook/index.ts` (entrypoint desplegable), reconciliada con la versión actualmente desplegada en Supabase antes de introducir los cambios de este spec.

#### Scenario: Deploy desde el repo
- **WHEN** se ejecuta `supabase functions deploy stripe-webhook` desde el repo
- **THEN** el deploy encuentra el entrypoint `index.ts` y publica la función con el comportamiento completo (compra + onboarding)
