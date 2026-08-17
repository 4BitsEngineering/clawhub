# Funcionalidades — estado actual

Última actualización: 2026-07-27

---

## Todo contra Supabase

**Sí, correcto.** La base de datos es PostgreSQL en Supabase, schema `clawhub`.
El ORM es Prisma v7 con adapter-pg. El schema `clawhub` está expuesto en la API de Supabase para que la Edge Function de Stripe pueda acceder también.

---

## Login

**Implementado con NextAuth v5 (Auth.js)** — changes `production-auth-email` y `password-login` aplicados.

- En **desarrollo**: bypass con botones "Entrar como Operador / Empresa / Comercial" en `/login` (variable `DEV_AUTH_ENABLED=true`). Sin `RESEND_API_KEY`, el magic link se loguea en consola.
- En **producción**, dos vías:
  - **Email + contraseña** (change `password-login`): solo usuarios con contraseña asignada (`User.passwordHash`, scrypt con sal; se asigna por script — sin UI de gestión de momento). Error genérico ante fallo (no revela si el email existe). Sesión JWT (30 días) con rol/firma en el token.
  - **Magic link** vía Resend, para cualquier usuario dado de alta. Solo puede entrar un email que ya exista en la tabla `User` — el callback `signIn` bloquea la solicitud si no está dado de alta (sin self-signup; no se envía email a desconocidos).
- **Invitaciones** (`/invite/[token]`): al aceptar ya no hay auto-login con cookie dev — se dispara el magic link real al email invitado, mismo flujo con o sin `DEV_AUTH_ENABLED`.
- Remitente canónico unificado: `AI-Office <info@iaofi.com>` (`RESEND_FROM`).
- Roles soportados: `OPERATOR`, `EMPRESA`, `COMERCIAL`, `FIRM_ADMIN`
- Cada rol tiene su propio layout y rutas protegidas mediante `requireXxx()` en los Server Components.

**Pendiente para producción (solo configuración, el código está listo):**
- [x] Verificar dominio `iaofi.com` en Resend (SPF/DKIM) — hecho
- [ ] En Vercel: `RESEND_API_KEY`, `RESEND_FROM`, `AUTH_URL` a la URL pública, y `DEV_AUTH_ENABLED` **ausente**
- [ ] Prueba end-to-end del magic link con un usuario de cada rol

---

## Identidad visual — change `aioffice-brand-theme`

Toda la aplicación (paneles de operador, empresa y comercial, portal del cliente y login) usa la **identidad AI-Office**: lienzo azul marino profundo, titulares serif con punto final amarillo, tarjetas crema y acento amarillo. Implementada como scope de variables CSS (`.aio-canvas` en `globals.css`) aplicado por los shells — las páginas interiores heredan el tema sin tocarse. La landing pública de venta conserva su estilo propio.

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

#### Pagos de comisiones `/empresa/commissions` — change `commission-payment-management`
- Pago por **transferencia bancaria manual** (sin Stripe), gestionado por EMPRESA y OPERATOR
- Estados: **Pendiente** → **Transferida** (fecha + referencia opcional) → **Incidencia** (nota obligatoria: devolución, IBAN erróneo…), con vueltas atrás (reintentar / deshacer marcado erróneo)
- KPIs por estado (ámbar/verde/rojo) + **filtro por estado**
- Cada fila muestra el **IBAN del comercial** (o "sin IBAN") para copiarlo al hacer la transferencia
- Acciones por fila según estado + bulk "Marcar transferidas"
- El comercial lo ve reflejado en `/sales/commissions` (solo lectura; una incidencia cuenta como pendiente de cobro y muestra su nota)
- **Atribución manual (solo OPERATOR)** — change `manual-commission-attribution`:
  - Sección "Compras sin atribuir": lista las compras `COMPLETED` sin comisión
  - Selector de comercial por fila → crea la comisión con la tarifa vigente del comercial (misma fórmula que el webhook), estado PENDING, con traza en `notes`
  - Botón "Deshacer" en comisiones manuales aún pendientes (revierte errores de asignación); no aplica a comisiones pagadas ni automáticas
  - El `@unique` de `Commission.purchaseId` impide duplicar comisión sobre una misma compra
  - El rol EMPRESA no ve la sección ni el botón de deshacer

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
- KPIs: pendiente de cobro (ámbar; incluye incidencias), transferido (verde), total acumulado
- Historial de comisiones propias: comprador, importe venta, comisión, porcentaje, estado (Pendiente/Transferida/Incidencia con su nota), fechas
- Solo lectura — la empresa gestiona el pago
- Aviso "añade tu IBAN en tu perfil" si tiene comisiones sin IBAN configurado

#### Perfil `/sales/profile` — change `commission-payment-management`
- Datos del comercial (nombre, email, territorio, % comisión — solo lectura)
- **IBAN autoservicio**: el comercial introduce/edita su cuenta de cobro (validación de formato, guardado normalizado) + **titular de la cuenta** (puede ser una sociedad, no necesariamente el comercial); EMPRESA/OPERATOR lo ven en el panel de pagos pero no lo editan

