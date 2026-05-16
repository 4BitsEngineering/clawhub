import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const db = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
    }),
  });

  const instances = await db.instance.findMany({
    where: { workerLabel: "María García" },
    orderBy: { createdAt: "desc" },
    take: 3,
    include: { _count: { select: { heartbeats: true } } },
  });

  console.log(`Found ${instances.length} instance(s):`);
  for (const i of instances) {
    const ageMs = i.lastHeartbeatAt
      ? Date.now() - i.lastHeartbeatAt.getTime()
      : null;
    console.log({
      id: i.id,
      workerLabel: i.workerLabel,
      createdAt: i.createdAt.toISOString(),
      lastHeartbeatAt: i.lastHeartbeatAt?.toISOString() ?? null,
      ageSeconds: ageMs ? Math.round(ageMs / 1000) : null,
      isOnline: ageMs !== null && ageMs < 3 * 60 * 1000,
      heartbeats: i._count.heartbeats,
    });
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
