/**
 * clawhub — Seed inicial
 *
 * Crea:
 *   - 1 operator user (tu email, viene de git config: jotajota1302@hotmail.com)
 *   - 1 firma demo "Asesoría Demo" con plan STARTER + 5 seats
 *   - 1 firm_admin user para esa firma
 *
 * Idempotente: re-correrlo no duplica.
 */

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DIRECT_URL / DATABASE_URL no está definido en .env");
}

const adapter = new PrismaPg({ connectionString });
const db = new PrismaClient({ adapter });

const OPERATOR_EMAIL = "jotajota1302@hotmail.com";
const FIRM_NAME = "Asesoría Demo";
const FIRM_ADMIN_EMAIL = "admin@asesoria-demo.local";

async function main() {
  // 1. Operator
  const operator = await db.user.upsert({
    where: { email: OPERATOR_EMAIL },
    update: { role: "OPERATOR" },
    create: {
      email: OPERATOR_EMAIL,
      name: "Operator",
      role: "OPERATOR",
      emailVerified: new Date(),
    },
  });
  console.log(`✔ Operator: ${operator.email} (id ${operator.id})`);

  // 2. Demo firm
  const firm = await db.firm.upsert({
    where: { id: "00000000-0000-0000-0000-000000000001" },
    update: { name: FIRM_NAME },
    create: {
      id: "00000000-0000-0000-0000-000000000001",
      name: FIRM_NAME,
      plan: "STARTER",
      seatsPurchased: 5,
    },
  });
  console.log(`✔ Firm: ${firm.name} (id ${firm.id})`);

  // 3. Firm admin
  const firmAdmin = await db.user.upsert({
    where: { email: FIRM_ADMIN_EMAIL },
    update: { role: "FIRM_ADMIN", firmId: firm.id },
    create: {
      email: FIRM_ADMIN_EMAIL,
      name: "Admin Demo",
      role: "FIRM_ADMIN",
      firmId: firm.id,
      emailVerified: new Date(),
    },
  });
  console.log(`✔ Firm admin: ${firmAdmin.email} (id ${firmAdmin.id})`);

  console.log("\nSeed completo.");
  console.log(`\nPara entrar como operator: ${OPERATOR_EMAIL}`);
  console.log(`Para entrar como firm_admin: ${FIRM_ADMIN_EMAIL}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