---

### Vista Cliente (FIRM_ADMIN) — `/firm` — change `firm-client-portal`

Acceso: rol `FIRM_ADMIN` (el comprador de AI-Office; se crea automáticamente al pagar)

**Portal de cliente de una sola página, con estética AI-Office** (navy + serif + acentos amarillo/crema). El cliente ve exactamente cuatro bloques:
1. **Descarga del instalador** (`/api/v0/installer`)
2. **Código de activación** actual (o generarlo — cuota de asientos + caducidad 7 días)
3. **Consumo del mes** (tokens y tareas; sin costes internos)
4. **Facturación** — acceso al Stripe Billing Portal para descargar facturas/recibos y gestionar las suscripciones de software y tokens

**Todo lo demás está oculto para este rol**: baselines, usuarios, instances, MCP, settings y usage redirigen a `/firm`. La gestión operativa vive en el panel del operador. Prerequisito: Billing Portal configurado en el dashboard de Stripe.

---

## Landing raíz (venta de la casa) — change `root-sales-landing`

**URL:** `/` (iaofi.com)

- Visitantes **anónimos** ven la landing de venta completa con la identidad AI-Office: hero, equipo de 11 especialistas IA, cómo funciona, precios (mismas modalidades y cuotas que `/oferta`), FAQ y contacto. Usuarios con sesión van a su panel.
- **Compra directa = venta de la casa**: `Purchase.houseSale = true`, sin comercial → sin comisión y **excluida de "Compras sin atribuir"**. Los ingresos cuentan igual en `/empresa`.
- Los precios y el headline/vídeo salen de la misma configuración del panel (`/empresa/landing`).
- Checkout compartido en `src/lib/checkout.ts` (una sola verdad para `/` y `/oferta`).

---

## Landing pública de venta

**URL:** `/oferta/ai-office`

**Implementado:**
- Página pública accesible sin login
- Botón de compra integrado con Stripe Checkout
- Links de tracking: cada enlace enviado por un comercial lleva `?t=TOKEN`
  - El token se registra al visitar (`LandingVisit`) y al comprar (`Purchase`)
  - Permite atribuir la venta al comercial correcto automáticamente

### Modelo de precios — change `unified-pricing-token-options` (sustituye al desglosado)

**Precio unificado de cara al cliente** — no se separa software y tokens en la UI pública. Dos modalidades:

1. **Todo incluido (BUNDLED, recomendado)**: una sola cuota recurrente que incluye software + consumo de IA. Total anual = software efectivo (200 €) + tokens×12 (20 €/mes estándar; **15 €/mes con pago anual — pronto pago**). Cuota = total/pagos del periodo. Con defaults: **36,67 €/mes · 110 €/trimestre · 220 €/semestre · 380 €/año (ahorra 60 €)**.
2. **Proveedor de IA propio (EXTERNAL)**: el cliente usa su propio LLM → paga **solo el software, 200 €/año**. La config del proveedor externo en el instalador es spec futura (API pendiente de documentación).

**Stripe**: UNA sola suscripción por compra (la cuota del periodo, o la anual del software en EXTERNAL). Ya no existe la segunda suscripción del fee. `allow_promotion_codes: true` → **cupones** creados en el dashboard de Stripe, el cliente los introduce en el pago.

**Comisión del comercial**: intacta — solo sobre el componente software (`Purchase.feeAmountCents`), una vez, en la compra inicial. Los cupones de Stripe NO bajan la base de comisión (los descuentos "oficiales" se configuran en el panel y esos sí la bajan). Sin descuento inicial por defecto (D7): software a 200 € de lista.

**Configurable por el administrador (OPERATOR)** en `/empresa/landing`:
- Precio del software anual + descuento (€ o %)
- Tokens €/mes estándar y **€/mes con pago anual** (pronto pago, validado ≤ estándar)
- Qué periodos se ofrecen (checkboxes)

**Registro interno**: `Purchase.tokenProvision` (BUNDLED/EXTERNAL) + desglose en `feeAmountCents`/`tokenAmountCents` (solo metadata/BD, invisible al cliente).

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

> **Paso 8b — Baseline por defecto** (change `default-firm-baseline`): una firma creada por compra no pasa por el configurator, así que no tiene paquete de configuración. Al parear el instalador (`/api/v0/pair`), si la firma no tiene baseline promovido, clawhub le genera uno **por defecto** (config AI-Office estándar, plantilla MiniMax/Ollama en `src/lib/default-baseline.ts`) para que el instalador provisione y el AI-Office arranque operativo. El cliente solo introduce el código de pairing; el proveedor de IA y su clave los provee el instalador/bridge. Si el configurator o el firm_admin ya dejaron un baseline, ése tiene prioridad. Nota de billing pendiente: todos los clientes comparten la clave de IA, así que limitar el consumo al plan de tokens es un cambio aparte.

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
| Hosting app | Vercel (ia-suite-chi.vercel.app) | ✓ |
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