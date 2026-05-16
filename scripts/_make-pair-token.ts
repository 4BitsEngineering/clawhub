import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const db = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
    }),
  });
  const code = process.argv[2] ?? "LIVE-TEST";
  const t = await db.pairingToken.create({
    data: {
      firmId: "00000000-0000-0000-0000-000000000001",
      code,
      expiresAt: new Date(Date.now() + 30 * 60_000),
    },
  });
  console.log(t.code);
  await db.$disconnect();
}
main();
