# Design: suite-contract-signing

## Modelo

```
ContractTemplate { id, version Int @unique, title, bodyHtml, active Boolean, createdAt }
SuiteContract {
  id, suiteId, templateVersion Int,
  signerName, signerEmail,
  acceptedAt, ipHash, userAgent,
  pdfPath String?,          // ruta en Supabase Storage
  createdAt
  @@unique([suiteId, templateVersion])
}
```

- `ipHash`: SHA-256 de la IP (mismo criterio que `PairAttempt` — no guardamos IP en claro).
- La "versión vigente" = `ContractTemplate` con `active = true` y mayor `version`.

## Gating

Helper `requireSignedSuite()` en la capa de sesión de Suite: si `sesión.suiteId` existe y **no** hay `SuiteContract` para `(suiteId, versiónVigente)`, redirigir a `/suite/contrato`. Se aplica en el layout del panel de Suite (todas las rutas salvo la propia de contrato y el logout). OPERATOR/EMPRESA no pasan por el gate.

## Firma

Server action `signContractAction`:
1. Revalida sesión y `suiteId`; carga la versión vigente.
2. Exige `signerName` no vacío y casilla marcada.
3. Crea `SuiteContract` (email de la sesión, `acceptedAt = now`, `ipHash`, `userAgent`). `@@unique` evita doble firma.
4. Genera el PDF (contrato + bloque "Firmado por <nombre> (<email>) el <fecha> · IP <hash corto>") y lo sube a Storage (`contracts/<suiteId>/v<version>.pdf`).
5. Redirige al panel ya desbloqueado.

Generación de PDF: reutilizar el enfoque del repo si ya hay uno (el overlay tiene `md2docx`); en clawhub, una librería server-side ligera de HTML→PDF, o render del `bodyHtml` a PDF. Si el PDF falla, la firma **se registra igual** (el PDF es un artefacto secundario) y se reintenta; el acceso no se bloquea por el PDF.

## Contrato para OPERATOR

- CRUD del `ContractTemplate` (editar bodyHtml, publicar nueva versión).
- Detalle de Suite: estado de firma (versión, fecha, firmante) + descarga del PDF.

## Riesgos

- **Validez legal de la firma ligera**: suficiente para B2B con aceptación informada + trazabilidad (IP/fecha/versión/PDF), pero no es firma cualificada. Documentado como decisión de negocio (v1).
- **HTML→PDF en serverless (Vercel)**: evitar dependencias pesadas (headless Chrome). Preferir una librería pura JS; si no da la talla, generar el PDF de forma diferida (cola) sin bloquear la firma.
