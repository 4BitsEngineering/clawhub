# Proposal: buyer-account-activation

## Why

Tras la compra, el webhook ya crea un usuario FIRM_ADMIN con el email del comprador y existe el portal `/firm` (instalador, código, consumo, facturación). Pero el comprador **no puede acceder**: el usuario nace sin contraseña y el login por magic link se retiró de la UI. Hoy el email post-compra entrega la licencia y el instalador, pero no da acceso al portal — el cliente no puede recuperar su código, ver su consumo ni gestionar su suscripción sin escribirnos.

## What Changes

### Activación de cuenta en el email post-compra (opción recomendada)

- El mismo email que entrega la licencia incluye un botón **"Activa tu cuenta"** con un enlace de un solo uso (token con caducidad de 7 días).
- El enlace lleva a **`/activar`**: página AI-Office donde el cliente crea su contraseña (mín. 8 caracteres, doble campo) y queda logueado → redirect a `/firm`.
- Token caducado o usado ⇒ mensaje claro con botón "Reenviar enlace de activación" (introduce su email; si existe un FIRM_ADMIN sin contraseña, se reenvía; respuesta neutra si no, sin revelar existencia de cuentas).
- Usuarios con contraseña ya establecida siguen entrando por `/login` como hasta ahora.

### Por qué NO pedir la cuenta antes de comprar

Se consideró pedir email+contraseña antes del checkout (idea alternativa) y se descarta en esta iteración:

1. **Fricción pre-pago**: cada campo extra antes de pagar cuesta conversión; la contraseña no aporta nada a la venta.
2. **Estado huérfano**: crear la cuenta antes de pagar deja usuarios sin compra si abandonan el checkout (limpieza, GDPR, métricas sucias).
3. **Stripe ya pide el email**: el dato de identidad lo tenemos; la contraseña puede establecerse en el primer acceso sin perder nada.

Si más adelante se quiere pre-registro (p. ej. para carritos recuperables), se propone como spec aparte.

## Non-goals

- Enviar contraseñas en texto plano por email (nunca).
- Cambio/recuperación de contraseña general para todos los roles (existe el flujo de invitaciones para comerciales; una recuperación self-service completa es otra spec).
- Verificación de email adicional (el enlace de activación ya demuestra control del buzón).

## Capabilities

- `buyer-account-activation`: token de activación post-compra, página /activar con alta de contraseña, reenvío del enlace.
