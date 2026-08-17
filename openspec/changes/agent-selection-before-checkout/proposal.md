# Proposal: agent-selection-before-checkout

## Why

Hoy toda compra provisiona el mismo equipo: el baseline por defecto instala el catálogo completo de clawcrew (14 agentes). Pero cada negocio es distinto — una asesoría no necesita al desarrollador de software, y un e-commerce quizá no quiera las asesorías fiscal/laboral. La decisión comercial es que **el comprador elija su equipo antes de pagar**: la selección forma parte de la oferta ("elige tus especialistas") y el software llega instalado exactamente con lo que el cliente pidió.

## What Changes

### Selección de agentes en la landing (antes del pago)

- En la landing raíz (`/`) y en `/oferta/[slug]`, antes del botón de pago, el comprador ve el **catálogo de 14 agentes** (icono, nombre, descripción corta) con checkboxes.
- **Por defecto todos seleccionados** — deseleccionar es la acción excepcional.
- El **Planificador es obligatorio** (orquestador interno del equipo): aparece marcado y bloqueado, con nota "incluido siempre".
- Aplica a **ambas modalidades** (Todo incluido y proveedor propio / EXTERNAL).
- **El precio no cambia** según el número de agentes (de momento; una tarificación por agente queda explícitamente fuera de alcance).

### La selección viaja con la compra

- `createUnifiedCheckout` añade la selección a la **metadata de la sesión de Stripe** (`selectedAgents`: ids separados por coma — 14 ids ≈ 130 caracteres, muy por debajo del límite de 500 de Stripe).
- El **webhook** persiste la selección en la compra (`Purchase.selectedAgents String[]`).
- Selección vacía o metadata ausente ⇒ se interpreta como **todos** (compatibilidad con compras anteriores y ventas manuales).

### El baseline se genera con los agentes elegidos

- Al parear el instalador, `provisionDefaultBaseline` consulta la **última compra de la firma** y genera `overlay/overlay-config.json` + `overlay/dispatch.config.json` **solo con los agentes seleccionados** (más el planner, siempre).
- Sin compra o sin selección ⇒ catálogo completo (comportamiento actual).

### Visibilidad de la selección

- **Panel /empresa** (operator): el detalle de la compra muestra el equipo contratado.
- **Portal /firm**: el cliente ve su equipo en el bloque de información de su licencia.

## Non-goals

- Precio por agente o por tamaño de equipo.
- Cambiar la selección después de la compra (upgrade/downgrade del equipo) — iteración futura; requerirá regenerar baseline y re-provisionar.
- Editor de equipo en el panel del operator (el configurator ya cubre el caso avanzado).

## Capabilities

- `agent-selection-checkout`: selección de agentes en landings, transporte por Stripe metadata, persistencia en Purchase y baseline por firma acorde a la selección.
