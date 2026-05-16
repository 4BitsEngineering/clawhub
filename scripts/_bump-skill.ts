import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";

async function main() {
  const slug = process.argv[2] ?? "tono-comunicacion";
  const db = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
    }),
  });
  const r = await db.skill.updateMany({
    where: { slug },
    data: {
      version: { increment: 1 },
      content: `# ${slug} — actualizado a las ${new Date().toLocaleString("es-ES")}`,
      publishedAt: new Date(),
    },
  });
  console.log(`bumped: ${r.count} skill(s)`);
  await db.$disconnect();
}
main();
