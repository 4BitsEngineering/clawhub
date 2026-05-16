import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const db = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
    }),
  });
  const f = await db.firm.create({
    data: {
      name: process.argv[2] ?? "Asesoría García SL",
      plan: (process.argv[3] as "STARTER" | "PRO" | "BUSINESS" | "ENTERPRISE") ?? "PRO",
      seatsPurchased: Number(process.argv[4] ?? 15),
    },
  });
  console.log(`Created firm: ${f.name} (${f.plan}, ${f.seatsPurchased} seats) id=${f.id}`);
  const all = await db.firm.findMany({ orderBy: { createdAt: "desc" } });
  console.log(`Total firms: ${all.length}`);
  await db.$disconnect();
}
main();
