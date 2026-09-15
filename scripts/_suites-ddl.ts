import "dotenv/config";
import { db } from "../src/lib/db";

// DDL aditivo de suites-and-zones aplicado a mano (NO db push: dejaría caer la
// tabla ConfigTemplate que gestiona otra sesión fuera de Prisma). Idempotente:
// cada statement tolera "ya existe".
const statements: string[] = [
  `CREATE TYPE clawhub."SuiteType" AS ENUM ('ASESORIA','ASOCIACION','EMPRESA','OTRO')`,
  `CREATE TABLE IF NOT EXISTS clawhub."Zone" (
     "id" text NOT NULL,
     "name" text NOT NULL,
     "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Zone_name_key" ON clawhub."Zone"("name")`,
  `CREATE TABLE IF NOT EXISTS clawhub."Suite" (
     "id" text NOT NULL,
     "zoneId" text,
     "name" text NOT NULL,
     "type" clawhub."SuiteType" NOT NULL DEFAULT 'EMPRESA',
     "phone" text,
     "commissionRate" double precision NOT NULL DEFAULT 0.35,
     "iban" text,
     "ibanHolder" text,
     "billingTaxId" text,
     "billingAddress" text,
     "billingPostalCode" text,
     "billingCity" text,
     "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     "updatedAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
     CONSTRAINT "Suite_pkey" PRIMARY KEY ("id")
   )`,
  `CREATE INDEX IF NOT EXISTS "Suite_zoneId_idx" ON clawhub."Suite"("zoneId")`,
  `ALTER TABLE clawhub."Suite" ADD CONSTRAINT "Suite_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES clawhub."Zone"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
  `ALTER TABLE clawhub."User" ADD COLUMN IF NOT EXISTS "suiteId" text`,
  `CREATE INDEX IF NOT EXISTS "User_suiteId_idx" ON clawhub."User"("suiteId")`,
  `ALTER TABLE clawhub."User" ADD CONSTRAINT "User_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES clawhub."Suite"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
  `ALTER TABLE clawhub."Firm" ADD COLUMN IF NOT EXISTS "suiteId" text`,
  `ALTER TABLE clawhub."Firm" ADD CONSTRAINT "Firm_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES clawhub."Suite"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
  `ALTER TABLE clawhub."Prospect" ADD COLUMN IF NOT EXISTS "suiteId" text`,
  `CREATE INDEX IF NOT EXISTS "Prospect_suiteId_idx" ON clawhub."Prospect"("suiteId")`,
  `ALTER TABLE clawhub."Prospect" ADD CONSTRAINT "Prospect_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES clawhub."Suite"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
  `ALTER TABLE clawhub."Commission" ADD COLUMN IF NOT EXISTS "suiteId" text`,
  `CREATE INDEX IF NOT EXISTS "Commission_suiteId_status_idx" ON clawhub."Commission"("suiteId","status")`,
  `ALTER TABLE clawhub."Commission" ADD CONSTRAINT "Commission_suiteId_fkey" FOREIGN KEY ("suiteId") REFERENCES clawhub."Suite"("id") ON DELETE SET NULL ON UPDATE CASCADE`,
  // Grants para el webhook (service_role) — coherente con el resto del schema.
  `GRANT ALL ON clawhub."Zone" TO service_role`,
  `GRANT ALL ON clawhub."Suite" TO service_role`,
];

async function main() {
  for (const sql of statements) {
    try {
      await db.$executeRawUnsafe(sql);
      console.log("OK:", sql.split("\n")[0].slice(0, 70));
    } catch (err) {
      const msg = (err as Error).message;
      if (/already exists|ya existe|duplicate/i.test(msg)) {
        console.log("skip (existe):", sql.split("\n")[0].slice(0, 60));
      } else {
        console.error("FALLO:", sql.split("\n")[0], "\n ", msg.slice(0, 200));
        process.exit(1);
      }
    }
  }
  console.log("DDL aplicado.");
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
