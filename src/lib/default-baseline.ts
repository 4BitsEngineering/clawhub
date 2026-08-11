// Fuente única del paquete de configuración (baseline) POR DEFECTO de una firma.
//
// Cuando una firma no tiene ningún FirmBaseline promovido (p. ej. creada por
// una compra, sin pasar por el configurator), /api/v0/pair provisiona este
// baseline para que el instalador tenga qué provisionar y el AI-Office arranque
// operativo. El cliente solo introduce el código de pairing; el proveedor de IA
// y su clave los resuelve el instalador/bridge en la máquina (placeholders
// intactos: ${MINIMAX_API_KEY}, __GATEWAY_TOKEN__, __STACK_ROOT__…).
//
// De momento se usa la plantilla MiniMax/Ollama (la misma que el configurator).
// Migrar el proveedor por defecto a OpenRouter es una iteración futura: bastaría
// cambiar el JSON importado (o su bloque `models`/`agents.defaults.model`).

import crypto from "node:crypto";
import defaultOpenclaw from "@/lib/default-openclaw.json";
import type { FirmBaselineFileCategory } from "@/generated/prisma/client";

export const DEFAULT_BASELINE_LABEL = "Config AI-Office por defecto";
export const DEFAULT_BASELINE_DESCRIPTION =
  "Paquete de configuración estándar generado automáticamente al instalar sin configurator.";

export type BaselineFile = {
  path: string;
  category: FirmBaselineFileCategory;
  content: string;
  sha256: string;
  sizeBytes: number;
  isBinary: boolean;
};

function textFile(
  path: string,
  category: FirmBaselineFileCategory,
  content: string,
): BaselineFile {
  const sizeBytes = Buffer.byteLength(content, "utf8");
  const sha256 = crypto.createHash("sha256").update(content).digest("hex");
  return { path, category, content, sha256, sizeBytes, isBinary: false };
}

// Archivos del baseline por defecto. Mínimo operativo: openclaw.json. Se pueden
// añadir workspaces/skills/agentes por defecto de forma incremental aquí.
export function defaultBaselineFiles(): BaselineFile[] {
  // Serializar con formato estable (2 espacios) — el contenido es el que baja
  // el instalador vía /api/v0/baselines/[id].
  const openclawJson = JSON.stringify(defaultOpenclaw, null, 2);
  return [textFile("openclaw.json", "OPENCLAW_CONFIG", openclawJson)];
}
