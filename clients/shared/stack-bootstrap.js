// Stack bootstrap — descarga + extrae + verifica los bundles del stack
// definidos en el manifest de clawhub. Zero-deps (usa solo node built-ins +
// `tar` del sistema operativo, presente nativo en Windows 10+ y Unix).
//
// Pensado para cliente desktop (Electron) y headless por igual. El caller
// proporciona `baseDir` (e.g. <userData>/stack o ~/.clawhub-client/stack) y
// el módulo crea la jerarquía bajo ese path.
//
// Layout en disco:
//   <baseDir>/openclaw/<version>/         ← contenido del tar.gz extraído
//   <baseDir>/openclaw/<version>/.sha256  ← marker con el sha256 esperado
//   <baseDir>/bridge/<version>/
//   <baseDir>/overlays/<overlayId>/<version>/
//   <baseDir>/_cache/<filename>.tar.gz    ← descarga temporal (se borra OK)

'use strict';

const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const { fetchJson } = require('./http');

// En Windows queremos bsdtar nativo (C:\Windows\System32\tar.exe), NO el GNU
// tar que viene con Git Bash — GNU tar interpreta `C:\foo` como host:path SSH
// y falla con "Cannot connect to C: resolve failed". Si System32\tar.exe
// existe, se usa; si no (Windows muy viejo), fallback con --force-local.
function resolveTarBin() {
  if (process.platform !== 'win32') return { bin: 'tar', forceLocal: false };
  const sysTar = 'C:\\Windows\\System32\\tar.exe';
  if (fs.existsSync(sysTar)) return { bin: sysTar, forceLocal: false };
  return { bin: 'tar.exe', forceLocal: true };
}
const TAR = resolveTarBin();

function bundleTargetDir(baseDir, kindKey, version) {
  // kindKey puede ser 'openclaw', 'bridge', o 'overlays/<overlayId>'.
  return path.join(baseDir, kindKey, version);
}

function cacheDir(baseDir) {
  return path.join(baseDir, '_cache');
}

function readSha256Marker(targetDir) {
  try {
    return fs.readFileSync(path.join(targetDir, '.sha256'), 'utf8').trim();
  } catch {
    return null;
  }
}

function writeSha256Marker(targetDir, sha256) {
  fs.writeFileSync(path.join(targetDir, '.sha256'), sha256 + '\n');
}

async function sha256OfFile(filePath) {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filePath);
  for await (const chunk of stream) hash.update(chunk);
  return hash.digest('hex');
}

async function downloadToFile(url, destPath, logger) {
  const t0 = Date.now();
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`download_failed ${res.status}: ${url}`);
  }
  if (!res.body) throw new Error('download_no_body');
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  const tmpPath = destPath + '.partial';
  // res.body es un ReadableStream Web — convertir a node Readable para pipeline.
  const nodeStream = Readable.fromWeb(res.body);
  await pipeline(nodeStream, fs.createWriteStream(tmpPath));
  fs.renameSync(tmpPath, destPath);
  const sizeBytes = fs.statSync(destPath).size;
  const ms = Date.now() - t0;
  logger?.info?.(`[stack-bootstrap] downloaded ${url} → ${destPath} (${(sizeBytes / 1024 / 1024).toFixed(2)} MB, ${ms}ms)`);
}

function extractTarGz(tarPath, destDir) {
  // Tar (bsdtar en Windows 10+) acepta backslashes en -C pero falla si el
  // path es relativo o le falta drive letter. Resolvemos a absoluto. Si el
  // destDir no existe, lo creamos antes — bsdtar no auto-crea -C.
  const absDest = path.resolve(destDir);
  const absTar = path.resolve(tarPath);
  fs.mkdirSync(absDest, { recursive: true });
  return new Promise((resolve, reject) => {
    // --strip-components=1 deshace el directorio top-level del bundle
    // (generado con `tar -czf x.tgz -C parent dir/`).
    const args = ['-xzf', absTar, '-C', absDest, '--strip-components=1'];
    if (TAR.forceLocal) args.unshift('--force-local');
    const p = spawn(TAR.bin, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    p.stderr.on('data', (c) => { stderr += c.toString(); });
    p.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`tar extract exit ${code}: ${stderr.slice(0, 500)}`));
    });
    p.on('error', reject);
  });
}

function rmDirSafe(dirPath) {
  try {
    fs.rmSync(dirPath, { recursive: true, force: true });
  } catch { /* best effort */ }
}

