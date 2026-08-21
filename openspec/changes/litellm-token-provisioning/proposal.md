# Proposal: litellm-token-provisioning

## Why

En el plan **Todo incluido (BUNDLED)** los tokens los ponemos nosotros, pero el baseline por defecto instala la plantilla MiniMax y el asistente pide al cliente una `MINIMAX_API_KEY` que no tiene. Con el proxy LiteLLM de 4bits (`proxyllm.smartbotics.eu`, doc en `doc-litellm/`), clawhub puede dar de alta automáticamente el acceso LLM de cada firma — el cliente instala y funciona, sin introducir ninguna clave. Además necesitamos **corte de servicio por impago** (bloquear la key) sin intervención manual.

## What Changes

### Alta automática por firma (solo BUNDLED)

- Al completarse la compra, el webhook llama al proxy: `POST /team/new` (`TEAM-<firmId corto>`, presupuesto mensual, TPM/RPM) y `POST /key/generate` (`KEY-<firmId corto>`, `all-team-models`, 360d).
- **Modelo compartido**: un único modelo público (p. ej. `MODEL-AIOFFICE-MINIMAX`), creado una vez a mano en el proxy, que referencian todos los teams. Nada de modelo-por-cliente (token del proveedor en un solo sitio; cambiar de proveedor = una operación). Excepciones puntuales por cliente: `POST /team/update` con un modelo dedicado — fuera de alcance automatizarlo.
- Se persiste en la Firm: `litellmTeamId`, `litellmKeyId` (hash, para block/unblock) y la virtual key **cifrada en reposo** (AES-256-GCM con secret propio).
- No bloqueante: si el proxy falla, la compra sigue; el pair reintenta el alta antes de generar el baseline.

### Presupuesto

- **15 €/mes por seat** (valor por defecto; configurable). Presupuesto del team = valor × `Firm.seatsPurchased`, `budget_duration 30d`.
- Al ampliar seats (`onSeatsChanged` de multi-seat-purchases): `POST /team/update` con el nuevo presupuesto.
- Nota: LiteLLM presupuesta en USD — el valor exacto es un ajuste del operator (por defecto 16 ≈ 15 €).

### Baseline sin pedir claves

- `defaultBaselineFiles()`: si la firma tiene virtual key, el `base/openclaw.json` sale con el proveedor `litellm` (URL del proxy + key inline) y `agents.defaults.model` apuntando al modelo compartido; el `instance-manifest.json` deja `env[]` vacío → el paso Credenciales del instalador no pide nada. **Cero cambios en el instalador.**
- Sin key (EXTERNAL o alta fallida): plantilla MiniMax actual (comportamiento de hoy). EXTERNAL sigue introduciendo su propia clave.

### Kill-switch por impago

- `invoice.payment_failed` / `customer.subscription.deleted` de una suscripción de la firma → `POST /key/block`.
- `invoice.paid` posterior → `POST /key/unblock`.
- Regla v1: cualquier impago bloquea la key del team (todos los seats); al regularizar se desbloquea. Activity en ambos sentidos para el operator.

### Operator

- Detalle de firma: estado de tokens (team, presupuesto, key bloqueada o no) + botones manuales block/unblock.

## Non-goals

- Crear el modelo compartido desde clawhub (alta manual única en la UI del proxy).
- Modelos dedicados por cliente automatizados.
- Mostrar el consumo LiteLLM en /firm (iteración futura: `GET /team/info` → gasto real).
- Migrar instalaciones existentes (PRUEBAS-*): se regeneran baselines si hace falta a mano.

## Capabilities

- `litellm-token-provisioning`: team+key por firma, presupuesto por seats, baseline con key inyectada, block/unblock por impago.
