# Design: aioffice-brand-theme

## Context

Los componentes de la app consumen tokens CSS (`--background`, `--foreground`, `--card`, `--border`, `--muted`, `--muted-foreground`, `--brand`, `--brand-foreground`) vía Tailwind y las clases `card-paper`/`card-quiet`. Eso permite re-tematizar por scope sin tocar páginas. El portal `/firm` ya define la paleta AI-Office inline: navy `#0c2b3d`/`#082130`, crema `#f5efe4`, amarillo `#f2c94c`, serif `Georgia`.

## Decisions

### D1 — Scope `.aio-canvas` con doble nivel de variables

En `globals.css`:
- `.aio-canvas`: fondo degradado navy, y override de tokens para el lienzo (foreground crema, muted-foreground crema 72%, border crema 16%, `--brand` amarillo con foreground navy).
- `.aio-canvas .card-paper / .card-quiet`: reset a tarjeta crema — foreground navy profundo, muted-foreground piedra, border navy 12%, `--background` marfil (para inputs/selects internos) y `--brand` navy (botones dentro de tarjeta como en el portal).

**Por qué:** cero ediciones en páginas interiores; cualquier página nueva hereda el tema al montarse dentro de un shell.

### D2 — Titulares serif automáticos

`.aio-canvas h1 { font-family: Georgia, serif }` y `.aio-canvas h1::after { content: "."; color: amarillo }`. El punto amarillo de marca se aplica a todos los h1 sin tocar markup.

- **Trade-off:** algún h1 con interrogación o cifra llevará punto igualmente; aceptable y coherente con la marca.

### D3 — Shells como portadores del tema

Cada shell (operator/empresa/sales) pinta el header navy con "AI Office" + chip amarillo del área, y envuelve la zona de trabajo con `.aio-canvas`. Las navs pasan a pill activa amarilla (texto navy) e inactiva crema 70%. El login aplica el lienzo directamente en su `main`.

### D4 — El toggle de tema se mantiene

`.aio-canvas` re-declara los tokens a nivel de elemento, así que prevalece sobre `:root`/`.dark`. El toggle sigue afectando a zonas sin shell (p. ej. landing pública).

## Risks / Trade-offs

- [Acentos existentes (esmeralda del funnel, violeta) chocan con la nueva paleta] → conviven dentro de tarjetas crema; revisión visual por rol y ajuste puntual solo si algo queda ilegible.
- [Componentes que usan tokens no cubiertos (`--primary`, `--secondary`)] → se añaden al scope solo si la verificación visual lo pide.

## Open Questions

- ¿Cargar la webfont serif real de la marca (en vez de Georgia)? Iteración futura, un solo cambio en el scope.
