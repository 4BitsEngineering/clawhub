# Despliegue en Vercel por línea de comandos (rama no productiva)

Guía para desplegar **clawhub** en Vercel desde la CLI estando en una rama distinta a `main` (por ejemplo `suite`). El resultado es un **Preview Deployment**: una URL única por despliegue que no afecta a producción.

## 1. Requisitos previos

1. Tener instalada la CLI de Vercel (global):

   ```powershell
   npm i -g vercel
   ```

   Comprueba la versión:

   ```powershell
   vercel --version
   ```

2. Iniciar sesión (solo la primera vez en la máquina):

   ```powershell
   vercel login
   ```

3. Proyecto enlazado. Este repositorio **ya está enlazado** (existe `.vercel/project.json`). Si alguna vez hay que volver a enlazarlo:

   ```powershell
   vercel link
   ```

## 2. Situarse en la rama de trabajo

```powershell
git checkout suite
git status
```

Confirma o guarda (commit/stash) los cambios pendientes: la CLI despliega el contenido del directorio local, no lo que haya en el remoto de Git.

## 3. Variables de entorno

El build ejecuta `prisma generate && next build`, y la app usa base de datos (Prisma/pg), NextAuth, Stripe, Resend, etc. Las variables deben existir en Vercel para el entorno **Preview**.

- Ver las variables configuradas:

  ```powershell
  vercel env ls
  ```

- Añadir una variable al entorno Preview:

  ```powershell
  vercel env add NOMBRE_VARIABLE preview
  ```

- (Opcional) Descargar las variables de Preview a un fichero local para probar el build antes de desplegar:

  ```powershell
  vercel env pull .env.preview --environment=preview
  ```

## 4. Desplegar (Preview)

Desde la raíz del proyecto:

```powershell
vercel
```

- Sin flags, `vercel` crea un **despliegue de Preview** (nunca toca producción).
- Al terminar imprime la URL del despliegue, del estilo `https://clawhub-xxxxxxxxx-<equipo>.vercel.app`.

Variantes útiles:

```powershell
# Compilar en local y subir solo el resultado (útil para depurar el build)
vercel build
vercel deploy --prebuilt

# Desplegar sin preguntas interactivas
vercel --yes
```

> Nota: los `crons` de `vercel.json` (p. ej. `/api/cron/sweep-offline`) solo se ejecutan en producción, no en los Preview.

## 5. Verificar el despliegue

```powershell
# Listar los últimos despliegues del proyecto
vercel ls

# Ver detalles y estado de un despliegue concreto
vercel inspect <url-del-despliegue>

# Ver logs en tiempo real
vercel logs <url-del-despliegue>
```

## 6. (Opcional) Alias estable para la rama

Para que la rama tenga siempre una URL fija que apunte al último despliegue:

```powershell
vercel alias set <url-del-despliegue> clawhub-suite.vercel.app
```

## 7. Promover a producción (solo cuando se decida)

Un Preview se puede promover sin volver a compilar:

```powershell
vercel promote <url-del-despliegue>
```

O bien desplegar directamente a producción (¡solo desde la rama de producción!):

```powershell
vercel --prod
```

## Resumen rápido

```powershell
git checkout suite     # rama de trabajo
vercel                 # despliegue Preview
vercel logs <url>      # comprobar logs si algo falla
```
