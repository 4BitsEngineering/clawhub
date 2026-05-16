import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const db = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
    }),
  });
  const all = await db.instance.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { _count: { select: { heartbeats: true } } },
  });
  for (const i of all) {
    const age = i.lastHeartbeatAt
      ? Math.round((Date.now() - i.lastHeartbeatAt.getTime()) / 1000)
      : null;
    console.log(
      `${i.workerLabel.padEnd(28)} v:${(i.version || "?").padEnd(15)} os:${(i.os || "?").padEnd(8)} beats:${String(i._count.heartbeats).padStart(4)} age:${age ?? "—"}s`,
    );
  }
  await db.$disconnect();
}
main();
