/**
 * prepare-demo-pack.ts — empaqueta un ZIP self-contained para distribuir a
 * compañeros del operator sin pasar por GitHub Releases ni hosting público.
 *
 * El compañero descomprime el ZIP, ejecuta INSTALL.bat y queda con su PC
 * conectado a clawhub. Los bundles del stack están PRE-EXTRAÍDOS dentro del
 * ZIP con el `.sha256` marker correcto, así que el desktop NO descarga nada
 * de clawhub en el primer arranque (offline-first install).
 *
 * Tras instalar, el control sigue funcionando 100% online: commands,
 * baselines, heartbeats, alerts.
 *
 * Uso:
 *   npx tsx scripts/prepare-demo-pack.ts \
 *     --openclaw-src="C:/Users/Nitropc/Desktop/OPENCLAW/openclaw" \
 *     --bridge-src="C:/Users/Nitropc/Desktop/OPENCLAW/autonomous-agents" \
 *     --overlay-src="C:/Users/Nitropc/Desktop/OPENCLAW/asesoria" \
 *     --overlay-id=asesoria \
 *     --version=demo-1.0.0 \
 *     --exe="C:/Users/Nitropc/Desktop/OPENCLAW/clawgents-desktop/release/AI Office-Setup-0.1.0.exe" \
 *     --output="C:/temp/clawhub-demo-pack" \
 *     --firm-id=<firmId> \
 *     --register \
 *     [--app-product-name="AI Office"]   // afecta a userData path en Windows
 *     [--include-node-modules]           // default: NO incluir (más ligero)
 *
 * Tras correr:
 *   - <output>/ contiene: stack/, AI Office-Setup.exe, README.txt, INSTALL.bat
 *   - Tú comprimes <output> a ZIP (Explorer → Send to → Compressed folder)
 *     y pasas el .zip por WeTransfer/Drive/lo que sea.
 *   - StackBundles registrados en clawhub con URL `local://demo-pack` (no
 *     accesible HTTP, pero como los archivos están pre-extraídos con el sha
 *     correcto, el desktop NO intenta descargarlos).
 */
import "dotenv/config";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

type Args = {
  openclawSrc?: string;
  bridgeSrc?: string;
  overlaySrc?: string;
  overlayId?: string;
  version: string;
  exe?: string;
  output: string;
  firmId?: string;
  register: boolean;
  channel: string;
  appProductName: string;
  includeNodeModules: boolean;
};

function parseArgs(): Args {
  const out: Partial<Args> = {
    channel: "stable",
    register: false,
    appProductName: "AI Office",
    includeNodeModules: false,
  };
  for (const arg of process.argv.slice(2)) {
    if (arg === "--register") {
      out.register = true;
      continue;
    }
    if (arg === "--include-node-modules") {
      out.includeNodeModules = true;
      continue;
    }
    const m = arg.match(/^--([^=]+)=(.*)$/);
    if (!m) continue;
    const key = m[1].replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    (out as Record<string, unknown>)[key] = m[2];
  }
  if (!out.version || !out.output) {
    console.error(
      "Usage: tsx scripts/prepare-demo-pack.ts --version=<v> --output=<dir> " +
        "[--openclaw-src=<dir>] [--bridge-src=<dir>] [--overlay-src=<dir>] " +
        "[--overlay-id=<id>] [--exe=<path>] [--firm-id=<id>] [--register] " +
        "[--app-product-name='AI Office'] [--include-node-modules]",
    );
    process.exit(1);
  }
  if (out.overlaySrc && !out.overlayId) {
    console.error("--overlay-src requires --overlay-id");
    process.exit(1);
  }
  return out as Args;
}

function resolveTarBin(): { bin: string; forceLocal: boolean } {
  if (process.platform !== "win32") return { bin: "tar", forceLocal: false };
  const sysTar = "C:\\Windows\\System32\\tar.exe";
  if (fs.existsSync(sysTar)) return { bin: sysTar, forceLocal: false };
  return { bin: "tar.exe", forceLocal: true };
}
const TAR = resolveTarBin();

