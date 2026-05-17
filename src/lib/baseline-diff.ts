/**
 * baseline-diff.ts — comparación entre dos baselines de la misma firma.
 *
 * Útil para mostrar al user qué cambiará si aplica el target sobre el estado
 * representado por el "current". El "current" puede venir de:
 *   - El último snapshot_to_baseline de la instancia (más fiel pero requiere
 *     snapshot reciente).
 *   - El baseline previamente aplicado (worst-case fallback).
 *
 * Ojo: comparamos a nivel de path + sha256. Si el contenido cambia pero el
 * sha es el mismo, se considera "unchanged" (no debería ocurrir si sha256
 * está bien calculado en ambos lados).
 *
 * MEMORY.md preservados: el agent NO sobreescribe MEMORY.md durante reset
 * (preservación intencionada del aprendizaje). Por tanto los marcamos como
 * "preserved" en el diff aunque aparezcan distintos entre baselines.
 */
import type {
  FirmBaselineFile,
  FirmBaselineFileCategory,
} from "@/generated/prisma/client";

export type BaselineFileSummary = Pick<
  FirmBaselineFile,
  "path" | "sha256" | "sizeBytes" | "category"
>;

export type DiffEntry = {
  path: string;
  category: FirmBaselineFileCategory;
  status: "added" | "removed" | "modified" | "unchanged" | "preserved";
  sizeBytes?: number;
  oldSha?: string;
  newSha?: string;
};

export type BaselineDiff = {
  entries: DiffEntry[];
  counts: {
    added: number;
    removed: number;
    modified: number;
    unchanged: number;
    preserved: number;
  };
};

/**
 * Path matchers para archivos que el agent NO sobreescribe en reset
 * (alineado con isInstanceMemoryFile en bridge baseline.js). Mantener
 * sincronizado con el bridge — si esto diverge, mostraremos diffs
 * irrelevantes.
 */
function isPreservedPath(p: string): boolean {
  // agents/workspaces/<agent>/MEMORY.md
  if (/^agents\/workspaces\/[^/]+\/MEMORY\.md$/i.test(p)) return true;
  // agents/workspaces/<agent>/memory/**
  if (/^agents\/workspaces\/[^/]+\/memory\//i.test(p)) return true;
  return false;
}

export function diffBaselines(
  current: BaselineFileSummary[],
  target: BaselineFileSummary[],
): BaselineDiff {
  const currentByPath = new Map<string, BaselineFileSummary>();
  for (const f of current) currentByPath.set(f.path, f);
  const targetByPath = new Map<string, BaselineFileSummary>();
  for (const f of target) targetByPath.set(f.path, f);

  const entries: DiffEntry[] = [];
  const seen = new Set<string>();

  // Iter target → added | modified | unchanged | preserved
  for (const t of target) {
    seen.add(t.path);
    const c = currentByPath.get(t.path);
    if (isPreservedPath(t.path)) {
      entries.push({
        path: t.path,
        category: t.category,
        status: "preserved",
        sizeBytes: t.sizeBytes,
      });
      continue;
    }
    if (!c) {
      entries.push({
        path: t.path,
        category: t.category,
        status: "added",
        sizeBytes: t.sizeBytes,
        newSha: t.sha256,
      });
    } else if (c.sha256 === t.sha256) {
      entries.push({
        path: t.path,
        category: t.category,
        status: "unchanged",
        sizeBytes: t.sizeBytes,
      });
    } else {
      entries.push({
        path: t.path,
        category: t.category,
        status: "modified",
        sizeBytes: t.sizeBytes,
        oldSha: c.sha256,
        newSha: t.sha256,
      });
    }
  }

  // Iter current → removed (no en target)
  for (const c of current) {
    if (seen.has(c.path)) continue;
    if (isPreservedPath(c.path)) {
      // No aparece en target pero el agent lo preservaría igualmente.
      entries.push({
        path: c.path,
        category: c.category,
        status: "preserved",
        sizeBytes: c.sizeBytes,
      });
      continue;
    }
    entries.push({
      path: c.path,
      category: c.category,
      status: "removed",
      sizeBytes: c.sizeBytes,
      oldSha: c.sha256,
    });
  }

  // Orden: added → modified → removed → preserved → unchanged
  const orderRank: Record<DiffEntry["status"], number> = {
    added: 0,
    modified: 1,
    removed: 2,
    preserved: 3,
    unchanged: 4,
  };
  entries.sort((a, b) => {
    const oa = orderRank[a.status] - orderRank[b.status];
    if (oa !== 0) return oa;
    return a.path.localeCompare(b.path);
  });

  const counts = {
    added: entries.filter((e) => e.status === "added").length,
    removed: entries.filter((e) => e.status === "removed").length,
    modified: entries.filter((e) => e.status === "modified").length,
    unchanged: entries.filter((e) => e.status === "unchanged").length,
    preserved: entries.filter((e) => e.status === "preserved").length,
  };
  return { entries, counts };
}
