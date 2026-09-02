import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

const db = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  }),
});

async function main() {
  const bundles = await db.stackBundle.findMany({
    where: { kind: "INSTALLER" },
    orderBy: { releasedAt: "desc" },
  });

  for (const b of bundles) {
    console.log(
      [
        b.version.padEnd(10),
        `channel=${b.channel}`,
        `platform=${b.platform ?? "NULL"}`,
        `releasedAt=${b.releasedAt.toISOString()}`,
        `deprecated=${b.deprecatedAt ? b.deprecatedAt.toISOString() : "no"}`,
        `url=${b.downloadUrl}`,
      ].join("  "),
    );
  }

  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