function logStep(label: string, msg: string) {
  console.log(`[${label}] ${msg}`);
}

async function sha256File(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const h = crypto.createHash("sha256");
    const s = fs.createReadStream(filePath);
    s.on("data", (c) => h.update(c as Buffer));
    s.on("end", () => resolve(h.digest("hex")));
    s.on("error", reject);
  });
}

function defaultExcludes(includeNodeModules: boolean): string[] {
  const ex = [".git", ".next", "dist", "build", "release", "out", "*.log"];
  if (!includeNodeModules) ex.push("node_modules");
  // Estado runtime que NO debe viajar al PC del compañero
  ex.push("state", "data", ".env", ".env.local", "openclaw-state");
  return ex;
}

/**
 * Empaqueta sourceDir a un tar.gz. Por defecto el tar tiene un único nivel
 * top-dir igual al basename de sourceDir → tras strip-components=1 al
 * extraer, el contenido queda directo bajo <targetDir>.
 *
 * Si se pasa `extraWrap`, se añade un nivel extra: el tar tendrá
 * `<extraWrap>/<basename>/...` como top, y tras strip-1 queda
 * `<basename>/...` en <targetDir>. Útil para BRIDGE donde el runner espera
 * <stack.bridge.path>/work-console/bridge/server.js — sourceDir es
 * .../work-console y extraWrap fuerza que el bundle tenga `wrap/work-console/`
 * → strip-1 → `work-console/...` justo lo que el runner espera.
 */
function packTarGz(
  sourceDir: string,
  outTarPath: string,
  includeNodeModules: boolean,
  extraWrap?: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const absSrc = path.resolve(sourceDir);
    const absOut = path.resolve(outTarPath);
    fs.mkdirSync(path.dirname(absOut), { recursive: true });
    const args = ["-czf", absOut];
    for (const ex of defaultExcludes(includeNodeModules)) {
      args.push("--exclude=" + ex);
    }
    if (extraWrap) {
      // tar from grandparent, target = "<grandparentBase>/<basename>" so the
      // archive has two-level top → strip-1 leaves "<basename>/...".
      const parent = path.dirname(absSrc);
      const grandparent = path.dirname(parent);
      const parentBase = path.basename(parent);
      const srcBase = path.basename(absSrc);
      args.push("-C", grandparent, `${parentBase}/${srcBase}`);
    } else {
      args.push("-C", path.dirname(absSrc), path.basename(absSrc));
    }
    if (TAR.forceLocal) args.unshift("--force-local");
    const p = spawn(TAR.bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    p.stderr.on("data", (c) => {
      stderr += c.toString();
    });
    p.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`tar create exit ${code}: ${stderr.slice(0, 400)}`));
    });
    p.on("error", reject);
  });
}

function extractTarGz(tarPath: string, destDir: string): Promise<void> {
  const absDest = path.resolve(destDir);
  const absTar = path.resolve(tarPath);
  fs.mkdirSync(absDest, { recursive: true });
  return new Promise((resolve, reject) => {
    const args = ["-xzf", absTar, "-C", absDest, "--strip-components=1"];
    if (TAR.forceLocal) args.unshift("--force-local");
    const p = spawn(TAR.bin, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    p.stderr.on("data", (c) => {
      stderr += c.toString();
    });
    p.on("close", (code) => {
      if (code === 0) resolve();
      else
        reject(new Error(`tar extract exit ${code}: ${stderr.slice(0, 400)}`));
    });
    p.on("error", reject);
  });
}

function writeSha256Marker(dir: string, sha: string) {
  fs.writeFileSync(path.join(dir, ".sha256"), sha + "\n");
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 * 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + " MB";
  return (bytes / 1024 / 1024 / 1024).toFixed(2) + " GB";
}

function dirSize(dir: string): number {
  let total = 0;
  try {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) total += dirSize(p);
      else total += fs.statSync(p).size;
    }
  } catch { /* ignore */ }
  return total;
}

