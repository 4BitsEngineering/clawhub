# Proposal: aioffice-brand-theme

## Why

El portal del cliente (`/firm`) estrenó la identidad visual AI-Office (navy profundo, titulares serif con punto amarillo, tarjetas crema). El resto de paneles (operador, empresa, comercial) y la pantalla de login mantienen estilos dispares (azul, violeta, esmeralda) que no transmiten una sola marca. Se quiere la misma identidad en toda la aplicación.

## What Changes

- **Tema AI-Office transversal** aplicado mediante un scope de variables CSS (`.aio-canvas` en `globals.css`): fondo navy, texto crema, bordes translúcidos, `--brand` amarillo sobre el lienzo; dentro de las tarjetas (`card-paper`/`card-quiet`) las variables se resetean a crema con texto oscuro y `--brand` navy. Los titulares `h1` pasan a serif con punto final amarillo automático (`::after`).
- **Shells restilizados**: `OperatorShell`, `EmpresaShell` y `SalesShell` — header navy con wordmark "AI Office" + chip amarillo del área (Operaciones / Empresa / Comercial), navegación con pill activa amarilla, y el lienzo de trabajo envuelto en `.aio-canvas`.
- **Login** con el mismo lienzo y tarjeta crema.
- Las páginas interiores **no se tocan**: heredan el tema por las variables (esa es la gracia del enfoque).

## Capabilities

### New Capabilities

- `aioffice-brand-theme`: identidad visual AI-Office unificada en todos los paneles y el login, implementada como scope de variables CSS aplicado por los shells.

## Impact

- **Código:** `src/app/globals.css` (bloque `.aio-canvas`), `operator-shell/nav`, `empresa-shell`, `sales-shell/nav`, `src/app/login/page.tsx`. El portal `/firm` ya usa esta estética (inline); queda como está.
- **Sin cambios de datos ni de lógica.** El toggle claro/oscuro sigue existiendo; el lienzo AI-Office prevalece visualmente en las zonas con shell.
- **Riesgo controlado:** los acentos puntuales de las páginas (pills de estado, colores del funnel) conviven dentro de tarjetas crema; se revisan en la verificación visual por rol.
