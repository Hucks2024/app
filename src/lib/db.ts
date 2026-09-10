import path from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql as PrismaLibSqlNode } from "@prisma/adapter-libsql";
import { PrismaLibSql as PrismaLibSqlWeb } from "@prisma/adapter-libsql/web";
import { getCloudflareContext } from "@opennextjs/cloudflare";

// Next.js's dev bundler (Turbopack) doesn't always run with the project root
// as cwd, which throws off relative-path resolution for a SQLite "file:"
// URL. Resolving to an absolute path ourselves sidesteps that regardless of
// how the module happens to be loaded. Resolved relative to the project
// root (matching prisma.config.ts, which is what `prisma migrate`/
// `prisma generate` actually use to place the file as of Prisma 7).
function resolvedLocalFileUrl(): string {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  if (!url.startsWith("file:")) return url;

  const relativePath = url.slice("file:".length);
  if (path.isAbsolute(relativePath)) return url;

  const absolutePath = path.resolve(/* turbopackIgnore: true */ process.cwd(), relativePath);
  return `file:${absolutePath}`;
}

/**
 * Reads TURSO_DATABASE_URL/TURSO_AUTH_TOKEN. On a normal Node host these are
 * plain env vars. On Cloudflare Workers, `vars`/secrets are NOT exposed via
 * `process.env`, they only exist on the per-request Workers `env` object,
 * reachable through OpenNext's `getCloudflareContext()`. We only reach for
 * that when the plain env var isn't there, and swallow any failure (e.g.
 * running outside a Workers/OpenNext context at all), so this stays a no-op
 * everywhere else.
 */
function readEnv(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  try {
    const { env } = getCloudflareContext();
    return (env as Record<string, string | undefined>)[name];
  } catch {
    return undefined;
  }
}

function createPrismaClient(): PrismaClient {
  const log: ("warn" | "error")[] =
    process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"];

  const tursoUrl = readEnv("TURSO_DATABASE_URL");
  if (tursoUrl) {
    // Cloudflare Workers (and any other environment without a real
    // filesystem) talks to Turso over plain HTTP, the "/web" adapter has
    // no native bindings, so it's the one build that actually runs inside
    // a Workers isolate.
    const authToken = readEnv("TURSO_AUTH_TOKEN");
    const adapter = new PrismaLibSqlWeb({ url: tursoUrl, authToken });
    return new PrismaClient({ adapter, log });
  }

  // Local dev, or any host with a normal persistent disk: the same libSQL
  // adapter, just pointed at a local SQLite file instead of a remote Turso
  // database, Prisma 7 always needs an adapter, there's no more implicit
  // native-engine connection to fall back to.
  const adapter = new PrismaLibSqlNode({ url: resolvedLocalFileUrl() });
  return new PrismaClient({ adapter, log });
}

// Module-level memoized singleton. Cloudflare bindings are only reachable
// from inside a request's context, so this is created lazily on first real
// use rather than at import time.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function getPrisma(): Promise<PrismaClient> {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient();
  }
  return Promise.resolve(globalForPrisma.prisma);
}

export { getPrisma };
