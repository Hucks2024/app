import path from "path";
import { cache } from "react";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql as PrismaLibSqlWeb } from "@prisma/adapter-libsql/web";
import { onCloudflare } from "@/lib/runtime";

// The live site uses Turso over HTTPS (TURSO_DATABASE_URL); a computer
// running the app locally uses a SQLite file (DATABASE_URL, file:./dev.db).
// The file one needs a native module Cloudflare can't load, so it's only
// loaded when it's used.

/** The local file's URL as an absolute path, so it resolves the same
 * whatever folder the app happens to be started from. */
function localFileUrl(): string {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  if (!url.startsWith("file:")) return url;
  const relativePath = url.slice("file:".length);
  if (path.isAbsolute(relativePath)) return url;
  return `file:${path.resolve(/* turbopackIgnore: true */ process.cwd(), relativePath)}`;
}

async function createPrismaClient(): Promise<PrismaClient> {
  const log: ("warn" | "error")[] = process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"];
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  if (tursoUrl) {
    const adapter = new PrismaLibSqlWeb({ url: tursoUrl, authToken: process.env.TURSO_AUTH_TOKEN });
    return new PrismaClient({ adapter, log });
  }
  const { PrismaLibSql: PrismaLibSqlNode } = await import("@prisma/adapter-libsql");
  return new PrismaClient({ adapter: new PrismaLibSqlNode({ url: localFileUrl() }), log });
}

// On a Node server, one client for the whole server, made on first use.
// Cloudflare doesn't let one visit's request wait on another's, so there
// it's one client per request (cache() keeps it to one for each).
const globalForPrisma = globalThis as unknown as { prisma?: Promise<PrismaClient> };
const perRequest = cache(createPrismaClient);

export async function getPrisma(): Promise<PrismaClient> {
  if (onCloudflare) return perRequest();
  globalForPrisma.prisma ??= createPrismaClient();
  return globalForPrisma.prisma;
}
