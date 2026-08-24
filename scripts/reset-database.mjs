// Drops every table in the connected database, re-applies Prisma
// migrations, then runs the seed. Uses the same mariadb SSL workaround as
// apply-migrations.mjs because `prisma migrate reset` cannot connect.
import "dotenv/config";
import { spawn } from "node:child_process";
import mariadb from "mariadb";
import { parseDatabaseUrl } from "../src/lib/db-url.ts";

const poolConfig = parseDatabaseUrl(process.env.DATABASE_URL);
const conn = await mariadb.createConnection(poolConfig);

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", shell: true });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited ${code}`));
    });
  });
}

try {
  await conn.query("SET FOREIGN_KEY_CHECKS = 0");
  const tables = await conn.query(
    "SELECT TABLE_NAME AS name FROM information_schema.tables WHERE table_schema = DATABASE()"
  );

  console.log(`Dropping ${tables.length} table(s)...`);
  for (const { name } of tables) {
    await conn.query(`DROP TABLE IF EXISTS \`${name}\``);
    console.log(`Dropped ${name}`);
  }
  await conn.query("SET FOREIGN_KEY_CHECKS = 1");
  await conn.end();

  console.log("Re-applying migrations...");
  await run("npm", ["run", "db:apply-migrations"]);

  console.log("Seeding...");
  await run("npx", ["tsx", "prisma/seed.ts"]);

  console.log("Database reset complete.");
} catch (error) {
  console.error(error);
  process.exitCode = 1;
  try {
    await conn.end();
  } catch {
    // already closed
  }
}
