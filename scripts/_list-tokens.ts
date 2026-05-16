import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const db = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
    }),
  });
  const tokens = await db.pairingToken.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  const now = new Date();
  for (const t of tokens) {
    const expired = t.expiresAt < now;
    const used = !!t.usedAt;
    const minsLeft = Math.round((t.expiresAt.getTime() - now.getTime()) / 60000);
    console.log({
      code: t.code,
      createdAt: t.createdAt.toISOString(),
      expiresAt: t.expiresAt.toISOString(),
      expired,
      used,
      minsLeft,
    });
  }
  await db.$disconnect();
}
main();
