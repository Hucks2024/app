import path from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql as PrismaLibSqlNode } from "@prisma/adapter-libsql";
import { PrismaLibSql as PrismaLibSqlWeb } from "@prisma/adapter-libsql/web";

// The live site uses Turso over HTTPS (TURSO_DATABASE_URL); a computer
// running the app locally uses a SQLite file (DATABASE_URL, file:./dev.db).

/** The local file's URL as an absolute path, so it resolves the same
 * whatever folder the app happens to be started from. */
function localFileUrl(): string {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  if (!url.startsWith("file:")) return url;
  const relativePath = url.slice("file:".length);
  if (path.isAbsolute(relativePath)) return url;
  return `file:${path.resolve(/* turbopackIgnore: true */ process.cwd(), relativePath)}`;
}

function createPrismaClient(): PrismaClient {
  const log: ("warn" | "error")[] = process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"];
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  const adapter = tursoUrl
    ? new PrismaLibSqlWeb({ url: tursoUrl, authToken: process.env.TURSO_AUTH_TOKEN })
    : new PrismaLibSqlNode({ url: localFileUrl() });
  return new PrismaClient({ adapter, log });
}

// One client for the whole server, made on first use.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export async function getPrisma(): Promise<PrismaClient> {
  globalForPrisma.prisma ??= createPrismaClient();
  return globalForPrisma.prisma;
}
