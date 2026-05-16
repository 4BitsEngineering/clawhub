# clawhub-agent (headless)

Single-file phone-home client para clawhub. Sin Electron, sin
`npm install`, sólo Node 18+ y `fetch` global.

## Para qué

Tu PC ya tiene un gateway + bridge de OpenClaw corriendo (vía
`autonomous-agents/bin/start-all.sh` o equivalente). Quieres que esa
instancia aparezca en clawhub con su stack local sin instalar
`clawgents-desktop` completo.

`clawhub-agent` es eso: paira contra clawhub una vez, persiste el token,
y manda heartbeats cada 60s con el estado del bridge + agentes que
sondea localmente.

## Requisitos

- Node 18+ en el PC (Node 22 recomendado).
- Tu gateway + bridge corriendo (default puerto bridge `3700`).
- Pairing code generado en clawhub UI desde `/firm` o
  `/operator/firms/<id>` → "Añadir trabajador".

## Uso

```bash
# Primer arranque — pairea con el code
CLAWHUB_URL=https://clawhub-three.vercel.app \
CLAWHUB_PAIRING_CODE=ABCD-EFGH \
BRIDGE_URL=http://localhost:3700 \
CLAWHUB_WORKER_LABEL="Carlos García" \
node clawhub-agent.js
```

```bash
# Arranques subsiguientes — token ya guardado, no necesitas el code
CLAWHUB_URL=https://clawhub-three.vercel.app \
BRIDGE_URL=http://localhost:3700 \
node clawhub-agent.js
```

Verás:

```
[2026-05-16T...] [info] clawhub-agent v0.1.0-headless
[2026-05-16T...] [info] clawhub_url: https://clawhub-three.vercel.app
[2026-05-16T...] [info] bridge_url:  http://localhost:3700
[2026-05-16T...] [info] sin token guardado — paireando…
[2026-05-16T...] [info] pareado a "Asesoría Demo" (instance ...)
[2026-05-16T...] [info] ♥  heartbeat OK · gateway:true · agents:5 · uptime 0s
[2026-05-16T...] [info] heartbeat cada 60s — Ctrl+C para parar
[2026-05-16T...] [info] ♥  heartbeat OK · gateway:true · agents:5 · uptime 60s
```

En clawhub → `/firm/instances/<tu-instance-id>` verás la card "Stack
local" con bridge URL, gateway WS state y la lista de agentes que tu
bridge tiene cargados.

## Variables de entorno

| Var | Default | Para qué |
|---|---|---|
| `CLAWHUB_URL` | `http://localhost:3000` | Base URL del control plane |
| `CLAWHUB_PAIRING_CODE` | — | Sólo en primer arranque; ignorado después |
| `BRIDGE_URL` | `http://localhost:3700` | Bridge local a sondear; vacío para skip probe |
| `CLAWHUB_WORKER_LABEL` | `os.userInfo().username` | Nombre visible en clawhub UI |
| `CLAWHUB_HEARTBEAT_S` | `60` | Intervalo en segundos |
| `CONFIG_PATH` | `~/.clawhub-client/config.json` | Donde se guarda el token (mode 600) |

## Como daemon

### Linux (systemd)

```ini
# /etc/systemd/system/clawhub-agent.service
[Unit]
Description=clawhub phone-home agent
After=network-online.target

[Service]
Type=simple
User=youruser
WorkingDirectory=/home/youruser
Environment="CLAWHUB_URL=https://clawhub-three.vercel.app"
Environment="BRIDGE_URL=http://localhost:3700"
Environment="CLAWHUB_WORKER_LABEL=PC-Carlos"
ExecStart=/usr/bin/node /home/youruser/clawhub-agent.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now clawhub-agent
journalctl -u clawhub-agent -f
```

### Windows (NSSM o Scheduled Task)

```powershell
# Con NSSM
nssm install clawhub-agent "C:\Program Files\nodejs\node.exe" "C:\path\to\clawhub-agent.js"
nssm set clawhub-agent AppEnvironmentExtra ^
  CLAWHUB_URL=https://clawhub-three.vercel.app ^
  BRIDGE_URL=http://localhost:3700 ^
  CLAWHUB_WORKER_LABEL=PC-Maria
nssm start clawhub-agent
```

## Si algo falla

- **`pair failed: 404`** → code mal escrito o no existe en clawhub.
- **`pair failed: 410`** → code expirado (10 min) o ya usado. Genera otro.
- **`instance_token rechazado`** → la instancia fue borrada en clawhub
  UI. El agente borra config y exit 1; relanzas con un code nuevo.
- **`bridge unreachable`** en el log heartbeat → tu bridge no responde
  en `BRIDGE_URL`. Verifica que esté corriendo con
  `curl http://localhost:3700/healthz`.
