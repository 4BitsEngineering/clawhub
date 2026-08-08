# Funcionalidades — estado actual

Última actualización: 2026-07-27

---

## Todo contra Supabase

**Sí, correcto.** La base de datos es PostgreSQL en Supabase, schema `clawhub`.
El ORM es Prisma v7 con adapter-pg. El schema `clawhub` está expuesto en la API de Supabase para que la Edge Function de Stripe pueda acceder también.

---

## Login

**Implementado con NextAuth v5 (Auth.js)** — change `production-auth-email` aplicado.

- En **desarrollo**: bypass con botones "Entrar como Operador / Empresa / Comercial" en `/login` (variable `DEV_AUTH_ENABLED=true`). Sin `RESEND_API_KEY`, el magic link se loguea en consola.
- En **producción**: magic link enviado por **email real vía Resend** (`sendVerificationRequest` usa `sendEmail` de `mailer.ts`). Solo puede entrar un email que ya exista en la tabla `User` — el callback `signIn` bloquea la solicitud si no está dado de alta (sin self-signup; no se envía email a desconocidos).
- **Invitaciones** (`/invite/[token]`): al aceptar ya no hay auto-login con cookie dev — se dispara el magic link real al email invitado, mismo flujo con o sin `DEV_AUTH_ENABLED`.
- Remitente canónico unificado: `AI-Office <info@iaofi.com>` (`RESEND_FROM`).
- Roles soportados: `OPERATOR`, `EMPRESA`, `COMERCIAL`, `FIRM_ADMIN`
- Cada rol tiene su propio layout y rutas protegidas mediante `requireXxx()` en los Server Components.

**Pendiente para producción (solo configuración, el código está listo):**
- [x] Verificar dominio `iaofi.com` en Resend (SPF/DKIM) — hecho
- [ ] En Vercel: `RESEND_API_KEY`, `RESEND_FROM`, `AUTH_URL` a la URL pública, y `DEV_AUTH_ENABLED` **ausente**
- [ ] Prueba end-to-end del magic link con un usuario de cada rol

---

## 3 Vistas

### Vista Operador — `/operator`

Acceso: rol `OPERATOR`

**Implementado:**
- Dashboard de operaciones
- Navegación con acceso a todas las áreas, incluido el panel de empresa (`/empresa`)
- Puede crear comerciales directamente desde `/empresa`

---

### Vista Empresa — `/empresa`

Acceso: roles `EMPRESA` y `OPERATOR`

**Implementado:**

#### Dashboard `/empresa`
- KPIs en tiempo real:
  - Nº de comerciales activos
  - Total de prospects captados
  - Cuántos visitaron la landing
  - Nº de compras realizadas
  - Ingresos totales (€)
  - Comisión pendiente de pagar (€)
- Tabla de comerciales con: prospects asignados, % conversión, compras, comisión pendiente
- Formulario para **crear comerciales** directamente (sin necesidad de invitar):
  - Botón "Crear" → crea el usuario con rol COMERCIAL sin enviar email
  - Botón "Crear e invitar" → crea el usuario Y le envía email de bienvenida con instrucciones

#### Prospects `/empresa/prospects`
- Lista de **todos los prospects** de todos los comerciales
- Filtros por: comercial, estado del prospect
- Columnas: Empresa, Contacto, Teléfono, Estado, Comercial, Fecha

#### Comisiones `/empresa/commissions`
- KPIs: pendiente de pagar (ámbar), ya pagado (verde), total
- Tabla completa con: comercial, comprador, importe venta, comisión, porcentaje, estado, fechas
- Acción "Marcar pagada" por fila
- Acción "Marcar todas pagadas" en bulk

#### Campañas `/empresa/campaigns` — **solo administrador (OPERATOR)**
- Crear y editar campañas: nombre, asunto, cuerpo del email (con placeholder `{{link}}`), cuerpo SMS
- El rol EMPRESA no ve estos enlaces en el menú y es redirigido si entra por URL

#### Editor de landing `/empresa/landing` — **solo administrador (OPERATOR)**
- Editar headline, precios (original / con descuento), activar/desactivar
- La landing se crea automáticamente con valores por defecto si aún no existe en BD (corregido bug de 404)
- Misma restricción que campañas: contenido comercial lo controla solo el admin

---

### Vista Comercial — `/sales`

Acceso: rol `COMERCIAL`

**Implementado:**

#### Panel de prospects `/sales`
- Pipeline visual con 5 etapas: Nuevo → Contactado → Visitó landing → En negociación → Compra
- Contador de prospects en cada etapa con barra de color
- Banner de comisiones pendientes (con link a `/sales/commissions`)
- Formulario colapsable para añadir nuevo prospect (nombre, empresa, teléfono, email)
- Tabla de prospects con:
  - Empresa y datos de contacto
  - Estado con pill de color por etapa
  - **Envío rápido desde la fila**: selector canal (email/SMS) + botón "Enviar →" que manda la campaña activa con link de tracking personalizado
  - Cambio de estado desde la fila

#### Campañas `/sales/campaigns`
- Crear y gestionar campañas (DRAFT, SCHEDULED, SENT)
- Cada envío genera un `trackingToken` único por prospect

#### Comisiones `/sales/commissions`
- KPIs: pendiente de cobro (ámbar), ya cobrado (verde), total acumulado
- Historial de comisiones propias: comprador, importe venta, comisión, porcentaje, estado, fechas
- Solo lectura — la empresa marca el pago

---

## Landing pública de venta

