// Firma de URLs de descarga de bundles (Supabase Storage).
//
// `StackBundle.downloadUrl` puede ser:
//   - una URL http(s) → se devuelve tal cual (p.ej. el .exe en un Release).
//   - un path de Supabase Storage `<bucket>/<objeto>` → se genera una **signed
//     URL caducable** para que el cliente la descargue SIN credenciales y sin
//     exponer el bucket (ni el código del overlay). Gateado aguas arriba por el
//     instance_token de stack-manifest.
//
// Requiere en el entorno de clawhub: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
// (mismo proyecto que el Postgres). Si faltan, se devuelve el path sin firmar
// (degradación: el cliente fallará la descarga, pero no rompe el manifest).

const SIGNED_URL_TTL_S = 3600; // 1h: suficiente para descargar; corto para no filtrar.

export async function resolveDownloadUrl(downloadUrl: string): Promise<string> {
  if (/^https?:\/\//i.test(downloadUrl)) return downloadUrl;

  const base = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !key) return downloadUrl;

  const slash = downloadUrl.indexOf("/");
  if (slash <= 0) return downloadUrl;
  const bucket = downloadUrl.slice(0, slash);
  const objectPath = downloadUrl.slice(slash + 1);

  // Anti path-traversal / SSRF al API de storage (firmamos con la service_role
  // key): el bucket debe ser un id válido y cada segmento del objeto no puede
  // ser vacío/`.`/`..` ni traer `\` o secuencias %-encoded de traversal. Si algo
  // no cuadra, devolvemos el path SIN firmar (el cliente fallará la descarga,
  // pero no construimos una URL hacia un objeto/bucket arbitrario).
  if (!/^[a-z0-9][a-z0-9._-]{0,62}$/i.test(bucket)) return downloadUrl;
  if (/%2e|%2f|\\/i.test(objectPath)) return downloadUrl;
  const segments = objectPath.split("/");
  if (segments.some((s) => s === "" || s === "." || s === "..")) return downloadUrl;
  const safePath = segments.map(encodeURIComponent).join("/");

  try {
    const res = await fetch(
      `${base}/storage/v1/object/sign/${bucket}/${safePath}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          apikey: key,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ expiresIn: SIGNED_URL_TTL_S }),
      },
    );
    if (!res.ok) return downloadUrl;
    const j = (await res.json()) as { signedURL?: string };
    return j.signedURL ? `${base}/storage/v1${j.signedURL}` : downloadUrl;
  } catch {
    return downloadUrl;
  }
}