/**
 * ensureBundle — garantiza que el bundle dado está descargado y extraído en
 * baseDir. Si el sha256 local coincide → no-op (ya está). Si no, descarga +
 * verifica + extrae + actualiza marker.
 *
 * Devuelve `{ path, version, fromCache, downloaded }`.
 */
async function ensureBundle(baseDir, kindKey, bundle, logger) {
  if (!bundle || !bundle.downloadUrl || !bundle.sha256 || !bundle.version) {
    return { path: null, version: null, fromCache: false, downloaded: false, skipped: 'no_bundle' };
  }
  const targetDir = bundleTargetDir(baseDir, kindKey, bundle.version);
  const localSha = readSha256Marker(targetDir);
  if (localSha === bundle.sha256) {
    return { path: targetDir, version: bundle.version, fromCache: true, downloaded: false };
  }

  // Descarga al cache. Nombre con kind+version para no colisionar.
  const cacheName = kindKey.replace(/\//g, '__') + '-' + bundle.version + '.tar.gz';
  const tarPath = path.join(cacheDir(baseDir), cacheName);

  logger?.info?.(`[stack-bootstrap] ensureBundle ${kindKey} ${bundle.version} (new)`);
  await downloadToFile(bundle.downloadUrl, tarPath, logger);

  const actualSha = await sha256OfFile(tarPath);
  if (actualSha !== bundle.sha256) {
    try { fs.unlinkSync(tarPath); } catch { /* ignore */ }
    throw new Error(`sha256_mismatch ${kindKey} ${bundle.version}: expected ${bundle.sha256}, got ${actualSha}`);
  }

  // Limpia target si había restos parciales + extrae.
  rmDirSafe(targetDir);
  await extractTarGz(tarPath, targetDir);
  writeSha256Marker(targetDir, bundle.sha256);

  // Limpia cache — el tar ya no hace falta.
  try { fs.unlinkSync(tarPath); } catch { /* ignore */ }

  return { path: targetDir, version: bundle.version, fromCache: false, downloaded: true };
}

/**
 * fetchManifest — pide /api/v0/stack-manifest a clawhub con el instance_token.
 */
async function fetchManifest(env) {
  const r = await fetchJson(
    `${env.clawhubUrl}/api/v0/stack-manifest`,
    {
      method: 'GET',
      headers: { authorization: `Bearer ${env.instanceToken}` },
    },
    20_000,
  );
  if (!r.ok) {
    throw new Error(`manifest_${r.status}: ${(r.raw || '').slice(0, 200)}`);
  }
  return r.body;
}

/**
 * ensureStack — flujo completo: fetch manifest → asegurar cada bundle.
 *
 * @param {object} env  - { clawhubUrl, instanceToken }
 * @param {string} baseDir - path local donde extraer el stack
 * @param {object} [logger] - opcional { info, error }
 *
 * Devuelve:
 *   {
 *     manifest: <raw response>,
 *     openclaw: { path, version, fromCache, downloaded } | null,
 *     bridge:   { path, version, fromCache, downloaded } | null,
 *     overlay:  { path, version, fromCache, downloaded, overlayId } | null,
 *     errors:   [{ kind, error }] - bundles que fallaron
 *   }
 *
 * NO throwea por bundles individuales — los errores se acumulan en `errors`
 * para que el caller pueda decidir si arrancar el stack parcialmente.
 */
async function ensureStack(env, baseDir, logger) {
  const manifest = await fetchManifest(env);
  fs.mkdirSync(baseDir, { recursive: true });
  fs.mkdirSync(cacheDir(baseDir), { recursive: true });

  const m = manifest.manifest || {};
  const errors = [];

  async function tryEnsure(kindKey, bundle) {
    if (!bundle) return null;
    try {
      return await ensureBundle(baseDir, kindKey, bundle, logger);
    } catch (err) {
      logger?.error?.(`[stack-bootstrap] ${kindKey}: ${err.message}`);
      errors.push({ kind: kindKey, error: err.message });
      return null;
    }
  }

  const [openclaw, bridge, overlay] = await Promise.all([
    tryEnsure('openclaw', m.openclaw),
    tryEnsure('bridge', m.bridge),
    m.overlay ? tryEnsure(`overlays/${m.overlay.overlayId}`, m.overlay) : Promise.resolve(null),
  ]);

  return {
    manifest,
    openclaw,
    bridge,
    overlay: overlay && m.overlay ? { ...overlay, overlayId: m.overlay.overlayId } : null,
    errors,
  };
}

module.exports = { ensureStack, ensureBundle, fetchManifest, bundleTargetDir };