**URL:** `/oferta/ai-office`

**Implementado:**
- Página pública accesible sin login
- Botón de compra integrado con Stripe Checkout
- Links de tracking: cada enlace enviado por un comercial lleva `?t=TOKEN`
  - El token se registra al visitar (`LandingVisit`) y al comprar (`Purchase`)
  - Permite atribuir la venta al comercial correcto automáticamente

---

## Flujo completo de venta (extremo a extremo)

```
1. Comercial añade prospect
2. Comercial envía la landing por email o SMS desde su panel
3. Prospect recibe el link con token de tracking
4. Prospect visita la landing → se registra LandingVisit
5. Prospect compra → Stripe crea una sesión de checkout
6. Stripe dispara evento checkout.session.completed
7. Supabase Edge Function recibe el evento y:
   a. Crea la Firm (empresa cliente)
   b. Crea el usuario FIRM_ADMIN con el email del comprador
   c. Registra la Purchase
   d. Actualiza el Prospect a estado PURCHASED
   e. Calcula y crea la Comisión para el comercial
8. El comercial ve la comisión en su panel
9. La empresa aprueba el pago desde /empresa/commissions
```

> **Paso 7b — IMPLEMENTADO** (change `post-purchase-onboarding`): tras crear el usuario FIRM_ADMIN, la Edge Function genera un `PairingToken` (código de activación XXXX-XXXX, válido 7 días) y envía un **email de bienvenida vía Resend** con el link de descarga del instalador `/api/v0/installer?pairing=<code>`. La **success page** (`/oferta/[slug]/success`) muestra también el botón de descarga y el código — doble vía de entrega. Si el webhook aún no procesó (carrera redirect-vs-webhook), la página muestra el fallback "recibirás un email". Pendiente: redeploy de la función + secrets de Resend (ver tasks del change).

---

## Infraestructura técnica

| Pieza | Tecnología | Estado |
|---|---|---|
| Framework | Next.js 16.2 (Turbopack) | ✓ |
| Base de datos | Supabase PostgreSQL, schema `clawhub` | ✓ |
| ORM | Prisma v7 + adapter-pg | ✓ |
| Auth | NextAuth v5 (magic link) | ✓ dev / pendiente prod |
| Email | Resend v6 | ✓ (pendiente verificar dominio) |
| SMS | Twilio (raw fetch, sin SDK) | ✓ |
| Pagos | Stripe v22, API 2026-06-24.dahlia | ✓ |
| Webhook Stripe | Supabase Edge Function (Deno) | ✓ desplegado |
| Hosting app | Vercel (clawhub-three.vercel.app) | ✓ |
| Hosting BD | Supabase (sbtpydttrswiljnskrsq) | ✓ |

---

## Acciones pendientes (solo para producción)

- [ ] **Indicar la ruta del instalador de AI-Office** para completar el flujo post-compra (redirect o email automático desde la Edge Function)
- [x] Verificar dominio en Resend (`iaofi.com`) — hecho
- [ ] Cambiar `STRIPE_SECRET_KEY` a `sk_live_...` en `.env` y en Supabase secrets
- [ ] Crear webhook de Stripe de producción (misma URL de Supabase, evento `checkout.session.completed`)
- [ ] Desactivar `DEV_AUTH_ENABLED` en producción
- [ ] Configurar email real para magic links de NextAuth
- [ ] Cambiar `AUTH_URL` a la URL de producción (no localhost)


# Openspec

- Formalizados los dos cambios, ambos con 4/4 artefactos completos y validación en verde.

openspec/changes/post-purchase-onboarding/ — cierra el paso 7b del flujo de venta:
- proposal.md — por qué: el comprador se queda sin acceso al instalador pese a que la infraestructura ya existe; incluye el hallazgo del index.tsNO deshabilitado.
- design.md — 6 decisiones: Resend por API REST con raw fetch (sin SDK, patrón Twilio), PairingToken generado en la Edge Function, email no bloqueante, success page resuelta vía Prisma con fallback para la carrera redirect-vs-webhook, reconciliación del .tsNO como primer paso, y secrets nuevos en Supabase.
- specs/post-purchase-onboarding/spec.md — 4 requisitos con 8 escenarios (idempotencia, fallo de Resend, sesión sin email, carrera del webhook…).
- tasks.md — 13 tareas en 5 grupos, empezando por el diff contra lo desplegado en Supabase.

openspec/changes/production-auth-email/ — magic links reales y producción sin bypass:
- proposal.md — sustituir el console.log del magic link, unificar remitente, invitaciones sin auto-login dev.
- design.md — 5 decisiones: reutilizar sendEmail de mailer.ts (conserva el modo dev gratis), mantener el provider Nodemailer solo cambiando el override, remitente canónico info@iaofi.com, invitación redirigida al flujo de magic link, y DEV_AUTH_ENABLED como flag solo-dev apagado por configuración.
- specs/auth-email/spec.md — 4 requisitos con 8 escenarios, incluida la verificación de que la cookie dev no concede sesión en producción.
- tasks.md — 12 tareas en 5 grupos, con la verificación del dominio Resend como prerequisito compartido entre ambos cambios.

Quedaron registradas como cuestiones abiertas (no bloqueantes): si el email de bienvenida debe incluir también magic link al panel /firm, y si se activa la validación del parámetro pairing en /api/v0/installer.

Cuando quieras implementar: /opsx:apply post-purchase-onboarding (recomiendo empezar por este, ya que el otro depende del mismo prerequisito de Resend que se resuelve aquí).