# Bloquear first-pair para firmas sin baseline promovido

Fecha: 2026-07-11 · Estado: **aprobado** (JJ) · Repo: `clawhub`

## Problema

Una firma sin `FirmBaseline` promovido puede emitir pairing codes desde las UIs
de clawhub, pero el instalador fallará SIEMPRE al provisionar ("La firma no
tiene un paquete (baseline) promovido") — el fallo se descubre días después,
en la máquina del cliente (caso real 11-jul). Solo el configurator
(`/api/v0/register`) fabrica baselines promovidos; clawhub no puede.

## Decisión (JJ, 11-jul)

**Deshabilitar first-pair + banner; re-pair solo banner.**

## Diseño

Regla común: `firmBaseline.findFirst({ where: { firmId, isPromoted: true } })`
— sin resultado ⇒ la firma no es instalable.

1. **Helper** `firmHasPromotedBaseline(firmId): Promise<boolean>` en
   `src/lib/` (una consulta; lo usan las tres páginas y los guards).
2. **`operator/firms/[id]/page.tsx`**: banner ámbar ("Esta firma no tiene
   paquete instalable (baseline promovido) — el instalador fallará al
   provisionar. Regístrala desde el configurator.") + botón "generar código"
   deshabilitado. La server action `generatePairingTokenAction` re-comprueba
   y retorna sin crear token (las server actions son endpoints POST
   independientes; el disabled no es barrera — mismo patrón que su re-auth).
3. **`firm/page.tsx`** (alta de PC, dos formularios first-pair): mismo banner
   + disable + guard en las server actions.
4. **`firm/instances/[id]/page.tsx`** (re-pair): solo banner de aviso; la
   action NO se bloquea.

Sin cambios en APIs `v0/*`, sin migraciones. Copy en español coherente con el
existente.

## Verificación

`npm run lint` + `npm run build` (el repo no tiene suite de tests). Prueba
manual: firma nueva desde operator (nace sin baseline) → banner + botón
deshabilitado + action inerte; borrar la firma de prueba con
`_cleanup-firm.mjs`. Caveat repo: Next.js bleeding-edge — consultar
`node_modules/next/dist/docs/` ante cualquier duda de server actions/RSC.

## Fuera de alcance

- Cambios en `/api/v0/pair` (el installer ya emite su error claro).
- Auto-crear baselines desde clawhub (imposible por diseño: el paquete lo
  fabrica el wizard del configurator).
