import "dotenv/config";
import { db } from "../src/lib/db";

// Migración suites-and-zones: cada SalesRep → una Suite (hereda tarifa/IBAN),
// su territory → Zone, su usuario queda vinculado (User.suiteId) y sus prospects
// y comisiones se recablean a la Suite (backfill de suiteId, sin tocar
// salesRepId — sombra). Idempotente: la Suite se detecta por User.suiteId; los
// backfills solo tocan filas con suiteId NULL.
async function main() {
  const reps = await db.salesRep.findMany({
    include: { user: { select: { id: true, email: true, name: true, suiteId: true } } },
  });
  let created = 0;
  let reused = 0;
  for (const rep of reps) {
    // Zona desde territory
    let zoneId: string | null = null;
    if (rep.territory && rep.territory.trim()) {
      const zone = await db.zone.upsert({
        where: { name: rep.territory.trim() },
        update: {},
        create: { name: rep.territory.trim() },
      });
      zoneId = zone.id;
    }

    // Suite: reusar la del usuario si ya migró; si no, crear
    let suiteId: string;
    if (rep.user.suiteId) {
      suiteId = rep.user.suiteId;
      reused++;
      // Asegurar zona si faltaba
      if (zoneId) {
        await db.suite.update({ where: { id: suiteId }, data: { zoneId } });
      }
    } else {
      const suite = await db.suite.create({
        data: {
          name: rep.user.name?.trim() || rep.user.email.split("@")[0],
          type: "EMPRESA",
          commissionRate: rep.commissionRate,
          iban: rep.iban,
          ibanHolder: rep.ibanHolder,
          zoneId,
        },
      });
      suiteId = suite.id;
      await db.user.update({ where: { id: rep.user.id }, data: { suiteId } });
      created++;
    }

    // Backfill prospects y comisiones de este rep (solo los aún sin suite)
    const p = await db.prospect.updateMany({
      where: { salesRepId: rep.id, suiteId: null },
      data: { suiteId },
    });
    const c = await db.commission.updateMany({
      where: { salesRepId: rep.id, suiteId: null },
      data: { suiteId },
    });
    console.log(
      `${rep.user.email} → suite ${suiteId.slice(0, 8)}… (${zoneId ? "zona ✓" : "sin zona"}) · prospects +${p.count} · comisiones +${c.count}`,
    );
  }

  // Recuento de verificación
  const [suiteN, zoneN, pWithout, cWithout] = await Promise.all([
    db.suite.count(),
    db.zone.count(),
    db.prospect.count({ where: { salesRepId: { not: null }, suiteId: null } }),
    db.commission.count({ where: { suiteId: null } }),
  ]);
  console.log(
    `\nSuites: ${suiteN} (creadas ${created}, reusadas ${reused}) · Zonas: ${zoneN}`,
  );
  console.log(
    `Sin migrar tras el backfill → prospects con rep pero sin suite: ${pWithout} · comisiones sin suite: ${cWithout}`,
  );
  process.exit(0);
}
main().catch((e) => { console.error("FALLO:", e); process.exit(1); });
