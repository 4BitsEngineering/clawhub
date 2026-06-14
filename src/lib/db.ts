import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function makeClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter });
}

function getClient(): PrismaClient {
  const client = globalForPrisma.prisma ?? makeClient();
  if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = client;
  return client;
}

// Cliente Prisma PEREZOSO: se instancia (y se exige DATABASE_URL) en el PRIMER
// uso real, no al importar el módulo. Así `next build` puede recolectar la page
// data de rutas que importan `db` SIN DATABASE_URL presente (p.ej. los deploys
// de PREVIEW de una rama en Vercel, donde la var solo está en el entorno
// Production). El error "DATABASE_URL is not set" solo salta si de verdad se
// toca la BD en runtime. Mantiene el singleton (globalForPrisma) intacto.
export const db: PrismaClient = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getClient();
    const value = Reflect.get(client, prop, receiver);
    return typeof value === "function" ? value.bind(client) : value;
  },
}) as PrismaClient;
