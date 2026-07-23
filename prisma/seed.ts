import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { parseDatabaseUrl } from "../src/lib/db-url";

// Bootstraps the first ADMIN user so the Admin Panel (category taxonomy
// management) is reachable. Re-runnable via upsert.
//
// Configure via .env:
//   ADMIN_EMAIL="you@example.com"
//   ADMIN_PASSWORD="a-strong-password"

const adapter = new PrismaMariaDb(
  parseDatabaseUrl(process.env.DATABASE_URL as string)
);
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Set ADMIN_EMAIL and ADMIN_PASSWORD in .env before running the seed script."
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email: email.toLowerCase() },
    update: {},
    create: {
      email: email.toLowerCase(),
      passwordHash,
      name: "Admin",
      role: "ADMIN",
    },
  });

  console.log(`Seeded admin user: ${admin.email} (role: ${admin.role})`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
