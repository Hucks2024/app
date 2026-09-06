import path from "path";
import { PrismaClient } from "@prisma/client";

// Next.js's dev bundler (Turbopack) doesn't always run with the project root
// as cwd, which throws off Prisma's default relative-path resolution for a
// SQLite "file:" URL and can fail with "attempt to write a readonly
// database". Resolving to an absolute path ourselves (relative to prisma/,
// matching where `prisma migrate`/`prisma generate` put the file) sidesteps
// that regardless of how the module happens to be loaded. Non-file URLs
// (e.g. a libsql:// Turso URL in production) are passed through untouched.
function resolvedDatabaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url?.startsWith("file:")) return url;

  const relativePath = url.slice("file:".length);
  if (path.isAbsolute(relativePath)) return url;

  const absolutePath = path.resolve(process.cwd(), "prisma", relativePath);
  return `file:${absolutePath}`;
}

// Standard Next.js dev-mode singleton so hot-reload doesn't spawn a new
// Prisma client (and a new SQLite connection) on every file save.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: resolvedDatabaseUrl(),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
