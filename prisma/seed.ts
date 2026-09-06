import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL || "admin@doyoulikepizza.com";
  const adminPassword = process.env.ADMIN_PASSWORD || "changeme123";

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existing) {
    console.log(`Admin already exists: ${adminEmail}`);
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  await prisma.user.create({
    data: {
      name: "Admin",
      email: adminEmail,
      passwordHash,
      role: "ADMIN",
      verificationStatus: "APPROVED",
    },
  });

  console.log(`Created admin user: ${adminEmail}`);
  console.log(
    adminPassword === "changeme123"
      ? "⚠️  Using default password 'changeme123' — set ADMIN_EMAIL/ADMIN_PASSWORD env vars before deploying, then change it."
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
