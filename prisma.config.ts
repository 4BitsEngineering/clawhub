// clawhub — Prisma 7 config
// Loads DATABASE_URL / DIRECT_URL from .env (or .env.local).
//
// Migrations need a direct connection (port 5432) — pgbouncer transaction
// mode breaks DDL. App runtime uses the pooled DATABASE_URL via the
// adapter-pg in src/lib/db.ts.

import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL,
  },
});
