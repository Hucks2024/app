import path from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import bcrypt from "bcryptjs";
import { ensureMembership, formatMemberNumber } from "../src/lib/invite";

// Same resolution as src/lib/db.ts, minus the Cloudflare-binding lookup
// (this script only ever runs as a plain Node CLI, e.g. `prisma db seed` or
// `npm run db:seed`, locally, or against a real Turso database if
// TURSO_DATABASE_URL is set, e.g. to seed a freshly-deployed production DB).
function resolvedLocalFileUrl(): string {
  const url = process.env.DATABASE_URL ?? "file:./dev.db";
  if (!url.startsWith("file:")) return url;
  const relativePath = url.slice("file:".length);
  if (path.isAbsolute(relativePath)) return url;
  return `file:${path.resolve(process.cwd(), relativePath)}`;
}

const adapter = process.env.TURSO_DATABASE_URL
  ? new PrismaLibSql({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
  : new PrismaLibSql({ url: resolvedLocalFileUrl() });

const prisma = new PrismaClient({ adapter });

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@doyoulikepizza.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "changeme123";

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existing) {
    const { memberNumber, inviteCode } = await ensureMembership(prisma, existing.id);
    console.log(`Admin already exists: ${adminEmail} (member #${formatMemberNumber(memberNumber)})`);
    console.log(`Their invite code: ${inviteCode}`);
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const admin = await prisma.user.create({
    data: {
      name: "Admin",
      email: adminEmail,
      passwordHash,
      role: "ADMIN",
      verificationStatus: "APPROVED",
    },
  });

  // Signup is invite-only, so the very first account needs a code or
  // nobody can ever join. Admin codes never run out.
  const { memberNumber, inviteCode } = await ensureMembership(prisma, admin.id);

  console.log(`Created admin user: ${adminEmail} (member #${formatMemberNumber(memberNumber)})`);
  console.log(`Their invite code (hand this out to let the first people in): ${inviteCode}`);
  console.log(
    adminPassword === "changeme123"
      ? "⚠️  Using default password 'changeme123', set ADMIN_EMAIL/ADMIN_PASSWORD env vars before deploying, then change it."
      : "Password set from ADMIN_PASSWORD env var."
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
