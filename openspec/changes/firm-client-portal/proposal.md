# Proposal: firm-client-portal

## Why

El panel del cliente (`/firm`, rol FIRM_ADMIN) hoy es un panel de operaciones interno: gestión de instances, baselines, usuarios de firma, MCP, settings y usage detallado. El FIRM_ADMIN es **el cliente final** que compró AI-Office — no debe ver ni tocar la maquinaria interna (baselines, usuarios, comandos), y el estilo actual (panel técnico) no está a la altura de lo que ve un cliente de pago. Además no tiene forma de descargar sus facturas ni gestionar sus suscripciones.

## What Changes

- `/firm` se convierte en un **portal de cliente de una sola página** con exactamente cuatro bloques:
  1. **Descarga del instalador** (enlace a `/api/v0/installer`)
  2. **Código de activación actual** (el pairing activo más reciente; si no hay, generar uno nuevo — con la validación de cuota de asientos existente y caducidad de 7 días, como el flujo de compra)
  3. **Consumo** (uso de IA del mes: tokens y tareas, agregado de `UsageRecord` de la firma; sin costes internos)
  4. **Facturación** — enlace al **Stripe Billing Portal** del cliente para descargar facturas/recibos y gestionar las suscripciones (tokens y software)
- **Todo lo demás desaparece para este rol**: las subrutas `/firm/baselines`, `/firm/users`, `/firm/instances/[id]`, `/firm/mcp`, `/firm/settings` y `/firm/usage` redirigen a `/firm`. El FIRM_ADMIN no puede crear baselines, ni verlas, ni crear usuarios, ni operar instances.
- **Rediseño visual estilo AI-Office** (referencia: captura del producto): fondo azul marino profundo, titulares serif elegantes con punto final, acentos crema/amarillo, tarjetas claras redondeadas. Autocontenido en la página (no cambia el tema global del resto de la app).

## Capabilities

### New Capabilities

- `firm-client-portal`: portal simplificado y con marca AI-Office para el cliente FIRM_ADMIN — instalador, código de activación, consumo y facturación vía Stripe Billing Portal; resto de operaciones ocultas para este rol.

## Impact

- **Código:** `src/app/firm/page.tsx` (reescritura como portal), redirects en las subrutas de `/firm/*`, helper/action de Stripe Billing Portal (deriva el `customer` desde `Purchase.stripeSubscriptionId` de la última compra completada de la firma).
- **Modelo:** sin migración.
- **Prerequisito operativo:** el **Billing Portal debe estar configurado** en el dashboard de Stripe (Settings → Billing → Customer portal → Save) — en test mode suele bastar con guardar la configuración por defecto una vez.
- **Operador no afectado:** `/operator/firms/[id]` sigue teniendo la gestión completa (baselines, usuarios, kill-switch…). Lo que se quita es solo la vista del cliente.
- **Fuera de alcance:** gestión de asientos/upgrade de plan desde el portal; histórico de consumo con gráficas; multi-idioma.
