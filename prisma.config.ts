import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Plain process.env access, not the `env()` helper, that helper
    // throws if the var isn't set at all, which broke `prisma generate`
    // on Vercel (DATABASE_URL is never set there; the real runtime
    // datasource is TURSO_DATABASE_URL, read directly in src/lib/db.ts,
    // not through this CLI-only config). This is only used by the CLI
    // (migrate/studio); the app itself never reads it.
    url: process.env.DATABASE_URL || "file:./dev.db",
  },
});
