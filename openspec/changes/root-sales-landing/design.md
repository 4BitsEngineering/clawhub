# Design: root-sales-landing

## Context

`/` redirige por rol (o a /login). `/oferta/[slug]` ya vende con el modelo unificado (BUNDLED/EXTERNAL, cupones) y la identidad AI-Office; su `checkoutAction` vive inline. El webhook procesa `checkout.session.completed` creando Firm/licencia/onboarding y comisión solo si hay `trackingToken` con salesRep. `/empresa/commissions` lista como "sin atribuir" las compras COMPLETED sin comisión (para asignarlas a un comercial).

## Decisions

### D1 — Raíz: landing para anónimos, panel para sesiones

`getSession()`: con rol → redirect al panel (como hoy); sin sesión → landing. El comprador es anónimo; los usuarios internos no pierden su atajo.

### D2 — Checkout compartido en `src/lib/checkout.ts`

`createUnifiedCheckout({ slug, provision, period, email, trackingToken, houseSale })` encapsula: carga de LandingPage, validación de periodo ofrecido, cálculo de cuota (helpers de pricing), sesión de Stripe (un line item recurrente, promotion codes, tarjeta, metadata). `/oferta/[slug]` y `/` la consumen — una sola verdad.

### D3 — Venta de la casa: `houseSale`

La raíz pasa `houseSale: "1"` en metadata; el webhook persiste `Purchase.houseSale = true`. Sin tracking → sin comisión (lógica existente). La lista "Compras sin atribuir" excluye `houseSale: true` — estas ventas son de la empresa y no deben asignarse a comerciales. Los KPIs de ingresos no cambian (suman todas las compras).

- **Por qué columna y no convención:** sin ella, cada venta de la casa quedaría eternamente en la bandeja de atribución manual del operador.

### D4 — Contenido de marketing en código, precios del panel

Secciones: hero (usa `headline` del panel + subtítulo fijo), **equipo de especialistas IA** (los 11 del producto: Agenda y Correo, Gestor documental, Automatizaciones, Web y Publicación, Asesoría Jurídica, Redes Sociales, Marketing, Redacción, Desarrollo de Software, Asesoría Fiscal, Asesoría Laboral), cómo funciona (3 pasos: contrata → instala con tu código → tu equipo trabajando), vídeo si está configurado, **precios** (mismas tarjetas/cuotas que /oferta), FAQ breve, footer con contacto y acceso (/login).

- **Por qué en código:** es la página de marketing de la casa; iterar copy = editar el archivo. El panel sigue mandando en headline, vídeo y precios.

### D5 — Identidad AI-Office

`.aio-canvas` como lienzo; tarjetas crema; titulares serif con punto amarillo; chips amarillos. Coherente con /oferta y los paneles.

## Risks / Trade-offs

- [Duplicación visual de las tarjetas de precios entre / y /oferta] → se asume de momento (mismo markup copiado con la cuota de la lib compartida); extraer componente común es iteración si diverge.
- [Compra de la casa sin prospect] → correcto: no hay funnel de comercial; el comprador entra directo. La success page y el onboarding funcionan igual (dependen de la Purchase, no del prospect).

## Open Questions

- ¿Analytics/píxeles en la landing raíz? Futuro.
- ¿Extraer `<PricingCards>` compartido si el copy diverge? Iteración.
