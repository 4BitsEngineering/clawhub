# Proposal: root-sales-landing

## Why

Quien aterriza en el dominio raíz (iaofi.com) hoy es redirigido al login — no hay escaparate. Se necesita una **landing de venta como raíz del proyecto**: marketing completo del producto con la identidad AI-Office y compra directa desde ella. Estas ventas no van ligadas a ningún comercial: son **ventas de la casa** (rol Empresa) — sin comisión y sin quedar pendientes de atribución manual.

## What Changes

- `/` (raíz) muestra la **landing de venta** para visitantes anónimos: hero con la marca, el equipo de especialistas IA del producto, cómo funciona, precios (mismas dos modalidades y cuotas unificadas que `/oferta`), FAQ breve y contacto. Usuarios con sesión siguen yendo a su panel (comportamiento actual conservado).
- **Compra desde la raíz**: mismo checkout unificado (BUNDLED/EXTERNAL, cupones, tarjeta), marcado como **venta de la casa** — `Purchase.houseSale = true`. Sin tracking de comercial → sin comisión, y **excluida de "Compras sin atribuir"** (no debe asignarse a ningún comercial).
- **Checkout compartido**: la creación de la sesión de Stripe se extrae a `src/lib/checkout.ts`, usada por `/oferta/[slug]` y la raíz (misma lógica, cero duplicación). Los precios salen de la misma `LandingPage` (slug `ai-office`) que edita el administrador.

## Capabilities

### New Capabilities

- `root-sales-landing`: landing de venta en la raíz con compra directa como venta de la casa (sin comercial, sin comisión, excluida de la atribución manual), reutilizando la configuración de precios y el checkout unificado existentes.

## Impact

- **Código:** `src/app/page.tsx` (landing raíz), `src/lib/checkout.ts` (nuevo, extracción), `src/app/oferta/[slug]/page.tsx` (refactor a lib compartida), `src/app/empresa/commissions/page.tsx` (excluir houseSale de sin-atribuir), webhook (persistir `houseSale`).
- **Modelo:** `Purchase.houseSale Boolean @default(false)` (aditivo).
- **Ingresos:** las ventas de la casa cuentan igual en los KPIs de `/empresa` (facturación de la empresa).
- **Fuera de alcance:** SEO avanzado/analytics; CMS del contenido de marketing (secciones en código; headline/vídeo reutilizan la config del panel); multi-idioma.