type StackPiece = {
  kind: "OPENCLAW" | "BRIDGE" | "OVERLAY";
  kindKey: string; // openclaw | bridge | overlays/<id>
  source: string;
  sha256: string;
  sizeBytes: number;
  extractedTo: string;
};

async function processOne(
  args: Args,
  kind: StackPiece["kind"],
  kindKey: string,
  source: string,
): Promise<StackPiece> {
  logStep(kind, `empaquetando ${source}`);
  const stackRoot = path.join(args.output, "stack");
  const tarPath = path.join(
    stackRoot,
    "_pack",
    kindKey.replace(/\//g, "__") + "-" + args.version + ".tar.gz",
  );

  // BRIDGE necesita un nivel wrap extra: el runner busca
  // <stack.bridge.path>/work-console/... así que el tar.gz debe contener
  // work-console/ como subdir (tras strip-1). Para OPENCLAW y OVERLAY el
  // contenido va directo bajo <targetDir>.
  await packTarGz(source, tarPath, args.includeNodeModules, kind === "BRIDGE" ? "wrap" : undefined);
  const sha = await sha256File(tarPath);
  const sizeBytes = fs.statSync(tarPath).size;
  logStep(kind, `tar.gz ${formatSize(sizeBytes)} · sha256 ${sha.slice(0, 12)}…`);

  // Pre-extract a la ruta donde stack-bootstrap espera encontrarlo
  const extractedTo = path.join(stackRoot, kindKey, args.version);
  if (fs.existsSync(extractedTo)) {
    fs.rmSync(extractedTo, { recursive: true, force: true });
  }
  await extractTarGz(tarPath, extractedTo);
  writeSha256Marker(extractedTo, sha);
  logStep(kind, `extraído a ${path.relative(args.output, extractedTo)}`);

  // Borramos el tar.gz — solo nos interesa la carpeta extraída + sha
  try {
    fs.unlinkSync(tarPath);
  } catch { /* ignore */ }

  return { kind, kindKey, source, sha256: sha, sizeBytes, extractedTo };
}

function writeReadme(args: Args, pieces: StackPiece[]) {
  const exeName = args.exe ? path.basename(args.exe) : "(no incluido)";
  const lines = [
    `clawhub demo pack — paquete de instalación`,
    `============================================`,
    ``,
    `Generado: ${new Date().toLocaleString("es-ES")}`,
    `Versión:  ${args.version}`,
    ``,
    `Contenido del ZIP:`,
    `  - ${exeName}      ← instalador de Windows`,
    `  - stack/                         ← runtime ya descomprimido`,
    `  - INSTALL.bat                    ← script de instalación automática`,
    `  - README.txt                     ← este archivo`,
    ``,
    `Pasos para instalar`,
    `--------------------`,
    ``,
    `  1. Descomprime el ZIP donde quieras (Escritorio, Descargas).`,
    `  2. Haz doble clic en INSTALL.bat. Aceptarás un aviso de SmartScreen`,
    `     (es normal, el .exe aún no está firmado: "Más información" → `,
    `     "Ejecutar de todas formas"). El script:`,
    `       a. Comprueba si tienes Node.js 22 instalado y, si no, lo`,
    `          instala vía winget (Node oficial de Microsoft Store).`,
    `       b. Copia el runtime (stack/) a tu carpeta de usuario.`,
    `       c. Lanza el instalador del AI Office desktop.`,
    `  3. El instalador abre un wizard que te pide un código de`,
    `     emparejamiento (8 caracteres). Pídeselo a quien te pasó este`,
    `     ZIP — es válido durante 10 minutos.`,
    `  4. Tras el emparejamiento, el AI Office arrancará y ya podrás`,
    `     usar tus copilotos. La primera vez tarda 2-4 minutos en`,
    `     terminar de configurar los plugins internos.`,
    ``,
    `Si algo va mal`,
    `--------------`,
    ``,
    `  - Logs: %APPDATA%\\AI Office\\logs\\`,
    `  - Para desinstalar: Panel de control → Programas → AI Office.`,
    `  - Soporte: pásale el log "gateway.log" o "bridge.log" a quien te`,
    `    pasó este ZIP.`,
    ``,
    `Componentes incluidos`,
    `---------------------`,
    ``,
  ];
  for (const p of pieces) {
    lines.push(
      `  ${p.kind.padEnd(10)} ${p.kindKey.padEnd(22)} sha256: ${p.sha256.slice(0, 16)}…`,
    );
  }
  lines.push("");
  fs.writeFileSync(path.join(args.output, "README.txt"), lines.join("\n"));
  logStep("DOC", `README.txt escrito`);
}

function writeInstallBat(args: Args) {
  // El stack se copia a %APPDATA%\<productName>\stack\
  // que es donde Electron pone userData en Windows.
  const productName = args.appProductName;
  const exeName = args.exe ? path.basename(args.exe) : "AI Office-Setup.exe";

  const bat = [
    `@echo off`,
    `setlocal`,
    ``,
    `echo ============================================`,
    `echo  Instalando AI Office (clawhub demo)`,
    `echo ============================================`,
    `echo.`,
    ``,
    `:: 1. Verificar Node.js`,
    `where node >nul 2>&1`,
    `if %ERRORLEVEL% neq 0 (`,
    `  echo Node.js no esta instalado. Instalando via winget...`,
    `  winget install -e --id OpenJS.NodeJS.LTS --accept-package-agreements --accept-source-agreements`,
    `  if %ERRORLEVEL% neq 0 (`,
    `    echo.`,
    `    echo ERROR: no se pudo instalar Node.js automaticamente.`,
    `    echo Descarga manualmente desde https://nodejs.org y reinicia este script.`,
    `    pause`,
    `    exit /b 1`,
    `  )`,
    `) else (`,
    `  for /f "tokens=*" %%v in ('node --version') do set NODE_VER=%%v`,
    `  echo Node detectado: !NODE_VER!`,
    `)`,
    `echo.`,
    ``,
    `:: 2. Copiar stack al userData de Electron`,
    `set "STACK_SRC=%~dp0stack"`,
    `set "STACK_DST=%APPDATA%\\${productName}\\stack"`,
    `echo Copiando runtime a "%STACK_DST%"...`,
    `if not exist "%STACK_DST%" mkdir "%STACK_DST%"`,
    `robocopy "%STACK_SRC%" "%STACK_DST%" /E /R:3 /W:5 /NFL /NDL /NJH /NJS /NC /NS /NP`,
    `if %ERRORLEVEL% gtr 7 (`,
    `  echo ERROR: robocopy fallo con exit code %ERRORLEVEL%.`,
    `  echo Cierra el AI Office si esta abierto y reintenta.`,
    `  pause`,
    `  exit /b 1`,
    `)`,
    `echo Runtime copiado.`,
    `echo.`,
    ``,
    `:: 3. Lanzar el instalador`,
    `echo Lanzando el instalador del AI Office...`,
    `start "" "%~dp0${exeName}"`,
    `echo.`,
    `echo Sigue el wizard. Cuando termine, abriras el AI Office y te`,
    `echo pedira un codigo de emparejamiento de 8 caracteres.`,
    `echo.`,
    `pause`,
    `endlocal`,
  ].join("\r\n");

  fs.writeFileSync(path.join(args.output, "INSTALL.bat"), bat);
  logStep("DOC", `INSTALL.bat escrito (userData target: %APPDATA%\\${productName}\\stack)`);
}

async function registerInClawhub(
  args: Args,
  pieces: StackPiece[],
): Promise<void> {
  const db = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
    }),
  });

  try {
    for (const p of pieces) {
      const overlayId = p.kind === "OVERLAY" ? args.overlayId! : null;
      // Si ya existe esta tupla (kind, overlayId, version, channel), actualizamos
      // sha + url + size; si no, creamos.
      const existing = await db.stackBundle.findFirst({
        where: {
          kind: p.kind,
          overlayId,
          version: args.version,
          channel: args.channel,
        },
      });
      const url = `local://demo-pack/${p.kindKey}/${args.version}`;
      const data = {
        kind: p.kind,
        overlayId,
        version: args.version,
        channel: args.channel,
        sha256: p.sha256,
        downloadUrl: url,
        sizeBytes: p.sizeBytes,
        releaseNotes: "demo-pack ZIP (offline pre-extracted)",
        publishedBy: "prepare-demo-pack",
      };
      if (existing) {
        await db.stackBundle.update({ where: { id: existing.id }, data });
        logStep("DB", `actualizado ${p.kind}${overlayId ? `(${overlayId})` : ""} v${args.version}`);
      } else {
        await db.stackBundle.create({ data });
        logStep("DB", `creado ${p.kind}${overlayId ? `(${overlayId})` : ""} v${args.version}`);
      }
    }

    if (args.firmId) {
      const updates: Record<string, string | null> = {};
      for (const p of pieces) {
        if (p.kind === "OPENCLAW") updates.openclawVersion = args.version;
        if (p.kind === "BRIDGE") updates.bridgeVersion = args.version;
        if (p.kind === "OVERLAY") {
          updates.overlayId = args.overlayId!;
          updates.overlayVersion = args.version;
        }
      }
      updates.stackChannel = args.channel;
      const f = await db.firm.update({
        where: { id: args.firmId },
        data: updates,
        select: { name: true },
      });
      logStep("DB", `firma "${f.name}" pineada al demo-pack`);
    }
  } finally {
    await db.$disconnect();
  }
}

