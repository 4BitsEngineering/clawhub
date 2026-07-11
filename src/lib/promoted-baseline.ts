import { db } from "@/lib/db";

// Una firma sin baseline promovido NO es instalable: /api/v0/pair devuelve
// promoted_baseline_id=null y el instalador aborta al provisionar ("La firma
// no tiene un paquete (baseline) promovido"). Solo el configurator
// (/api/v0/register) o la promoción manual en /firm/baselines dejan uno.
// Las UIs que emiten pairing codes consultan esto para bloquear (first-pair)
// o avisar (re-pair) ANTES de repartir un código condenado a fallar.
export async function firmHasPromotedBaseline(firmId: string): Promise<boolean> {
  const promoted = await db.firmBaseline.findFirst({
    where: { firmId, isPromoted: true },
    select: { id: true },
  });
  return promoted !== null;
}
