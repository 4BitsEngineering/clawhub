# CI/CD templates para auto-publicar bundles a clawhub

Estos workflows se copian a los repos que producen bundles (autonomous-agents,
overlays, openclaw fork, clawgents-desktop). Cuando alguien hace `git push` de
un tag `v*`, GitHub Actions:

1. Empaqueta el repo (tar.gz o `.exe` según el caso).
2. Crea un GitHub Release y sube el artefacto.
3. Llama a `POST /api/v0/bundles/register` en clawhub con sha256 + url +
   sizeBytes para auto-registrarlo.

Tras esto, el bundle queda disponible en `/operator/stack`. El operator solo
tiene que pinearlo a las firmas que lo quieran usar.

## Configuración por repo

Cada repo necesita 2 secrets en GitHub Settings → Secrets and variables → Actions:

| Secret                | Qué es                                                       |
| --------------------- | ------------------------------------------------------------ |
| `CLAWHUB_URL`         | URL del control plane, ej. `https://clawhub-three.vercel.app` |
| `CLAWHUB_API_KEY`     | Valor de `OPERATOR_API_KEY` en clawhub (env var Vercel)      |

Genera la API key con `openssl rand -hex 32` y configúrala en ambos lados.

## Templates disponibles

- `release-overlay.yml` → para overlays (asesoria, ai-office, content, marketing, temarios)
- `release-bridge.yml`  → para autonomous-agents (kind=BRIDGE)
- `release-openclaw.yml`→ para tu fork de openclaw (kind=OPENCLAW)
- `release-installer.yml`→ para clawgents-desktop (kind=INSTALLER, .exe)

## Cómo desplegarlos

```bash
# En el repo de destino (ej. asesoria overlay)
mkdir -p .github/workflows
cp clawhub/scripts/ci-templates/release-overlay.yml .github/workflows/

# Editar el header del workflow: KIND, OVERLAY_ID, CHANNEL
# Commit + push
git add .github/workflows/release-overlay.yml
git commit -m "ci: auto-register bundles a clawhub"
git push
```

A partir de ahí, cada `git tag v1.2.3 && git push --tags` dispara la
publicación completa.
