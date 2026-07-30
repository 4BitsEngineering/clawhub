# Funcionalidades — estado actual

Última actualización: 2026-07-27

---

## Todo contra Supabase

**Sí, correcto.** La base de datos es PostgreSQL en Supabase, schema `clawhub`.
El ORM es Prisma v7 con adapter-pg. El schema `clawhub` está expuesto en la API de Supabase para que la Edge Function de Stripe pueda acceder también.

---

## Login

**Implementado con NextAuth v5 (Auth.js).**

- En **desarrollo**: bypass con botones "Entrar como Operador / Empresa / Comercial" en `/login` (variable `DEV_AUTH_ENABLED=true`). No hace falta contraseña ni email real.
- En **producción**: magic link por email (el enlace se loguea en consola en dev). Solo puede entrar un email que ya exista en la tabla `User` — si no está dado de alta, no entra.
- Roles soportados: `OPERATOR`, `EMPRESA`, `COMERCIAL`, `FIRM_ADMIN`
- Cada rol tiene su propio layout y rutas protegidas mediante `requireXxx()` en los Server Components.

**Pendiente para producción:**
- [ ] Configurar proveedor de email real para los magic links (actualmente solo log en consola)
- [ ] Eliminar `DEV_AUTH_ENABLED=true` del `.env` de producción

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

#### Editor de landing `/empresa/landing`
- Editar headline, precios (original / con descuento), activar/desactivar
- La landing se crea automáticamente con valores por defecto si aún no existe en BD (corregido bug de 404)

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

> **Paso 7b pendiente de completar:** tras crear el usuario FIRM_ADMIN, el comprador debería ser redirigido (o recibir un email) con acceso al **instalador de AI-Office**. La ruta del instalador está por definir — cuando se indique, se añade el redirect/email en la Edge Function justo después de crear el usuario.

**Comportamiento previsto:**
- El comprador termina el checkout en Stripe
- Stripe redirige a una página de "gracias" (actualmente la landing, parámetro `success_url`)
- Desde ahí (o por email automático) accede al instalador con su cuenta ya creada

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
- [ ] Verificar dominio en Resend para enviar emails desde dominio propio
- [ ] Cambiar `STRIPE_SECRET_KEY` a `sk_live_...` en `.env` y en Supabase secrets
- [ ] Crear webhook de Stripe de producción (misma URL de Supabase, evento `checkout.session.completed`)
- [ ] Desactivar `DEV_AUTH_ENABLED` en producción
- [ ] Configurar email real para magic links de NextAuth
- [ ] Cambiar `AUTH_URL` a la URL de producción (no localhost)