async function main() {
  const args = parseArgs();
  logStep("INIT", `output dir: ${args.output}`);
  fs.mkdirSync(args.output, { recursive: true });
  fs.mkdirSync(path.join(args.output, "stack"), { recursive: true });

  const pieces: StackPiece[] = [];
  if (args.openclawSrc) {
    pieces.push(await processOne(args, "OPENCLAW", "openclaw", args.openclawSrc));
  }
  if (args.bridgeSrc) {
    pieces.push(await processOne(args, "BRIDGE", "bridge", args.bridgeSrc));
  }
  if (args.overlaySrc) {
    pieces.push(
      await processOne(
        args,
        "OVERLAY",
        `overlays/${args.overlayId}`,
        args.overlaySrc,
      ),
    );
  }
  // Limpia carpeta temporal _pack si queda algo
  try {
    fs.rmSync(path.join(args.output, "stack", "_pack"), { recursive: true, force: true });
  } catch { /* ignore */ }

  if (args.exe) {
    if (!fs.existsSync(args.exe)) {
      throw new Error(`--exe no encontrado: ${args.exe}`);
    }
    const exeName = path.basename(args.exe);
    const exeDest = path.join(args.output, exeName);
    fs.copyFileSync(args.exe, exeDest);
    const sz = fs.statSync(exeDest).size;
    logStep("EXE", `${exeName} copiado (${formatSize(sz)})`);
  } else {
    console.warn("[EXE] no se pasó --exe; el ZIP no tendrá installer");
  }

  writeReadme(args, pieces);
  writeInstallBat(args);

  if (args.register) {
    await registerInClawhub(args, pieces);
  } else {
    console.log("[DB] --register no pasado; bundles NO registrados en clawhub");
    console.log("[DB] sin esto, /api/v0/stack-manifest devolverá null y el");
    console.log("[DB] desktop arrancará con showStackErrorWindow. Para activar:");
    console.log("[DB]   añade --register --firm-id=<id>");
  }

  // Resumen final
  const total = dirSize(args.output);
  console.log("");
  console.log("=== Demo pack listo ===");
  console.log(`  carpeta: ${args.output}`);
  console.log(`  tamaño:  ${formatSize(total)}`);
  console.log("");
  console.log("Siguiente paso:");
  console.log(`  1. Comprime ${args.output} a un .zip (Explorer → Send to → Compressed folder)`);
  console.log(`  2. Pásale el .zip al compañero (WeTransfer, Drive, USB…)`);
  console.log(`  3. Genera un pairing code en /firm para él y dáselo en otro canal`);
}

main().catch((err) => {
  console.error("[FATAL]", err.message);
  process.exit(1);
});
