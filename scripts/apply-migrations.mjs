// One-off helper to apply Prisma migrations directly against the remote DB.
//
// Why this exists: `prisma migrate deploy/dev` can't connect to this server
// because the `finance` MySQL user authenticates with the `sha256_password`
// plugin, and Prisma's CLI engine only negotiates SSL for MySQL when an
// explicit `sslcert`/`sslidentity` is configured (no plain "force SSL"
// toggle). Our app code works around this via a custom PoolConfig with
// `ssl: { rejectUnauthorized: false }` (see src/lib/db-url.ts) but the CLI
// doesn't go through that code path. So this script applies pending
// migration.sql files the same way the CLI would (recording them into
// `_prisma_migrations`) but using a connection that actually succeeds.
//
// If the DB user's auth plugin is ever changed to mysql_native_password or
// caching_sha2_password (needs server-admin rights we don't have), the
// normal `npx prisma migrate deploy` should work directly instead.
import "dotenv/config";
import { createHash } from "node:crypto";
import { randomUUID } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import mariadb from "mariadb";
import { parseDatabaseUrl } from "../src/lib/db-url.ts";

const MIGRATIONS_DIR = join(process.cwd(), "prisma", "migrations");

const poolConfig = parseDatabaseUrl(process.env.DATABASE_URL);
const conn = await mariadb.createConnection(poolConfig);

async function ensureMigrationsTable() {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS \`_prisma_migrations\` (
      \`id\` VARCHAR(36) NOT NULL,
      \`checksum\` VARCHAR(64) NOT NULL,
      \`finished_at\` DATETIME(3) NULL,
      \`migration_name\` VARCHAR(255) NOT NULL,
      \`logs\` TEXT NULL,
      \`rolled_back_at\` DATETIME(3) NULL,
      \`started_at\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
      \`applied_steps_count\` INT UNSIGNED NOT NULL DEFAULT 0,
      PRIMARY KEY (\`id\`)
    ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  `);
}

function splitStatements(sql) {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((statement) =>
      statement
        .split(/\r?\n/)
        .filter((line) => !line.trim().startsWith("--"))
        .join("\n")
        .trim()
    )
    .filter((statement) => statement.length > 0);
}

async function main() {
  await ensureMigrationsTable();

  const migrationFolders = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();

  const [appliedRows] = [
    await conn.query(
      "SELECT migration_name FROM `_prisma_migrations` WHERE finished_at IS NOT NULL"
    ),
  ];
  const applied = new Set(appliedRows.map((row) => row.migration_name));

  for (const migrationName of migrationFolders) {
    if (applied.has(migrationName)) {
      console.log(`Skipping already-applied migration: ${migrationName}`);
      continue;
    }

    const sqlPath = join(MIGRATIONS_DIR, migrationName, "migration.sql");
    const sql = readFileSync(sqlPath, "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const statements = splitStatements(sql);
    const id = randomUUID();

    console.log(`Applying migration: ${migrationName} (${statements.length} statements)`);

    await conn.query(
      `INSERT INTO \`_prisma_migrations\`
        (id, checksum, migration_name, started_at, applied_steps_count)
       VALUES (?, ?, ?, CURRENT_TIMESTAMP(3), 0)`,
      [id, checksum, migrationName]
    );

    try {
      for (const statement of statements) {
        await conn.query(statement);
      }

      await conn.query(
        `UPDATE \`_prisma_migrations\`
         SET finished_at = CURRENT_TIMESTAMP(3), applied_steps_count = ?
         WHERE id = ?`,
        [statements.length, id]
      );

      console.log(`Applied: ${migrationName}`);
    } catch (error) {
      await conn.query(
        `UPDATE \`_prisma_migrations\` SET logs = ? WHERE id = ?`,
        [String(error.message ?? error), id]
      );
      throw error;
    }
  }

  console.log("Done.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await conn.end();
  });
