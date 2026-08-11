# default-firm-baseline

## ADDED Requirements

### Requirement: Baseline por defecto al parear una firma sin paquete
Cuando `POST /api/v0/pair` procesa un código válido y la firma **no tiene** ningún `FirmBaseline` promovido, el sistema SHALL crear un baseline por defecto promovido (config AI-Office estándar) para esa firma antes de resolver `promoted_baseline_id`, de modo que la respuesta incluya un baseline descargable.

#### Scenario: Firma de compra sin baseline
- **WHEN** el instalador parea con el código de una firma creada por compra (sin baseline)
- **THEN** el sistema crea un baseline por defecto promovido y `pair` devuelve su `promoted_baseline_id` no nulo

#### Scenario: Descarga del baseline por defecto
- **WHEN** el instalador descarga el baseline devuelto vía `GET /api/v0/baselines/[id]`
- **THEN** recibe al menos un archivo `openclaw.json` de categoría `OPENCLAW_CONFIG` con contenido válido

### Requirement: Prioridad del baseline propio de la firma
Si la firma ya tiene un baseline promovido (subido por el configurator o por el firm_admin), el sistema SHALL usar ése y NO SHALL crear ni promover el baseline por defecto.

#### Scenario: Firma con baseline del configurator
- **WHEN** el instalador parea con una firma que ya tiene un baseline promovido
- **THEN** `pair` devuelve el baseline existente y no se crea ninguno por defecto

#### Scenario: Idempotencia entre pareos
- **WHEN** un segundo PC de la misma firma parea después de que ya se creó el baseline por defecto
- **THEN** no se crea un segundo baseline por defecto; se reutiliza el promovido existente

### Requirement: Contenido por defecto desde una fuente única
El contenido del baseline por defecto SHALL provenir de una única fuente en el repositorio, con al menos un `openclaw.json` válido (con los placeholders que el instalador sustituye), y cada archivo SHALL registrar su `sha256` y `sizeBytes`.

#### Scenario: Fuente única
- **WHEN** se crea un baseline por defecto
- **THEN** sus archivos coinciden con la definición de `src/lib/default-baseline.ts` y cada uno lleva su hash y tamaño correctos

### Requirement: El fallo de la provisión no rompe el pairing
Si la creación del baseline por defecto falla, `pair` SHALL completar igualmente el registro de la instancia y responder, registrando el error, con `promoted_baseline_id` nulo.

#### Scenario: Fallo al crear el baseline
- **WHEN** la creación del baseline por defecto lanza un error durante el pareo
- **THEN** la `Instance` queda creada, la respuesta de pairing se devuelve con `promoted_baseline_id: null` y el error queda registrado
